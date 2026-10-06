import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../config/supabase';
import { verifyPassword } from '../utils/password';
import GradientButton from '../components/GradientButton';

const NETWORK_TIMEOUT_MS = 15000;

/** Rejects if the network request doesn't settle in time, so the button
 *  never stays stuck on a spinner when the connection hangs. */
const withTimeout = <T,>(promise: PromiseLike<T>, ms: number = NETWORK_TIMEOUT_MS): Promise<T> =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('NETWORK_TIMEOUT')), ms);
    Promise.resolve(promise).then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });

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

  // Time-based lockout check — refreshed every second by the countdown interval above
  // eslint-disable-next-line react-hooks/purity
  const isLockedOut = lockoutEndTime !== null && lockoutEndTime > Date.now();

  const checkAdminUser = async (userEmail: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: userEmail,
      password,
    });

    if (!error && data.user) {
      return { isAdmin: true, user: data.user };
    }

    if (error?.message?.includes('Invalid login credentials')) {
      return { isAdmin: false, user: null };
    }

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

      const isEmail = userInput.includes('@');
      let adminCheck = null;

      if (isEmail) {
        adminCheck = await withTimeout(checkAdminUser(userInput, password));
      }

      if (isEmail && adminCheck?.isAdmin) {
        setFailedAttempts(0);
        setLockoutEndTime(null);
        navigation.replace('AdminDashboard', { adminEmail: userInput });
        setLoading(false);
        return;
      }

      let userData = null;
      let userError = null;

      if (isEmail) {
        const result = await withTimeout(
          supabase.from('users').select('*').eq('email', userInput).single()
        );
        userData = result.data;
        userError = result.error;
      } else {
        const result = await withTimeout(
          supabase.from('users').select('*').eq('student_id', userInput).single()
        );
        userData = result.data;
        userError = result.error;
      }

      if (userError || !userData) {
        handleFailedAttempt();
        Alert.alert('Access Denied', 'Email or Student ID not registered.');
        setLoading(false);
        return;
      }

      const isPasswordValid = await verifyPassword(userData.password, password);
      if (!isPasswordValid) {
        handleFailedAttempt();
        Alert.alert('Access Denied', 'Invalid password.');
        setLoading(false);
        return;
      }

      if (userData.must_change_password) {
        setFailedAttempts(0);
        setLockoutEndTime(null);
        navigation.replace('ChangePassword', { voterData: userData });
        setLoading(false);
        return;
      }

      setFailedAttempts(0);
      setLockoutEndTime(null);

      navigation.replace('VoterScreen', { voterData: userData });
    } catch (error: any) {
      if (error?.message === 'NETWORK_TIMEOUT') {
        // Don't count network hangs as a failed login attempt
        Alert.alert(
          'Connection Timed Out',
          'The server took too long to respond. Please check your internet connection and try again.'
        );
      } else {
        handleFailedAttempt();
        Alert.alert('Error', 'Login failed. Please check your internet connection.');
      }
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
    <SafeAreaView className="flex-1 bg-surface-950" edges={['top']}>
      <LinearGradient
        colors={['#1d2544', '#0a0f1a', '#06090f']}
        locations={[0, 0.45, 1]}
        className="absolute inset-0"
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}>
          {/* Header Section */}
          <View className="items-center px-6 pb-8 pt-14">
            <View className="mb-5 h-24 w-24 items-center justify-center rounded-[30px] border border-white/[0.1] bg-surface-800">
              <Image
                source={require('../assets/logo.png')}
                className="h-16 w-16"
                resizeMode="contain"
              />
            </View>
            <Text className="text-4xl font-bold tracking-tight text-white">
              E-SOVA
              <Text className="text-amber-400">.</Text>
            </Text>
            <Text className="mt-2 text-center text-sm text-slate-400">
              ESCR Student Organization
              {'\n'}Voting Application
            </Text>
          </View>

          {/* Login Form Card */}
          <View className="flex-1 px-6">
            <View className="card p-6">
              <Text className="text-xl font-semibold text-white">Welcome back</Text>
              <Text className="mb-6 mt-1 text-sm text-slate-400">
                Sign in with your email or student ID to continue.
              </Text>

              {/* Email Field */}
              <View className="mb-4">
                <Text className="label">Email or Student ID</Text>
                <View className="flex-row items-center rounded-xl border border-white/[0.08] bg-surface-850 focus-within:border-violet-500/60">
                  <View className="pl-4">
                    <Ionicons name="mail-outline" size={18} color="#64748b" />
                  </View>
                  <TextInput
                    placeholder="Enter your email or Student ID"
                    placeholderTextColor="#5b6472"
                    autoCapitalize="none"
                    keyboardType="email-address"
                    className="flex-1 px-3 py-3.5 text-base text-white"
                    value={email}
                    onChangeText={setEmail}
                  />
                </View>
              </View>

              {/* Password Field */}
              <View className="mb-6">
                <Text className="label">Password</Text>
                <View className="flex-row items-center rounded-xl border border-white/[0.08] bg-surface-850 focus-within:border-violet-500/60">
                  <View className="pl-4">
                    <Ionicons name="lock-closed-outline" size={18} color="#64748b" />
                  </View>
                  <TextInput
                    placeholder="Enter your password"
                    placeholderTextColor="#5b6472"
                    secureTextEntry={!showPassword}
                    className="flex-1 px-3 py-3.5 text-base text-white"
                    value={password}
                    onChangeText={setPassword}
                  />
                  <TouchableOpacity onPress={() => setShowPassword(!showPassword)} className="px-4">
                    <Ionicons
                      name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                      size={18}
                      color="#64748b"
                    />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Login Button */}
              <GradientButton
                onPress={handleLogin}
                disabled={loading || isLockedOut}
                loading={loading}
                label={isLockedOut ? `Locked (${timeLeft})` : 'Sign In'}
                icon={isLockedOut ? 'timer-outline' : 'log-in-outline'}
              />

              {/* Attempts Warning */}
              {failedAttempts > 0 && !isLockedOut && (
                <View className="mt-4 flex-row items-center justify-center rounded-xl border border-amber-500/20 bg-amber-500/10 p-3">
                  <Ionicons name="warning-outline" size={16} color="#fbbf24" />
                  <Text className="ml-2 text-sm font-semibold text-amber-300">
                    {5 - failedAttempts} attempt{5 - failedAttempts !== 1 ? 's' : ''} remaining
                  </Text>
                </View>
              )}

              {/* Lockout Message */}
              {isLockedOut && (
                <View className="mt-4 items-center rounded-xl border border-rose-500/20 bg-rose-500/10 p-3">
                  <Ionicons name="lock-closed" size={16} color="#fb7185" />
                  <Text className="mt-1 text-center text-sm font-semibold text-rose-300">
                    Too many failed attempts. Please wait {timeLeft} to try again.
                  </Text>
                </View>
              )}
            </View>

            {/* Footer */}
            <View className="mb-8 mt-8 items-center">
              <View className="flex-row items-center gap-2">
                <Ionicons name="shield-checkmark-outline" size={14} color="#64748b" />
                <Text className="text-xs font-semibold text-slate-500">
                  Secure & Confidential Voting
                </Text>
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

export default LoginScreen;
