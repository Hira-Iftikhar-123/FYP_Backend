import React, { useState, useCallback } from "react"; 
import { View, Text, TouchableOpacity, ScrollView, Image, Modal, Alert, TextInput, Image as RNImage } from "react-native"; 
import { Video } from 'expo-av'; 

import { Camera, MapPin, Bell, Menu, User, AlertTriangle } from "lucide-react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { cssInterop } from "nativewind";
import { API_BASE_URL } from "../config"; 

cssInterop(LinearGradient, { className: "style" });

const sampleVideo = require("../assets/sample.mp4");

const sampleVideoAsset = RNImage.resolveAssetSource(sampleVideo);
const sampleVideoUri = sampleVideoAsset.uri;

const getFileMetaData = (uri) => {
    const filename = uri.split('/').pop().split('?')[0];
    const fileType = 'video/mp4'; 
    return { name: filename, type: fileType };
};

// --- NEW MODEL RESPONSE MODAL COMPONENT ---
const ModelResponseModal = ({ visible, data, onClose }) => {
    if (!data) return null;
    
    // Format the JSON data nicely for display in the modal
    const formattedData = JSON.stringify(data, null, 2);

    return (
        <Modal visible={visible} transparent animationType="fade">
            <View className="flex-1 justify-center items-center bg-black/50 p-4">
                <View className="bg-white dark:bg-gray-800 p-6 rounded-xl w-full max-w-sm">
                    <Text className="text-lg font-bold text-black dark:text-white mb-4">
                        Model Detection Response
                    </Text>
                    
                    <ScrollView className="max-h-64 mb-4 p-2 bg-gray-100 dark:bg-gray-700 rounded-lg border border-gray-300 dark:border-gray-600">
                        <Text className="text-xs text-black dark:text-white font-mono">
                            {/* Display the entire JSON response */}
                            {formattedData}
                        </Text>
                    </ScrollView>

                    <TouchableOpacity className="bg-purple-600 py-3 rounded-lg" onPress={onClose}>
                        <Text className="text-center text-white font-semibold">Continue</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );
};
// ------------------------------------------

const HomeScreen = () => {
    const router = useRouter();
    const [activeTab, setActiveTab] = useState("feeds");

    const [reportModalVisible, setReportModalVisible] = useState(false);
    const [confirmModalVisible, setConfirmModalVisible] = useState(false);
    
    // --- NEW STATE FOR MODEL RESPONSE POPUP ---
    const [modelResponseModalVisible, setModelResponseModalVisible] = useState(false);
    const [modelResponseData, setModelResponseData] = useState(null);
    // ------------------------------------------

    const [selectedCamera, setSelectedCamera] = useState(null);
    const [modalIncidentType, setModalIncidentType] = useState("");
    const [modalStatus, setModalStatus] = useState("pending"); 

    const cameraFeeds = [
        { 
            id: 1, 
            name: "Entrance (Video)", 
            status: "Active", 
            image: sampleVideo,
            isVideo: true 
        }, 
    ];
    
    const incidentTypes = ["Theft", "Violence"];
    const statusOptions = ["Pending", "Urgent", "Verified"];

    const handleReportPress = (camera) => {
        setSelectedCamera(camera);
        setModalIncidentType(""); 
        setModalStatus("pending"); 
        setReportModalVisible(true);
    };


    // ----------- HELPER FUNCTION FOR CONDITIONAL AWS FILE UPLOAD -------------
    const uploadVideoForAlert = async (alertId) => {
        const { name, type } = getFileMetaData(sampleVideoUri);
        
        const formData = new FormData();
        
        formData.append('file', {
            uri: sampleVideoUri,
            name: name,
            type: type, // 'video/mp4'
        });

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
            Alert.alert("AWS Upload Failed", `The alert was created, but the video evidence failed to upload: ${error.message}`);
            return false;
        }
    };
    
    // FUNCTION: DIRECT API CALL TO MODEL DETECT ENDPOINT 
    const runModelDetection = async (cameraId) => {
        const { name, type } = getFileMetaData(sampleVideoUri);
        
        const formData = new FormData();
        
        // Match the backend definition: video: UploadFile = File(...)
        formData.append('video', { 
            uri: sampleVideoUri,
            name: name,
            type: type, 
        });

        // Match the backend definition: camera_id: int = 1
        formData.append('camera_id', cameraId); 

        try {
            const response = await fetch(`${API_BASE_URL}/model/api/v1/detect`, { 
                method: "POST",
                body: formData,
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`Detection failed with status ${response.status}. Detail: ${errorData.detail || 'Unknown error'}`);
            }

            // Return the DetectResponse object
            const result = await response.json();
            console.log("Model Detection API Result:", result);
            return result;

        } catch (error) {
            console.error("Model Detection API Error:", error);
            // Re-throw to be caught by the main handler
            throw new Error(`Detection connection failure: ${error.message}`);
        }
    }
    // -----------------------------------------------------------------------------


    // ----------- REVISED API CALL FOR QUICK REPORT (SHOWING MODEL RESPONSE) -------------
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
                const errorData = await alertResponse.json();
                const errorMessage = Array.isArray(errorData.detail) 
                    ? errorData.detail.map(err => `${err.loc.join('.')}: ${err.msg}`).join('\n')
                    : errorData.detail || `HTTP Status: ${alertResponse.status}`;
                
                Alert.alert("Report Failed (Alert Creation)", errorMessage);
                return;
            }

            const alertData = await alertResponse.json();
            const alertId = alertData.alert_id || 999; 
            
            // STEP 2: Run Model Detection on the video
            const detectionResult = await runModelDetection(selectedCamera.id);
            
            // --- NEW: Display Model Response Popup ---
            setModelResponseData(detectionResult);
            setModelResponseModalVisible(true);
            // ---------------------------------------

            // STEP 3: Conditional AWS Upload
            if (detectionResult.prediction !== "Normal") {
                // If model detects a non-normal event, upload video to AWS for permanent storage
                await uploadVideoForAlert(alertId); 
            } else {
                // Model detected a normal event. No upload to AWS for evidence.
            }

            // The final confirmation modal is shown after the user dismisses the Model Response modal
            // by setting the final confirmation step inside a continuation function/callback.
            
        } catch (error) {
            console.error("Quick Report Process Critical Error:", error);
            Alert.alert("Process Failure", `Could not complete the reporting process. ${error.message}`);
        } finally {
            // Clear modal state
            setModalIncidentType("");
            setModalStatus("pending");
        }
    };
    
    // --- New handler to chain modals ---
    const handleModelResponseClose = () => {
        setModelResponseModalVisible(false);
        // Once the model response is dismissed, show the final confirmation
        setConfirmModalVisible(true);
    };


    // -----------------------------------------------------------------------------

    // ... (rest of the component's return logic remains the same)
    return (
        <View className="flex-1 bg-white dark:bg-gray-900">
             {/* Header (omitted for brevity) */}
            <LinearGradient colors={["#7A288A", "#C51077"]} className="px-4 pt-12 pb-6 rounded-b-3xl">
                {/* ... Header content ... */}
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

            {/* --- NEW MODEL RESPONSE MODAL INSTANCE --- */}
            <ModelResponseModal 
                visible={modelResponseModalVisible}
                data={modelResponseData}
                onClose={handleModelResponseClose}
            />
            {/* ------------------------------------------- */}

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