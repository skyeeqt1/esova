import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../config/supabase';
import { hashPassword } from '../utils/password';

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
      // Hash the new password before storing it
      const hashedPassword = await hashPassword(newPassword);

      // Update the password and set must_change_password to false
      const { error } = await supabase
        .from('users')
        .update({
          password: hashedPassword,
          must_change_password: false,
        })
        .eq('id', voterData.id);

      if (error) throw error;

      Alert.alert('Success', 'Password changed successfully!', [
        {
          text: 'OK',
          onPress: () => {
            // Navigate to VoterScreen with updated voter data (no password in params)
            navigation.replace('VoterScreen', {
              voterData: { ...voterData, must_change_password: false },
            });
          },
        },
      ]);
    } catch {
      Alert.alert('Error', 'Failed to change password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-surface-950" edges={['top']}>
      <LinearGradient
        colors={['#1d2544', '#0a0f1a', '#06090f']}
        locations={[0, 0.5, 1]}
        className="absolute inset-0"
      />
      <View className="flex-1 items-center justify-center p-6">
        <View className="card w-full max-w-md p-6">
          {/* Header */}
          <View className="mb-6 items-center">
            <View className="mb-4 h-14 w-14 items-center justify-center rounded-2xl border border-accent-400/40 bg-surface-800">
              <Ionicons name="key-outline" size={24} color="#fbbf24" />
            </View>
            <Text className="text-center text-2xl font-semibold tracking-tight text-white">
              Create a new password
            </Text>
            <Text className="mt-2 text-center text-sm text-slate-400">
              You&apos;re logging in for the first time.{'\n'}Please set a password to continue.
            </Text>
          </View>

          {/* Current User Info */}
          <View className="mb-6 rounded-xl border border-white/[0.06] bg-surface-850 p-4">
            <View className="flex-row items-center">
              <View className="mr-3 h-10 w-10 items-center justify-center rounded-full bg-primary-500/20">
                <Ionicons name="person-outline" size={18} color="#a5b4fc" />
              </View>
              <View className="flex-1">
                <Text className="text-sm font-semibold text-white">{voterData?.name}</Text>
                <Text className="text-xs text-slate-500">ID: {voterData?.student_id}</Text>
              </View>
            </View>
          </View>

          {/* New Password Input */}
          <Text className="label">New Password</Text>
          <View className="mb-4 flex-row items-center rounded-xl border border-white/[0.08] bg-surface-850 focus-within:border-primary-500/60">
            <View className="pl-4">
              <Ionicons name="lock-closed-outline" size={18} color="#64748b" />
            </View>
            <TextInput
              placeholder="Enter new password"
              placeholderTextColor="#5b6472"
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry
              className="flex-1 px-3 py-3.5 text-base text-white"
            />
          </View>

          {/* Confirm Password Input */}
          <Text className="label">Confirm Password</Text>
          <View className="mb-6 flex-row items-center rounded-xl border border-white/[0.08] bg-surface-850 focus-within:border-primary-500/60">
            <View className="pl-4">
              <Ionicons name="lock-closed-outline" size={18} color="#64748b" />
            </View>
            <TextInput
              placeholder="Re-enter new password"
              placeholderTextColor="#5b6472"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              className="flex-1 px-3 py-3.5 text-base text-white"
            />
          </View>

          {/* Submit Button */}
          <TouchableOpacity
            onPress={handleChangePassword}
            disabled={loading}
            className="btn btn-primary">
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="checkmark-circle-outline" size={18} color="#fff" />
                <Text className="ml-2 text-[15px] font-semibold text-white">Save Password</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
};

export default ChangePasswordScreen;
