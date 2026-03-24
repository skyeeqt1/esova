import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { supabase } from '../config/supabase';

const ChangePasswordScreen = ({ navigation, route }: any) => {
  const voterData = route.params?.voterData;
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChangePassword = async () => {
    if (!newPassword || !confirmPassword) {
      Alert.alert("Required", "Please enter and confirm your new password.");
      return;
    }

    if (newPassword.length < 6) {
      Alert.alert("Weak Password", "Password must be at least 6 characters.");
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert("Mismatch", "Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      // Update the password and set must_change_password to false
      const { error } = await supabase
        .from('users')
        .update({ 
          password: newPassword,
          must_change_password: false 
        })
        .eq('id', voterData.id);

      if (error) throw error;

      Alert.alert("Success", "Password changed successfully!", [
        {
          text: "OK",
          onPress: () => {
            // Navigate to VoterScreen with updated voter data
            navigation.replace('VoterScreen', { 
              voterData: { ...voterData, password: newPassword, must_change_password: false } 
            });
          }
        }
      ]);
    } catch (error: any) {
      Alert.alert("Error", "Failed to change password. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View className="flex-1 bg-[#1a1a1a] justify-center items-center p-6">
      <View className="bg-[#1e1e1e] w-full p-6 rounded-3xl border border-[#f1c40f]">
        {/* Header */}
        <View className="items-center mb-6">
          <Text className="text-[#f1c40f] text-lg font-black text-center">CHANGE PASSWORD</Text>
          <Text className="text-gray-500 text-xs mt-2 text-center">
            You are logging in for the first time.{'\n'}Please create a new password to continue.
          </Text>
        </View>

        {/* Current User Info */}
        <View className="bg-black/50 p-4 rounded-xl mb-6">
          <Text className="text-gray-500 text-[10px] uppercase font-bold">Logged in as</Text>
          <Text className="text-white font-bold">{voterData?.name}</Text>
          <Text className="text-gray-500 text-xs">ID: {voterData?.student_id}</Text>
        </View>

        {/* New Password Input */}
        <TextInput
          placeholder="New Password"
          placeholderTextColor="#444"
          value={newPassword}
          onChangeText={setNewPassword}
          secureTextEntry
          className="bg-[#121212] text-white p-4 rounded-xl mb-4 border border-gray-800"
        />

        {/* Confirm Password Input */}
        <TextInput
          placeholder="Confirm New Password"
          placeholderTextColor="#444"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry
          className="bg-[#121212] text-white p-4 rounded-xl mb-6 border border-gray-800"
        />

        {/* Submit Button */}
        <TouchableOpacity
          onPress={handleChangePassword}
          disabled={loading}
          className="bg-[#f1c40f] p-4 rounded-xl"
        >
          {loading ? (
            <ActivityIndicator color="black" />
          ) : (
            <Text className="text-black text-center font-black text-lg uppercase italic">
              Save Password
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default ChangePasswordScreen;