import React, { useState } from "react";
import { View, Text, TouchableOpacity, ScrollView, Image, Modal } from "react-native";
import { Camera, AlertTriangle, MapPin, Bell, Menu, User } from "lucide-react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { cssInterop } from "nativewind";

cssInterop(LinearGradient, { className: "style" });

const HomeScreen = () => {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("feeds");

  // ----------- NEW STATES FOR POPUPS -------------
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [confirmModalVisible, setConfirmModalVisible] = useState(false);
  const [selectedCamera, setSelectedCamera] = useState(null);

  const cameraFeeds = [
    { id: 1, name: "Entrance", status: "Active", image: "https://images.unsplash.com/photo-1508444845599-5c89863b1c44?w=900&auto=format&fit=crop&q=60" },
    { id: 2, name: "Parking Lot", status: "Active", image: "https://images.unsplash.com/photo-1653419403196-ab64c4c740c3?w=900&auto=format&fit=crop&q=60" },
    { id: 3, name: "Reception", status: "Offline", image: "https://images.unsplash.com/photo-1584254520678-31fe4dce5306?w=900&auto=format&fit=crop&q=60" },
    { id: 4, name: "Warehouse", status: "Active", image: "https://images.unsplash.com/photo-1517340073101-289191978ae8?w=900&auto=format&fit=crop&q=60" },
  ];

  // ----------- WHEN USER PRESSES REPORT BUTTON -------------
  const handleReportPress = (camera) => {
    setSelectedCamera(camera);
    setReportModalVisible(true);
  };

  // ----------- WHEN USER SELECTS THEFT/VIOLENCE -------------
  const submitReport = (type) => {
    setReportModalVisible(false);
    setConfirmModalVisible(true);

    // Later you can call backend here:
    // fetch("/alerts/report", { method: "POST", body: JSON.stringify({ camera: selectedCamera.id, type }) })
  };

  return (
    <View className="flex-1 bg-white dark:bg-gray-900">

      {/* Header */}
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
        <Text className="text-white text-sm mt-2 opacity-90">Real-time theft and violence detection system</Text>
      </LinearGradient>

      {/* Stats Cards */}
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

      {/* Tabs */}
      <View className="flex-row mt-6 mx-4 bg-gray-100 dark:bg-gray-800 rounded-xl p-1">
        {[
          { key: "feeds", label: "Camera Feeds", icon: Camera, route: null },
          { key: "incidents", label: "Report Incident", icon: MapPin, route: "/report" },
          { key: "alerts", label: "Alerts", icon: Bell, route: "/alerts" },
        ].map((tab) => (
          <TouchableOpacity
            key={tab.key}
            className={`flex-1 py-3 rounded-lg items-center ${activeTab === tab.key ? "bg-purple-600" : ""}`}
            onPress={() => (tab.route ? router.push(tab.route) : setActiveTab(tab.key))}
          >
            <View className="flex-row items-center">
              <tab.icon color={activeTab === tab.key ? "white" : "#7A288A"} size={18} />
              <Text className={`ml-2 font-medium ${activeTab === tab.key ? "text-white" : "text-purple-800 dark:text-purple-200"}`}>
                {tab.label}
              </Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>

      {/* Main Content */}
      <ScrollView className="flex-1 mx-4 mt-4 mb-4">
        {activeTab === "feeds" && (
          <View>
            <View className="flex-row justify-between items-center mb-4">
              <Text className="text-black dark:text-white text-lg font-bold">Live Camera Feeds</Text>
              <TouchableOpacity>
                <Text className="text-purple-600 dark:text-purple-400 text-sm">View All</Text>
              </TouchableOpacity>
            </View>

            <View className="flex-row flex-wrap gap-4">
              {cameraFeeds.map((feed) => (
                <View key={feed.id} className="basis-[48%] bg-white dark:bg-gray-800 rounded-xl overflow-hidden shadow-md">
                  <View className="relative">
                    <Image source={{ uri: feed.image }} className="h-32 w-full" />
                    <View className={`absolute top-2 right-2 px-2 py-1 rounded-full ${feed.status === "Active" ? "bg-green-500" : "bg-red-500"}`}>
                      <Text className="text-white text-xs">{feed.status}</Text>
                    </View>
                  </View>

                  <View className="p-3">
                    <Text className="text-black dark:text-white font-semibold">{feed.name}</Text>
                    <Text className="text-gray-500 dark:text-gray-400 text-xs mt-1">Updated just now</Text>

                    {/* ------------ REPORT BUTTON ADDED HERE ------------- */}
                    <TouchableOpacity
                      onPress={() => handleReportPress(feed)}
                      className="mt-3 bg-purple-600 py-2 rounded-lg"
                    >
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

      {/* ---------- INCIDENT TYPE POPUP MODAL ---------- */}
      <Modal visible={reportModalVisible} transparent animationType="fade">
        <View className="flex-1 justify-center items-center bg-black/50">
          <View className="bg-white dark:bg-gray-800 p-6 rounded-xl w-72">
            <Text className="text-lg font-bold text-black dark:text-white mb-4">Select Incident Type</Text>

            <TouchableOpacity
              className="bg-purple-600 py-3 rounded-lg mb-3"
              onPress={() => submitReport("Theft")}
            >
              <Text className="text-center text-white font-semibold">Theft</Text>
            </TouchableOpacity>

            <TouchableOpacity
              className="bg-pink-600 py-3 rounded-lg"
              onPress={() => submitReport("Violence")}
            >
              <Text className="text-center text-white font-semibold">Violence</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setReportModalVisible(false)} className="mt-4">
              <Text className="text-center text-gray-600 dark:text-gray-300">Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ---------- CONFIRMATION MODAL ---------- */}
      <Modal visible={confirmModalVisible} transparent animationType="fade">
        <View className="flex-1 justify-center items-center bg-black/50">
          <View className="bg-white dark:bg-gray-800 p-6 rounded-xl w-72">
            <Text className="text-lg font-bold text-black dark:text-white mb-4">Report Submitted</Text>
            <Text className="text-gray-700 dark:text-gray-300 mb-4">
              Your report has been submitted to the relevant authority.
            </Text>

            <TouchableOpacity
              className="bg-purple-600 py-3 rounded-lg"
              onPress={() => setConfirmModalVisible(false)}
            >
              <Text className="text-center text-white font-semibold">OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default HomeScreen;
