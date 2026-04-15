import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../config/supabase';

const LoginScreen = ({ navigation }: any) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutEndTime, setLockoutEndTime] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (lockoutEndTime) {
      const interval = setInterval(() => {
        const now = Date.now();
        if (lockoutEndTime <= now) {
          setLockoutEndTime(null);
          setFailedAttempts(0);
          setTimeLeft('');
          clearInterval(interval);
        } else {
          const remaining = Math.ceil((lockoutEndTime - now) / 1000);
          const seconds = remaining % 60;
          setTimeLeft(`0:${seconds.toString().padStart(2, '0')}`);
        }
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [lockoutEndTime]);

  const isLockedOut = lockoutEndTime !== null && lockoutEndTime > Date.now();

  // Check if user is admin by trying Supabase Auth login
  const checkAdminUser = async (userEmail: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: userEmail,
      password,
    });

    // If auth succeeds, user is an admin
    if (!error && data.user) {
      return { isAdmin: true, user: data.user };
    }

    // If auth failed with invalid credentials, user might be a voter
    if (error?.message?.includes('Invalid login credentials')) {
      return { isAdmin: false, user: null };
    }

    // Other errors - return the error
    throw error;
  };

  const handleLogin = async () => {
    if (isLockedOut) {
      Alert.alert(
        'Account Temporarily Locked',
        `Too many failed attempts. Please wait ${timeLeft} before trying again.`
      );
      return;
    }

    if (!email || !password)
      return Alert.alert('Required', 'Please enter your email or student ID and password.');

    setLoading(true);
    try {
      const userInput = email.toLowerCase().trim();

      // Check if admin by trying Supabase Auth first (only if it looks like an email)
      const isEmail = userInput.includes('@');
      let adminCheck = null;

      if (isEmail) {
        adminCheck = await checkAdminUser(userInput, password);
      }

      if (isEmail && adminCheck?.isAdmin) {
        // Admin login successful
        setFailedAttempts(0);
        setLockoutEndTime(null);
        navigation.replace('AdminDashboard', { adminEmail: userInput });
        setLoading(false);
        return;
      }

      // Student login - verify against users table (NOT Supabase Auth)
      // Try to find by email OR student_id
      let userData = null;
      let userError = null;

      if (isEmail) {
        // If it looks like an email, search by email
        const result = await supabase.from('users').select('*').eq('email', userInput).single();
        userData = result.data;
        userError = result.error;
      } else {
        // Otherwise search by student_id
        const result = await supabase
          .from('users')
          .select('*')
          .eq('student_id', userInput)
          .single();
        userData = result.data;
        userError = result.error;
      }

      if (userError || !userData) {
        handleFailedAttempt();
        Alert.alert('Access Denied', 'Email or Student ID not registered.');
        setLoading(false);
        return;
      }

      // Verify password against stored password
      if (userData.password !== password) {
        handleFailedAttempt();
        Alert.alert('Access Denied', 'Invalid password.');
        setLoading(false);
        return;
      }

      // Check if user needs to change password (first time login)
      if (userData.must_change_password) {
        setFailedAttempts(0);
        setLockoutEndTime(null);
        // Navigate to password change screen first
        navigation.replace('ChangePassword', { voterData: userData });
        setLoading(false);
        return;
      }

      setFailedAttempts(0);
      setLockoutEndTime(null);

      // Regular voter - go to VoterScreen with user data
      navigation.replace('VoterScreen', { voterData: userData });
    } catch (error: any) {
      handleFailedAttempt();
      Alert.alert('Error', 'Login failed. Please check your internet connection.');
    } finally {
      setLoading(false);
    }
  };

  const handleFailedAttempt = () => {
    const newAttempts = failedAttempts + 1;
    setFailedAttempts(newAttempts);

    if (newAttempts >= 5) {
      const lockoutTime = Date.now() + 30000;
      setLockoutEndTime(lockoutTime);
      Alert.alert(
        'Too Many Failed Attempts',
        'You have exceeded the maximum number of login attempts. Please wait 30 seconds before trying again.',
        [{ text: 'OK' }]
      );
    } else {
      const remainingAttempts = 5 - newAttempts;
      Alert.alert(
        'Login Failed',
        `Invalid credentials. You have ${remainingAttempts} attempt${remainingAttempts !== 1 ? 's' : ''} remaining before being locked out.`,
        [{ text: 'OK' }]
      );
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-[#1a1a1a]" edges={['top']}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}>
          {/* Header Section */}
          <View className="items-center px-6 pb-8 pt-16">
            <View className="mb-4 rounded-full border-4 border-[#f1c40f] bg-white shadow-lg shadow-yellow-500/20">
              <Image
                source={require('../assets/logo.png')}
                className="h-36 w-36"
                resizeMode="contain"
              />
            </View>
<Text className="text-3xl sm:text-5xl font-black italic tracking-tighter text-[#f1c40f]">
              E-SOVA
            </Text>
            <Text className="mt-1 text-lg font-medium text-gray-400">
              ESCR Student Organization Voting Application
            </Text>
          </View>

          {/* Login Form Card */}
          <View className="flex-1 px-6">
            <View className="rounded-3xl border border-gray-800 bg-[#252525] p-6 shadow-xl">
            <Text className="text-xl sm:text-2xl font-bold text-white">
              Welcome Back
            </Text>
            <Text className="mb-6 text-base text-gray-500">Please sign in to continue</Text>

              {/* Email Field */}
              <View className="mb-4">
                <Text className="mb-2 ml-1 text-base font-bold uppercase text-gray-400">
                  Email Address
                </Text>
                <View className="flex-row items-center rounded-xl border border-gray-700 bg-[#1a1a1a]">
                  <View className="px-3">
                    <Text className="text-xl text-gray-500">📧</Text>
                  </View>
                  <TextInput
                    placeholder="Enter your email or Student ID"
                    placeholderTextColor="#555"
                    autoCapitalize="none"
                    keyboardType="email-address"
                    className="flex-1 p-4 text-base sm:text-lg text-white"
                    value={email}
                    onChangeText={setEmail}
                  />
                </View>
              </View>

              {/* Password Field */}
              <View className="mb-6">
                <Text className="mb-2 ml-1 text-base font-bold uppercase text-gray-400">
                  Password
                </Text>
                <View className="flex-row items-center rounded-xl border border-gray-700 bg-[#1a1a1a]">
                  <View className="px-3">
                    <Text className="text-xl text-gray-500">🔒</Text>
                  </View>
                  <TextInput
                    placeholder="Enter your password"
                    placeholderTextColor="#555"
                    secureTextEntry={!showPassword}
                    className="flex-1 p-4 text-base sm:text-lg text-white"
                    value={password}
                    onChangeText={setPassword}
                  />
                  <TouchableOpacity onPress={() => setShowPassword(!showPassword)} className="px-3">
                    <Text className="text-xl text-gray-500">{showPassword ? '👁️' : '👁️‍🗨️'}</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Login Button */}
              <TouchableOpacity
                onPress={handleLogin}
                disabled={loading || isLockedOut}
                className={`rounded-xl border-b-4 border-yellow-700 bg-[#f1c40f] p-4 shadow-lg shadow-yellow-500/20 active:bg-yellow-500 ${isLockedOut ? 'opacity-50' : ''}`}>
                {loading ? (
                  <ActivityIndicator color="#000" />
                ) : isLockedOut ? (
                  <Text className="text-center text-xl font-black uppercase italic text-black">
                    Locked ({timeLeft})
                  </Text>
                ) : (
                  <Text className="text-center text-xl font-black uppercase italic text-black">
                    Sign In
                  </Text>
                )}
              </TouchableOpacity>

              {/* Attempts Warning */}
              {failedAttempts > 0 && !isLockedOut && (
                <View className="mt-4 items-center">
                  <Text className="text-base font-bold text-yellow-500">
                    {5 - failedAttempts} attempt{5 - failedAttempts !== 1 ? 's' : ''} remaining
                  </Text>
                </View>
              )}

              {/* Lockout Message */}
              {isLockedOut && (
                <View className="mt-4 items-center rounded-xl bg-red-500/20 p-3">
                  <Text className="text-center text-base font-bold text-red-500">
                    Too many failed attempts.{'\n'}Please wait {timeLeft} to try again.
                  </Text>
                </View>
              )}
            </View>

            {/* Footer */}
            <View className="mb-8 mt-8 items-center">
              <View className="rounded-full border border-red-500/20 bg-red-500/10 px-4 py-2">
                <Text className="text-base font-bold uppercase tracking-widest text-red-500">
                  🔒 Authorized Personnel Only
                </Text>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </ScrollView>
    </SafeAreaView>
  );
};

export default LoginScreen;
