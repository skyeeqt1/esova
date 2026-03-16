import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, ActivityIndicator, Image, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../config/firebase';

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

  const handleLogin = async () => {
    if (isLockedOut) {
      Alert.alert("Account Temporarily Locked", `Too many failed attempts. Please wait ${timeLeft} before trying again.`);
      return;
    }
    
    if (!email || !password) return Alert.alert("Required", "Please enter your email and password.");
    
    setLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const userDoc = await getDoc(doc(db, "users", userCredential.user.uid));
      
      if (userDoc.exists()) {
        const userData = userDoc.data();
        setFailedAttempts(0);
        setLockoutEndTime(null);
        if (userData.role === 'admin') {
          navigation.replace('AdminDashboard');
        } else {
          navigation.replace('VoterScreen');
        }
      } else {
        handleFailedAttempt();
        Alert.alert("Access Denied", "No student record found for this account.");
      }
    } catch (error: any) {
      handleFailedAttempt();
      let msg = "Login failed. Please check your internet connection.";
      if (error.code === 'auth/wrong-password') msg = "Invalid password.";
      if (error.code === 'auth/user-not-found') msg = "Email not registered.";
      
      Alert.alert("Auth Error", msg);
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
        "Too Many Failed Attempts", 
        "You have exceeded the maximum number of login attempts. Please wait 30 seconds before trying again.",
        [{ text: "OK" }]
      );
    } else {
      const remainingAttempts = 5 - newAttempts;
      Alert.alert(
        "Login Failed", 
        `Invalid credentials. You have ${remainingAttempts} attempt${remainingAttempts !== 1 ? 's' : ''} remaining before being locked out.`,
        [{ text: "OK" }]
      );
    }
  };

  return (
    <View className="flex-1 bg-[#1a1a1a]">
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} showsVerticalScrollIndicator={false}>
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1 }}
        >
          {/* Header Section */}
          <View className="pt-16 pb-8 px-6 items-center">
            <View className="bg-white rounded-full border-4 border-[#f1c40f] mb-4 shadow-lg shadow-yellow-500/20">
              <Image
                source={require("../img/escrlogo.png")}
                className="w-36 h-36"
                resizeMode="contain"
              />
            </View>
            <Text className="text-[#f1c40f] text-3xl font-black italic tracking-tighter">
              E-SOVA
            </Text>
            <Text className="text-gray-400 text-sm font-medium mt-1">
              ESCR Student Organization Voting Application
            </Text>
          </View>

          {/* Login Form Card */}
          <View className="flex-1 px-6">
            <View className="bg-[#252525] rounded-3xl p-6 border border-gray-800 shadow-xl">
              <Text className="text-white text-xl font-bold mb-1">Welcome Back</Text>
              <Text className="text-gray-500 text-sm mb-6">Please sign in to continue</Text>

              {/* Email Field */}
              <View className="mb-4">
                <Text className="text-gray-400 text-xs font-bold uppercase mb-2 ml-1">Email Address</Text>
                <View className="bg-[#1a1a1a] rounded-xl border border-gray-700 flex-row items-center">
                  <View className="px-3">
                    <Text className="text-gray-500">📧</Text>
                  </View>
                  <TextInput 
                    placeholder="Enter your email"
                    placeholderTextColor="#555"
                    autoCapitalize="none"
                    keyboardType="email-address"
                    className="flex-1 text-white p-4"
                    value={email}
                    onChangeText={setEmail}
                  />
                </View>
              </View>

              {/* Password Field */}
              <View className="mb-6">
                <Text className="text-gray-400 text-xs font-bold uppercase mb-2 ml-1">Password</Text>
                <View className="bg-[#1a1a1a] rounded-xl border border-gray-700 flex-row items-center">
                  <View className="px-3">
                    <Text className="text-gray-500">🔒</Text>
                  </View>
                  <TextInput 
                    placeholder="Enter your password"
                    placeholderTextColor="#555"
                    secureTextEntry={!showPassword}
                    className="flex-1 text-white p-4"
                    value={password}
                    onChangeText={setPassword}
                  />
                  <TouchableOpacity 
                    onPress={() => setShowPassword(!showPassword)}
                    className="px-3"
                  >
                    <Text className="text-gray-500">{showPassword ? '👁️' : '👁️‍🗨️'}</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Login Button */}
              <TouchableOpacity 
                onPress={handleLogin}
                disabled={loading || isLockedOut}
                className={`bg-[#f1c40f] p-4 rounded-xl border-b-4 border-yellow-700 active:bg-yellow-500 shadow-lg shadow-yellow-500/20 ${isLockedOut ? 'opacity-50' : ''}`}
              >
                {loading ? (
                  <ActivityIndicator color="#000" />
                ) : isLockedOut ? (
                  <Text className="text-black text-center font-black text-lg uppercase italic">Locked ({timeLeft})</Text>
                ) : (
                  <Text className="text-black text-center font-black text-lg uppercase italic">Sign In</Text>
                )}
              </TouchableOpacity>

              {/* Attempts Warning */}
              {failedAttempts > 0 && !isLockedOut && (
                <View className="items-center mt-4">
                  <Text className="text-yellow-500 text-xs font-bold">
                    {5 - failedAttempts} attempt{5 - failedAttempts !== 1 ? 's' : ''} remaining
                  </Text>
                </View>
              )}

              {/* Lockout Message */}
              {isLockedOut && (
                <View className="items-center mt-4 bg-red-500/20 p-3 rounded-xl">
                  <Text className="text-red-500 text-xs font-bold text-center">
                    Too many failed attempts.{'\n'}Please wait {timeLeft} to try again.
                  </Text>
                </View>
              )}
            </View>

            {/* Footer */}
            <View className="items-center mt-8 mb-8">
              <View className="bg-red-500/10 px-4 py-2 rounded-full border border-red-500/20">
                <Text className="text-red-500 text-[10px] font-bold uppercase tracking-widest">
                  🔒 Authorized Personnel Only
                </Text>
              </View>
              <Text className="text-gray-600 text-xs mt-4">
                Secure Student Voting System
              </Text>
            </View>
          </View>
        </KeyboardAvoidingView>
      </ScrollView>
    </View>
  );
};

export default LoginScreen;
