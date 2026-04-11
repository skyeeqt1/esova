import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../config/supabase';

const ChangePasswordScreen = ({ navigation, route }: any) => {
  const voterData = route.params?.voterData;
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChangePassword = async () => {
    if (!newPassword || !confirmPassword) {
      Alert.alert('Required', 'Please enter and confirm your new password.');
      return;
    }

    if (newPassword.length < 6) {
      Alert.alert('Weak Password', 'Password must be at least 6 characters.');
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert('Mismatch', 'Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      // Update the password and set must_change_password to false
      const { error } = await supabase
        .from('users')
        .update({
          password: newPassword,
          must_change_password: false,
        })
        .eq('id', voterData.id);

      if (error) throw error;

      Alert.alert('Success', 'Password changed successfully!', [
        {
          text: 'OK',
          onPress: () => {
            // Navigate to VoterScreen with updated voter data
            navigation.replace('VoterScreen', {
              voterData: { ...voterData, password: newPassword, must_change_password: false },
            });
          },
        },
      ]);
    } catch (error: any) {
      Alert.alert('Error', 'Failed to change password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 items-center justify-center bg-[#1a1a1a] p-6" edges={['top']}>
      <View className="w-full rounded-3xl border border-[#f1c40f] bg-[#1e1e1e] p-6">
        {/* Header */}
        <View className="mb-6 items-center">
          <Text className="text-center text-2xl font-black text-[#f1c40f]">CHANGE PASSWORD</Text>
          <Text className="mt-2 text-center text-base text-gray-500">
            You are logging in for the first time.{'\n'}Please create a new password to continue.
          </Text>
        </View>

        {/* Current User Info */}
        <View className="mb-6 rounded-xl bg-black/50 p-4">
          <Text className="text-base font-bold uppercase text-gray-500">Logged in as</Text>
          <Text className="text-xl font-bold text-white">{voterData?.name}</Text>
          <Text className="text-base text-gray-500">ID: {voterData?.student_id}</Text>
        </View>

        {/* New Password Input */}
        <TextInput
          placeholder="New Password"
          placeholderTextColor="#444"
          value={newPassword}
          onChangeText={setNewPassword}
          secureTextEntry
          className="mb-4 rounded-xl border border-gray-800 bg-[#121212] p-4 text-lg text-white"
        />

        {/* Confirm Password Input */}
        <TextInput
          placeholder="Confirm New Password"
          placeholderTextColor="#444"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry
          className="mb-6 rounded-xl border border-gray-800 bg-[#121212] p-4 text-lg text-white"
        />

        {/* Submit Button */}
        <TouchableOpacity
          onPress={handleChangePassword}
          disabled={loading}
          className="rounded-xl bg-[#f1c40f] p-4">
          {loading ? (
            <ActivityIndicator color="black" />
          ) : (
            <Text className="text-center text-xl font-black uppercase italic text-black">
              Save Password
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

export default ChangePasswordScreen;
