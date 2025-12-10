import React, { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, ScrollView, Image } from "react-native";
import { MapPin, Camera, AlertTriangle, ArrowLeft, Send } from "lucide-react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { cssInterop } from "nativewind";

cssInterop(LinearGradient, { className: "style" });

const ReportScreen = () => {
  const router = useRouter();
  const [incidentType, setIncidentType] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");

  const incidentTypes = [
    { id: "theft", label: "Theft/Burglary", icon: "🛡️" },
    { id: "violence", label: "Violence/Assault", icon: "👊" },
  ];

  return (
    <View className="flex-1 bg-white dark:bg-gray-900">
      {/* Header */}
      <LinearGradient colors={["#7A288A", "#C51077"]} className="px-4 pt-12 pb-6 rounded-b-3xl">
        <View className="flex-row items-center">
          <TouchableOpacity onPress={() => router.back()}>
            <ArrowLeft color="white" size={24} />
          </TouchableOpacity>
          <Text className="text-white text-2xl font-bold ml-4">Report Incident</Text>
        </View>
        <Text className="text-white text-sm mt-2 opacity-90">Manually report a security incident</Text>
      </LinearGradient>

      <ScrollView className="flex-1 mx-4 mt-6">
        {/* Location Section */}
        <View className="bg-gray-50 dark:bg-gray-800 rounded-xl p-4 mb-6">
          <View className="flex-row items-center mb-3">
            <MapPin color="#7A288A" size={20} />
            <Text className="text-black dark:text-white font-bold ml-2">Location</Text>
          </View>
          <TextInput
            className="bg-white dark:bg-gray-700 rounded-lg p-3 text-black dark:text-white border border-gray-200 dark:border-gray-600"
            placeholder="Enter incident location"
            placeholderTextColor="#9CA3AF"
            value={location}
            onChangeText={setLocation}
          />
          <View className="mt-4 h-48 bg-gray-200 dark:bg-gray-700 rounded-lg overflow-hidden">
            <Image
              source={{ uri: "https://images.unsplash.com/photo-1577086664693-894d8405334a?w=900&auto=format&fit=crop&q=60" }}
              className="w-full h-full"
            />
          </View>
          <TouchableOpacity className="mt-3">
            <Text className="text-purple-600 dark:text-purple-400 text-center font-medium">Use Current Location</Text>
          </TouchableOpacity>
        </View>

        {/* Incident Type */}
        <View className="mb-6">
          <View className="flex-row items-center mb-3">
            <AlertTriangle color="#7A288A" size={20} />
            <Text className="text-black dark:text-white font-bold ml-2">Incident Type</Text>
          </View>
          <View className="flex-row flex-wrap gap-3">
            {incidentTypes.map(type => (
              <TouchableOpacity
                key={type.id}
                className={`basis-[48%] bg-white dark:bg-gray-800 rounded-lg p-3 items-center border ${
                  incidentType === type.id ? "border-purple-600 bg-purple-50 dark:bg-purple-900/50" : "border-gray-200 dark:border-gray-700"
                }`}
                onPress={() => setIncidentType(type.id)}
              >
                <Text className="text-2xl mb-1">{type.icon}</Text>
                <Text className="text-black dark:text-white text-center text-sm">{type.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Description */}
        <View className="mb-6">
          <View className="flex-row items-center mb-3">
            <Camera color="#7A288A" size={20} />
            <Text className="text-black dark:text-white font-bold ml-2">Description</Text>
          </View>
          <TextInput
            className="bg-white dark:bg-gray-800 rounded-lg p-3 text-black dark:text-white border border-gray-200 dark:border-gray-700 h-32"
            placeholder="Describe the incident in detail..."
            placeholderTextColor="#9CA3AF"
            multiline
            textAlignVertical="top"
            value={description}
            onChangeText={setDescription}
          />
        </View>

        {/* Evidence Attachment */}
        <View className="mb-8">
          <Text className="text-black dark:text-white font-bold mb-3">Attach Evidence</Text>
          <View className="flex-row gap-3">
            <TouchableOpacity className="bg-gray-100 dark:bg-gray-800 rounded-lg h-24 w-24 items-center justify-center border-2 border-dashed border-gray-300 dark:border-gray-600">
              <Camera color="#7A288A" size={24} />
              <Text className="text-gray-500 dark:text-gray-400 text-xs mt-1">Photo</Text>
            </TouchableOpacity>
            <TouchableOpacity className="bg-gray-100 dark:bg-gray-800 rounded-lg h-24 w-24 items-center justify-center border-2 border-dashed border-gray-300 dark:border-gray-600">
              <Camera color="#7A288A" size={24} />
              <Text className="text-gray-500 dark:text-gray-400 text-xs mt-1">Video</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Submit Button */}
        <TouchableOpacity
          className={`py-4 rounded-xl items-center mb-8 ${incidentType && location ? "bg-gradient-to-r from-purple-600 to-pink-600" : "bg-gray-300 dark:bg-gray-700"}`}
          disabled={!incidentType || !location}
        >
          <View className="flex-row items-center">
            <Send color="white" size={20} />
            <Text className="text-white font-bold ml-2">Submit Report</Text>
          </View>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

export default ReportScreen;
