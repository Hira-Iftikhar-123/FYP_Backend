import React, { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, ScrollView, Image } from "react-native";
import { Bell, AlertTriangle, Camera, MapPin, ArrowLeft, X } from "lucide-react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { cssInterop } from "nativewind";
import { WS_BASE_URL } from "../config"; // <--- ADDED IMPORT

cssInterop(LinearGradient, { className: "style" });

const AlertsScreen = () => {
  const router = useRouter();
  const [filter, setFilter] = useState("all");
  // Change alerts to a state so we can update it with WebSocket data
  const [alerts, setAlerts] = useState([
    // Hardcoded Alerts (Initial Data)
    {
      id: 1,
      type: "theft",
      title: "Unauthorized Access Detected",
      description: "Person detected in restricted area near warehouse entrance",
      time: "2 mins ago",
      priority: "high",
      location: "Warehouse Entrance",
      camera: "CAM-04",
      image: "https://images.unsplash.com/photo-1633265486064-086b219458ec?w=900&auto=format&fit=crop&q=60",
    },
    {
      id: 2,
      type: "violence",
      title: "Potential Assault Detected",
      description: "Aggressive behavior identified in parking lot area",
      time: "15 mins ago",
      priority: "critical",
      location: "Parking Lot - Level B2",
      camera: "CAM-02",
      image: "https://images.unsplash.com/photo-1485827404703-89b55fcc595e?w=900&auto=format&fit=crop&q=60",
    },
  ]);
  
  // --- WEBSOCKET CONNECTION LOGIC ---
  useEffect(() => {
    const ws = new WebSocket(`${WS_BASE_URL}/ws`);

    ws.onopen = () => {
      console.log("WebSocket connection opened to /ws");
    };

    ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        
        // Assuming the data received from the model matches the Alert structure
        const newAlert = {
          id: data.alert_id || Date.now(),
          type: data.incident_type || "theft",
          title: data.title || "MODEL ALERT: New Incident",
          description: data.message || "Model detected an incident.",
          time: "just now",
          priority: data.priority || "critical",
          location: data.location || "Unknown Location",
          camera: data.camera_id || "CAM-XX",
          image: data.media_url || "https://placeholder.com/image", 
        };

        // Add the new alert to the state
        setAlerts(prevAlerts => [newAlert, ...prevAlerts]); 
      } catch (error) {
        console.error("Error parsing WebSocket message:", error);
      }
    };

    ws.onerror = (e) => {
      console.error("WebSocket error:", e.message);
    };

    ws.onclose = (e) => {
      console.log("WebSocket closed:", e.code, e.reason);
    };

    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, []); 
  // ------------------------------------

  const filteredAlerts = filter === "all" ? alerts : alerts.filter(a => a.type === filter);

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "critical": return "bg-red-500";
      case "high": return "bg-orange-500";
      case "medium": return "bg-yellow-500";
      default: return "bg-gray-500";
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "theft": return "🛡️";
      case "violence": return "👊";
      default: return "🔔";
    }
  };

  return (
    <View className="flex-1 bg-white dark:bg-gray-900">
      {/* Header */}
      <LinearGradient colors={["#7A288A", "#C51077"]} className="px-4 pt-12 pb-6 rounded-b-3xl">
        <View className="flex-row items-center">
          <TouchableOpacity onPress={() => router.back()}>
            <ArrowLeft color="white" size={24} />
          </TouchableOpacity>
          <Text className="text-white text-2xl font-bold ml-4">Security Alerts</Text>
        </View>
        <Text className="text-white text-sm mt-2 opacity-90">{filteredAlerts.length} active alerts</Text>
      </LinearGradient>

      {/* Filters */}
      <View className="mx-4 mt-6">
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View className="flex-row gap-2 pb-2">
            {["all", "theft", "violence"].map(item => (
              <TouchableOpacity
                key={item}
                className={`px-4 py-2 rounded-full ${filter === item ? "bg-purple-600" : "bg-gray-100 dark:bg-gray-800"}`}
                onPress={() => setFilter(item)}
              >
                <Text className={filter === item ? "text-white font-medium capitalize" : "text-gray-700 dark:text-gray-300 capitalize"}>
                  {item === "all" ? "All Alerts" : item}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </View>

      {/* Alerts List */}
      <ScrollView className="flex-1 mx-4 mt-4 mb-4">
        {filteredAlerts.map(alert => (
          <View key={alert.id} className="bg-white dark:bg-gray-800 rounded-xl shadow mb-4 overflow-hidden">
            <View className={`h-2 ${getPriorityColor(alert.priority)}`} />
            <View className="p-4">
              <View className="flex-row justify-between items-start">
                <View className="flex-row items-center">
                  <Text className="text-2xl mr-2">{getTypeIcon(alert.type)}</Text>
                  <View>
                    <Text className="text-black dark:text-white font-bold">{alert.title}</Text>
                    <Text className="text-gray-500 dark:text-gray-400 text-sm">{alert.time}</Text>
                  </View>
                </View>
                <TouchableOpacity>
                  <X color="#9CA3AF" size={20} />
                </TouchableOpacity>
              </View>
              <Text className="text-gray-700 dark:text-gray-300 mt-3">{alert.description}</Text>
              <View className="flex-row mt-3">
                <View className="flex-row items-center mr-4">
                  <MapPin color="#7A288A" size={16} />
                  <Text className="text-purple-600 dark:text-purple-400 text-sm ml-1">{alert.location}</Text>
                </View>
                <View className="flex-row items-center">
                  <Camera color="#7A288A" size={16} />
                  <Text className="text-purple-600 dark:text-purple-400 text-sm ml-1">{alert.camera}</Text>
                </View>
              </View>
              <View className="mt-3 h-40 rounded-lg overflow-hidden">
                <Image source={{ uri: alert.image }} className="w-full h-full" />
              </View>
              <View className="flex-row mt-4">
                <TouchableOpacity className="flex-1 bg-purple-100 dark:bg-purple-900/50 py-3 rounded-lg items-center mr-2">
                  <Text className="text-purple-700 dark:text-purple-300 font-medium">Acknowledge</Text>
                </TouchableOpacity>
                <TouchableOpacity className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 py-3 rounded-lg items-center">
                  <Text className="text-white font-medium">Take Action</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        ))}

        {filteredAlerts.length === 0 && (
          <View className="items-center justify-center mt-12">
            <Bell color="#7A288A" size={48} />
            <Text className="text-black dark:text-white text-lg font-medium mt-4">No alerts found</Text>
            <Text className="text-gray-500 dark:text-gray-400 mt-2">There are no alerts matching your filter criteria</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

export default AlertsScreen;