import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, ActivityIndicator, ImageBackground, Image } from 'react-native';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../config/firebase';

const LoginScreen = ({ navigation }: any) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) return Alert.alert("Required", "Please enter your credentials.");
    
    setLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const userDoc = await getDoc(doc(db, "users", userCredential.user.uid));
      
      if (userDoc.exists()) {
        const userData = userDoc.data();
        if (userData.role === 'admin') {
          navigation.replace('AdminDashboard');
        } else {
          navigation.replace('VoterScreen');
        }
      } else {
        Alert.alert("Access Denied", "No student record found for this account.");
      }
    } catch (error: any) {
      let msg = "Login failed. Please check your internet connection.";
      if (error.code === 'auth/wrong-password') msg = "Invalid password.";
      if (error.code === 'auth/user-not-found') msg = "Email not registered.";
      
      Alert.alert("Auth Error", msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ImageBackground
      source={require("../img/tg.jpg")}
      resizeMode="cover"
      className="flex-1"
    >
      <View className="flex-1 bg-black/60 justify-center px-8">
        
        <View className="items-center mb-10">
          <View className="bg-white rounded-full border-2 border-[#f1c40f] mb-4">
             <Image
                source={require("../img/escrlogo.png")}
                className="w-40 h-40"
                resizeMode="contain"
              />
          </View>
          <Text className="text-gray-400 text-[30px] font-bold tracking-[3px] uppercase mt-1 pb-2">
            ESOVA
          </Text>
          <Text className="text-[#f1c40f] text-4xl font-black italic tracking-tighter">
            VOTING<Text className="text-white">PORTAL</Text>
          </Text>
        </View>

        <View className="space-y-4">
          <View>
            <Text className="text-white text-[10px] font-bold uppercase mb-2 ml-1">Student Email</Text>
            <TextInput 
              placeholder="E-mail" 
              placeholderTextColor="#555"
              autoCapitalize="none"
              keyboardType="email-address"
              className="bg-[#1a1a1a] text-white p-4 rounded-xl border-b-2 border-gray-800 focus:border-[#f1c40f]"
              value={email}
              onChangeText={setEmail}
            />
          </View>

          <View>
            <Text className="text-white text-[10px] font-bold uppercase mb-2 ml-1">Password</Text>
            <TextInput 
              placeholder="Password" 
              placeholderTextColor="#555"
              secureTextEntry
              className="bg-[#1a1a1a] text-white p-4 rounded-xl border-b-2 border-gray-800 focus:border-[#f1c40f]"
              value={password}
              onChangeText={setPassword}
            />
          </View>

          <TouchableOpacity 
            onPress={handleLogin}
            disabled={loading}
            className="bg-[#f1c40f] p-4 rounded-xl mt-6 border-b-4 border-yellow-700 active:bg-yellow-500 shadow-lg shadow-yellow-500/20"
          >
            {loading ? (
              <ActivityIndicator color="#000" />
            ) : (
              <Text className="text-black text-center font-black text-lg uppercase italic">Enter System</Text>
            )}
          </TouchableOpacity>

          <View className="items-center mt-8">
             <Text className="text-[#e74c3c] text-[10px] font-bold uppercase tracking-widest">
                Authorized Personnel Only
             </Text>
          </View>
        </View>

      </View>
    </ImageBackground>
  );
};

export default LoginScreen;