import React, { useState, useCallback } from "react"; 
import { View, Text, TouchableOpacity, ScrollView, Image, Modal, Alert, TextInput, Image as RNImage } from "react-native"; 
import { Video } from 'expo-av'; 

import { Camera, MapPin, Bell, Menu, User, AlertTriangle } from "lucide-react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { cssInterop } from "nativewind";
import { API_BASE_URL } from "../config"; 

cssInterop(LinearGradient, { className: "style" });

// Correct video path (inside frontend/assets)
const sampleVideo = require("../assets/sample.mp4");

// Resolve the local asset to get its URI for upload
const sampleVideoAsset = RNImage.resolveAssetSource(sampleVideo);
const sampleVideoUri = sampleVideoAsset.uri;

// Helper to determine the file name and type
const getFileMetaData = (uri) => {
    const filename = uri.split('/').pop().split('?')[0];
    const fileType = 'video/mp4'; 
    return { name: filename, type: fileType };
};

const HomeScreen = () => {
    const router = useRouter();
    const [activeTab, setActiveTab] = useState("feeds");

    const [reportModalVisible, setReportModalVisible] = useState(false);
    const [confirmModalVisible, setConfirmModalVisible] = useState(false);
    const [selectedCamera, setSelectedCamera] = useState(null);
    
    // Holds the chosen incident type inside the modal
    const [modalIncidentType, setModalIncidentType] = useState("");
    // Holds the chosen status inside the modal
    const [modalStatus, setModalStatus] = useState("pending"); // Default to pending

    const cameraFeeds = [
        { 
            id: 1, 
            name: "Entrance (Video)", 
            status: "Active", 
            image: sampleVideo,
            isVideo: true 
        }, 
    ];
    
    // Incident types for the modal
    const incidentTypes = ["Theft", "Violence"];
    // Status options for the modal
    const statusOptions = ["Pending", "Urgent", "Verified"];

    const handleReportPress = (camera) => {
        setSelectedCamera(camera);
        setModalIncidentType(""); 
        setModalStatus("pending"); 
        setReportModalVisible(true);
    };


    // ----------- NEW HELPER FUNCTION FOR CONDITIONAL AWS FILE UPLOAD -------------
    const uploadVideoForAlert = async (alertId) => {
        const { name, type } = getFileMetaData(sampleVideoUri);
        
        const formData = new FormData();
        
        // Use the local asset URI for file upload
        formData.append('file', {
            uri: sampleVideoUri,
            name: name,
            type: type, // 'video/mp4'
        });

        // Append the required alert_id field
        formData.append('alert_id', alertId);

        try {
            const response = await fetch(`${API_BASE_URL}/aws/upload/file`, { 
                method: "POST",
                body: formData,
            });

            if (!response.ok) {
                const errorData = await response.text();
                throw new Error(`AWS Upload failed with status ${response.status}: ${errorData}`);
            }

            console.log("Video Upload to AWS Successful for Alert ID:", alertId);
            return true;

        } catch (error) {
            console.error("AWS Upload Error:", error);
            Alert.alert("AWS Upload Failed", `The alert was created, but the video upload to AWS failed: ${error.message}`);
            return false;
        }
    };
    // -------------------------------------------------------------
    
    // ----------- NEW MOCK DETECTION FUNCTION (Simulates POST /model/api/v1/detect) -------------
    // In a real app, this would involve sending the video to a processing service
    const mockDetection = async (incidentType) => {
        // --- Simulate Network Delay ---
        await new Promise(resolve => setTimeout(resolve, 1500)); 

        // --- Mock Detection Logic ---
        // For demonstration: Assume the model confirms the user's report 80% of the time,
        // unless the reported type is 'Theft', which has a 50% chance of being 'Normal'
        const confirmed = Math.random() < 0.8 && incidentType.toLowerCase() !== 'theft';
        const theftConfirmed = incidentType.toLowerCase() === 'theft' && Math.random() > 0.5;

        const result = {
            prediction: (confirmed || theftConfirmed) ? "Event Detected" : "Normal",
            alert_type: (confirmed || theftConfirmed) ? incidentType.toLowerCase() : "normal",
            confidence: (confirmed || theftConfirmed) ? 0.95 : 0.99,
            clip_duration_seconds: 5.0,
            alert_status: "verified", // Model output status
        };

        // In a real app, this would be a POST request to the model's prediction service
        console.log("Model Detection Result:", result);
        return result;
    }
    // -----------------------------------------------------------------------------


    // ----------- REVISED API CALL FOR QUICK REPORT (POST /alerts/ -> mockDetection -> CONDITIONAL AWS UPLOAD) -------------
    const submitQuickReport = async () => {
        const type = modalIncidentType;

        if (!type || !selectedCamera) {
            Alert.alert("Missing Info", "Please select an incident type.");
            return;
        }
        
        setReportModalVisible(false);

        // 1. Alert Creation Payload (Manual Report)
        const alertPayload = {
            event_type: type.toLowerCase(), 
            camera_id: selectedCamera.id,
            status: modalStatus.toLowerCase(), 
            sent_at: new Date().toISOString(), 
        };

        try {
            // STEP 1: Submit the Alert to the API to get an alert_id
            const alertResponse = await fetch(`${API_BASE_URL}/alerts/`, { 
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(alertPayload),
            });

            if (!alertResponse.ok) {
                // Handle alert creation errors
                const errorData = await alertResponse.json();
                const errorMessage = Array.isArray(errorData.detail) 
                    ? errorData.detail.map(err => `${err.loc.join('.')}: ${err.msg}`).join('\n')
                    : errorData.detail || `HTTP Status: ${alertResponse.status}`;
                
                Alert.alert("Report Failed (Alert Creation)", errorMessage);
                return;
            }

            // Get the ID for subsequent operations
            const alertData = await alertResponse.json();
            const alertId = alertData.alert_id || 999; 
            
            Alert.alert("Alert Created", `Alert ID ${alertId} created. Running model detection...`);


            // STEP 2: Run Model Detection on the video
            const detectionResult = await mockDetection(type);

            let uploadSuccess = false;
            let finalMessage = "Report submitted and processed.";
            
            // STEP 3: Conditional AWS Upload
            if (detectionResult.prediction !== "Normal") {
                // If model detects a non-normal event, upload video to AWS
                Alert.alert("Model Confirmed", `Model detected ${detectionResult.alert_type} with ${detectionResult.confidence.toFixed(2)} confidence. Uploading video to AWS for evidence.`);
                uploadSuccess = await uploadVideoForAlert(alertId);
                
                if (uploadSuccess) {
                     finalMessage = `Report submitted. Model confirmed ${detectionResult.alert_type}. Video uploaded to AWS.`;
                }
            } else {
                // Model detected a normal event
                finalMessage = "Report submitted. Model concluded the event was Normal. Video upload skipped.";
            }

            // Show final confirmation
            Alert.alert("Process Complete", finalMessage);
            setConfirmModalVisible(true);

        } catch (error) {
            console.error("Quick Report Process Error:", error);
            Alert.alert("Critical Error", "An error occurred during the reporting process.");
        } finally {
            // Clear modal state
            setModalIncidentType("");
            setModalStatus("pending");
        }
    };
    // -----------------------------------------------------------------------------

    // ... (rest of the component's return logic remains the same)
    return (
        <View className="flex-1 bg-white dark:bg-gray-900">
             {/* Header (omitted for brevity) */}
            <LinearGradient colors={["#7A288A", "#C51077"]} className="px-4 pt-12 pb-6 rounded-b-3xl">
                <View className="flex-row justify-between items-center">
                    <View className="flex-row items-center">
                        <Menu color="white" size={24} />
                        <Text className="text-white text-2xl font-bold ml-4">Muhafiz AI</Text>
                    </View>
                    <TouchableOpacity onPress={() => router.push("/profile")}>
                        <User color="white" size={24} />
                    </TouchableOpacity>
                </View>
                <Text className="text-white text-sm mt-2 opacity-90">
                    Real-time theft and violence detection system
                </Text>
            </LinearGradient>

            {/* Stats Cards (omitted for brevity) */}
            <View className="flex-row justify-between mx-4 mt-6">
                <View className="bg-purple-100 dark:bg-purple-900/50 rounded-xl p-4 flex-1 mr-2">
                    <Text className="text-purple-800 dark:text-purple-200 font-bold text-lg">24</Text>
                    <Text className="text-purple-600 dark:text-purple-300 text-xs">Cameras Active</Text>
                </View>

                <View className="bg-pink-100 dark:bg-pink-900/50 rounded-xl p-4 flex-1 mx-2">
                    <Text className="text-pink-800 dark:text-pink-200 font-bold text-lg">12</Text>
                    <Text className="text-pink-600 dark:text-pink-300 text-xs">Alerts Today</Text>
                </View>

                <View className="bg-indigo-100 dark:bg-indigo-900/50 rounded-xl p-4 flex-1 ml-2">
                    <Text className="text-indigo-800 dark:text-indigo-200 font-bold text-lg">3</Text>
                    <Text className="text-indigo-600 dark:text-indigo-300 text-xs">Incidents</Text>
                </View>
            </View>

            {/* Tabs (omitted for brevity) */}
            <View className="flex-row mt-6 mx-4 bg-gray-100 dark:bg-gray-800 rounded-xl p-1">
                {[
                    { key: "feeds", label: "Camera Feeds", icon: Camera, route: null },
                    { key: "alerts", label: "Alerts", icon: Bell, route: "/alerts" },
                ].map((tab) => (
                    <TouchableOpacity
                        key={tab.key}
                        className={`flex-1 py-3 rounded-lg items-center ${activeTab === tab.key ? "bg-purple-600" : ""}`}
                        onPress={() => (tab.route ? router.push(tab.route) : setActiveTab(tab.key))}
                    >
                        <View className="flex-row items-center">
                            <tab.icon
                                color={activeTab === tab.key ? "white" : "#7A288A"}
                                size={18}
                            />
                            <Text className={`ml-2 font-medium ${activeTab === tab.key ? "text-white" : "text-purple-800 dark:text-purple-200"}`}>
                                {tab.label}
                            </Text>
                        </View>
                    </TouchableOpacity>
                ))}
            </View>

            {/* Main Content (omitted for brevity) */}
            <ScrollView className="flex-1 mx-4 mt-4 mb-4">
                {activeTab === "feeds" && (
                    <View>
                        <View className="flex-row justify-between items-center mb-4">
                            <Text className="text-black dark:text-white text-lg font-bold">
                                Live Camera Feeds
                            </Text>
                            <TouchableOpacity>
                                <Text className="text-purple-600 dark:text-purple-400 text-sm">
                                    View All
                                </Text>
                            </TouchableOpacity>
                        </View>

                        <View className="flex-row flex-wrap gap-4">
                            {cameraFeeds.map((feed) => (
                                <View key={feed.id} className="basis-[48%] bg-white dark:bg-gray-800 rounded-xl overflow-hidden shadow-md">
                                    <View className="relative">
                                        {feed.isVideo ? (
                                            <Video
                                                style={{ width: "100%", height: 130 }}
                                                source={feed.image}
                                                useNativeControls={false}
                                                resizeMode="cover"
                                                isLooping
                                                shouldPlay
                                            />
                                        ) : (
                                            <Image source={{ uri: feed.image }} className="h-32 w-full" />
                                        )}

                                        <View className={`absolute top-2 right-2 px-2 py-1 rounded-full ${feed.status === "Active" ? "bg-green-500" : "bg-red-500"}`}>
                                            <Text className="text-white text-xs">{feed.status}</Text>
                                        </View>
                                    </View>

                                    <View className="p-3">
                                        <Text className="text-black dark:text-white font-semibold">{feed.name}</Text>
                                        <Text className="text-gray-500 dark:text-gray-400 text-xs mt-1">Updated just now</Text>

                                        <TouchableOpacity onPress={() => handleReportPress(feed)} className="mt-3 bg-purple-600 py-2 rounded-lg">
                                            <Text className="text-center text-white text-sm font-semibold">Report</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            ))}
                        </View>
                        
                        <View className="mt-6 bg-purple-50 dark:bg-purple-900/30 rounded-xl p-4">
                            <View className="flex-row items-center">
                                <AlertTriangle color="#7A288A" size={24} />
                                <Text className="text-purple-800 dark:text-purple-200 font-bold ml-2">System Status</Text>
                            </View>
                            <Text className="text-purple-700 dark:text-purple-300 mt-2">
                                All systems operational. No critical issues detected in the last 24 hours.
                            </Text>
                        </View>

                    </View>
                )}
            </ScrollView>

            {/* ---------- QUICK REPORT MODAL (unchanged) ---------- */}
            <Modal visible={reportModalVisible} transparent animationType="fade">
                <View className="flex-1 justify-center items-center bg-black/50">
                    <View className="bg-white dark:bg-gray-800 p-6 rounded-xl w-72">
                        <Text className="text-lg font-bold text-black dark:text-white mb-4">
                            Quick Report - {selectedCamera ? selectedCamera.name : "Camera"}
                        </Text>

                        {/* 1. Incident Type Selector (Required) */}
                        <Text className="text-sm font-medium text-black dark:text-white mb-2 mt-2">1. Select Incident Type</Text>
                        <View className="flex-row justify-between mb-4">
                            {incidentTypes.map((type) => (
                                <TouchableOpacity
                                    key={type}
                                    className={`flex-1 py-2 rounded-lg border ${modalIncidentType === type ? "bg-purple-600 border-purple-600" : "bg-gray-100 dark:bg-gray-700 border-gray-300 dark:border-gray-600"}`}
                                    onPress={() => setModalIncidentType(type)}
                                >
                                    <Text className={`text-center font-semibold ${modalIncidentType === type ? "text-white" : "text-black dark:text-white"}`}>{type}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                        
                        {/* 2. Status Selector (Optional/Default) */}
                        <Text className="text-sm font-medium text-black dark:text-white mb-2">2. Set Status</Text>
                        <View className="flex-row flex-wrap justify-between mb-6">
                            {statusOptions.map((status) => (
                                <TouchableOpacity
                                    key={status}
                                    className={`py-2 rounded-lg border my-1 ${modalStatus.toLowerCase() === status.toLowerCase() ? "bg-pink-600 border-pink-600" : "bg-gray-100 dark:bg-gray-700 border-gray-300 dark:border-gray-600"} ${status === 'Pending' ? 'basis-[45%]' : 'basis-[45%]'} ${status === 'Urgent' ? 'basis-[45%]' : 'basis-[45%]'} `}
                                    onPress={() => setModalStatus(status)}
                                >
                                    <Text className={`text-center text-sm font-semibold ${modalStatus.toLowerCase() === status.toLowerCase() ? "text-white" : "text-black dark:text-white"}`}>{status}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        {/* Submit Button */}
                        <TouchableOpacity
                            className={`py-3 rounded-lg ${modalIncidentType ? "bg-purple-600" : "bg-gray-400 dark:bg-gray-600"}`}
                            onPress={submitQuickReport}
                            disabled={!modalIncidentType}
                        >
                            <Text className="text-center text-white font-semibold">Submit Quick Report</Text>
                        </TouchableOpacity>

                        <TouchableOpacity onPress={() => setReportModalVisible(false)} className="mt-4">
                            <Text className="text-center text-gray-600 dark:text-gray-300">Cancel</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* CONFIRMATION MODAL */}
            <Modal visible={confirmModalVisible} transparent animationType="fade">
                <View className="flex-1 justify-center items-center bg-black/50">
                    <View className="bg-white dark:bg-gray-800 p-6 rounded-xl w-72">
                        <Text className="text-lg font-bold text-black dark:text-white mb-4">Report Processed</Text>
                        <Text className="text-gray-700 dark:text-gray-300 mb-4">The final status is available in the Alerts tab.</Text>

                        <TouchableOpacity className="bg-purple-600 py-3 rounded-lg" onPress={() => setConfirmModalVisible(false)}>
                            <Text className="text-center text-white font-semibold">OK</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </View>
    );
};

export default HomeScreen;