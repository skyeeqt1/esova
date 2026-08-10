import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
  ScrollView,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../../config/supabase';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as Clipboard from 'expo-clipboard';
import Papa from 'papaparse';
import { hashPassword } from '../../utils/password';

export const VoterSection = ({
  voters,
  handleDeleteItem,
  isProcessing,
  setIsProcessing,
  refreshData,
  adminEmail,
}: any) => {
  const navigation = useNavigation();

  // --- FORM STATES ---
  const [voterName, setVoterName] = useState('');
  const [voterID, setVoterID] = useState('');
  const [voterEmail, setVoterEmail] = useState('');
  const [voterPassword, setVoterPassword] = useState('');
  // Extra fields removed - keeping only: name, student_id, email, password

  // --- UI STATES ---
  const [searchQuery, setSearchQuery] = useState('');
  const [isRemoveModalVisible, setIsRemoveModalVisible] = useState(false);
  const [voterToRemove, setVoterToRemove] = useState<any>(null);
  const [removalReason, setRemovalReason] = useState('');
  const [isResetModalVisible, setIsResetModalVisible] = useState(false);
  const [voterToReset, setVoterToReset] = useState<any>(null);
  const [newResetPassword, setNewResetPassword] = useState('');
  const [isPasswordReset, setIsPasswordReset] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const scrollViewRef = useRef<ScrollView>(null);

  // Handle back button when modal is open using React Navigation events
  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (e) => {
      if (isRemoveModalVisible) {
        // Prevent default navigation and close modal instead
        e.preventDefault();
        setIsRemoveModalVisible(false);
        setRemovalReason('');
        setVoterToRemove(null);
      }
    });

    return unsubscribe;
  }, [navigation, isRemoveModalVisible]);

  // --- HANDLERS ---
  const handleAddVoter = async () => {
    if (!voterName.trim() || !voterID.trim() || !voterEmail.trim() || !voterPassword.trim()) {
      const msg = 'All fields are required';
      if (Platform.OS === 'web') {
        alert(msg);
      } else {
        Alert.alert('Required Fields', msg);
      }
      return;
    }

    setIsProcessing(true);
    try {
      // Add user directly to users table (NOT in Supabase Auth)
      // Password is stored in the table for student login
      const { error: dbError } = await supabase.from('users').insert({
        name: voterName.trim(),
        email: voterEmail.toLowerCase().trim(),
        student_id: voterID.trim(),
        role: 'voter',
        has_voted: false,
        ballot: null,
        voted_at: null,
        password: await hashPassword(voterPassword.trim()),
        must_change_password: true, // Force password change on first login
      });

      if (dbError) {
        console.error('Database error:', dbError);
        const errorMessage =
          dbError.code === '23505'
            ? 'This Student ID is already registered. Please use a different ID.'
            : dbError.message;
        if (Platform.OS === 'web') {
          alert(errorMessage);
        } else {
          Alert.alert('Error', errorMessage);
        }
        setIsProcessing(false);
        return;
      }

      // Log the voter addition
      const { error: logError } = await supabase.from('admin_logs').insert({
        action: 'ADD_VOTER',
        target_name: voterName.trim(),
        target_id: voterID.trim(),
        reason: `Student registered - Email: ${voterEmail.toLowerCase().trim()}`,
        admin_email: adminEmail,
        timestamp: new Date().toISOString(),
      });

      if (logError) {
        console.error('Failed to add log:', logError);
        if (Platform.OS === 'web') {
          alert('Log Error: ' + logError.message);
        } else {
          Alert.alert('Log Error', 'Could not add activity log: ' + logError.message);
        }
      }

      // Refresh logs to show new entry
      if (refreshData) {
        await refreshData();
      }

      setVoterName('');
      setVoterID('');
      setVoterEmail('');
      setVoterPassword('');
      setShowForm(false);

      const msg = `Student ${voterName} added successfully!`;
      if (Platform.OS === 'web') {
        alert(msg);
      } else {
        Alert.alert('Success', msg);
      }

      // Refresh data if function provided
      if (refreshData) {
        await refreshData();
      }
    } catch (e: any) {
      const errorMsg = e.message || 'An error occurred';
      if (Platform.OS === 'web') {
        alert(errorMsg);
      } else {
        Alert.alert('Error', errorMsg);
      }
    }
    setIsProcessing(false);
  };

  const generateAndResetPassword = async () => {
    // Generate a new random password
    const generatedPassword =
      Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-8).toUpperCase();
    setNewResetPassword(generatedPassword);
    setIsProcessing(true);

    try {
      // Update the password in the database and require password change
      const { error: dbError } = await supabase
        .from('users')
        .update({
          password: await hashPassword(generatedPassword),
          must_change_password: true, // Force password change on next login
        })
        .eq('id', voterToReset.id);

      if (dbError) {
        console.error('Database error:', dbError);
        if (Platform.OS === 'web') {
          alert(dbError.message);
        } else {
          Alert.alert('Error', dbError.message);
        }
        setIsProcessing(false);
        return;
      }

      // Log the password reset action (never store the generated password in logs)
      const { error: logError } = await supabase.from('admin_logs').insert({
        action: 'RESET_PASSWORD',
        target_name: voterToReset.name,
        target_id: voterToReset.student_id,
        reason: 'Password reset by admin',
        admin_email: adminEmail,
        timestamp: new Date().toISOString(),
      });

      if (logError) {
        console.error('Failed to add log:', logError);
      }

      // Refresh data
      if (refreshData) {
        await refreshData();
      }

      // Show the password with copy button
      setIsPasswordReset(true);
    } catch (e: any) {
      const errorMsg = e.message || 'An error occurred';
      if (Platform.OS === 'web') {
        alert(errorMsg);
      } else {
        Alert.alert('Error', errorMsg);
      }
    }
    setIsProcessing(false);
  };

  const handleFinalDelete = async () => {
    if (!removalReason.trim()) {
      if (Platform.OS === 'web') {
        alert('Reason is required');
      } else {
        Alert.alert('Error', 'Please provide a reason.');
      }
      return;
    }

    setIsProcessing(true);
    try {
      // 1. Log the deletion to admin_logs table
      const { error: logError } = await supabase.from('admin_logs').insert({
        action: 'DELETE_VOTER',
        target_name: voterToRemove.name,
        target_id: voterToRemove.student_id,
        reason: removalReason,
        admin_email: adminEmail,
        timestamp: new Date().toISOString(),
      });

      if (logError) {
        console.error('Log error:', logError);
      }

      // 2. Perform the actual deletion (pass extraData to skip duplicate confirmation)
      await handleDeleteItem('users', voterToRemove.id, {
        name: voterToRemove.name,
        studentId: voterToRemove.student_id,
        reason: removalReason,
      });

      // Refresh the voter list
      if (refreshData) {
        await refreshData();
      }

      setIsRemoveModalVisible(false);
      setVoterToRemove(null);
      setRemovalReason('');
    } catch (error) {
      console.error(error);
    }
    setIsProcessing(false);
  };

  // --- PASSWORD GENERATOR ---
  const generateRandomPassword = () => {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let password = '';
    for (let i = 0; i < 12; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setVoterPassword(password);
  };

  const handleImportCSV = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: 'text/csv' });
      if (result.canceled) return;

      setIsProcessing(true);
      const fileUri = result.assets[0].uri;
      const fileContent =
        Platform.OS === 'web' ? fileUri : await FileSystem.readAsStringAsync(fileUri);

      Papa.parse(fileContent, {
        header: true,
        skipEmptyLines: true,
        complete: async (results) => {
          const records = results.data as any[];
          for (let i = 0; i < records.length; i++) {
            const row = records[i];
            try {
              // Add directly to users table (NOT in Supabase Auth)
              const password = row.password || row.studentId || 'defaultPassword123';
              const { error: dbError } = await supabase.from('users').insert({
                name: row.fullname,
                email: row.email,
                student_id: row.studentId,
                role: 'voter',
                has_voted: false,
                password: await hashPassword(password),
                must_change_password: true, // Force password change on first login
              });

              if (dbError) {
                console.warn('DB error for:', row.email, dbError.message);
                if (dbError.code === '23505') {
                  console.warn('Skipped duplicate student ID:', row.studentId);
                }
              }
            } catch (err) {
              console.warn(err);
            }
          }

          // Log the bulk import
          const { error: logError } = await supabase.from('admin_logs').insert({
            action: 'IMPORT_VOTERS',
            target_name: `${records.length} students`,
            target_id: 'BULK_IMPORT',
            reason: `Bulk import from CSV file`,
            admin_email: adminEmail,
            timestamp: new Date().toISOString(),
          });

          if (logError) {
            console.error('Failed to add log:', logError);
          }

          setIsProcessing(false);
          Alert.alert('Complete', 'Import finished.');
        },
      });
    } catch {
      setIsProcessing(false);
    }
  };

  const initials = (name: string) =>
    name
      .split(' ')
      .map((part) => part[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();

  return (
    <ScrollView ref={scrollViewRef} showsVerticalScrollIndicator={false}>
      {/* HEADER: LIST SUMMARY + ADD ACTION */}
      <View className="mb-4 flex-row items-center justify-between">
        <View>
          <Text className="eyebrow">Voters</Text>
          <Text className="text-lg font-semibold text-white">{voters.length} registered</Text>
        </View>
        <TouchableOpacity
          onPress={() => setShowForm(true)}
          disabled={isProcessing}
          className="btn btn-primary px-4 py-2.5">
          <Ionicons name="add" size={16} color="#fff" />
          <Text className="ml-1.5 text-sm font-semibold text-white">Add Student</Text>
        </TouchableOpacity>
      </View>

      {/* SEARCH BAR */}
      <View className="mb-4 flex-row items-center rounded-xl border border-white/[0.08] bg-surface-850">
        <View className="pl-4">
          <Ionicons name="search-outline" size={16} color="#64748b" />
        </View>
        <TextInput
          placeholder="Search students..."
          placeholderTextColor="#5b6472"
          onChangeText={setSearchQuery}
          className="flex-1 px-3 py-3.5 text-base text-white"
        />
      </View>

      {/* VOTER LIST */}
      {voters
        .filter((v: any) => v.name?.toLowerCase().includes(searchQuery.toLowerCase()))
        .map((v: any) => (
          <TouchableOpacity
            key={v.id}
            onPress={() => {
              setVoterToReset(v);
              setIsResetModalVisible(true);
            }}
            activeOpacity={0.9}
            className="card mb-2.5 flex-row items-center p-4 active:scale-[0.98] active:bg-surface-750">
            <View className="mr-3 h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-primary-500/15">
              <Text className="text-xs font-bold text-primary-300">{initials(v.name)}</Text>
            </View>
            <View className="flex-1">
              <Text className="text-base font-semibold text-white" numberOfLines={1}>
                {v.name}
              </Text>
              <Text className="text-xs font-semibold uppercase tracking-eyebrow text-slate-500">
                {v.student_id}
              </Text>
            </View>
            <View
              className={`rounded-full border px-3 py-1 ${
                v.has_voted
                  ? 'border-emerald-500/25 bg-emerald-500/10'
                  : 'border-amber-500/25 bg-amber-500/10'
              }`}>
              <View className="flex-row items-center">
                <View
                  className={`mr-1.5 h-1.5 w-1.5 rounded-full ${
                    v.has_voted ? 'bg-emerald-400' : 'bg-amber-400'
                  }`}
                />
                <Text
                  className={`text-[11px] font-bold uppercase tracking-eyebrow ${
                    v.has_voted ? 'text-emerald-300' : 'text-amber-300'
                  }`}>
                  {v.has_voted ? 'Voted' : 'Pending'}
                </Text>
              </View>
            </View>
          </TouchableOpacity>
        ))}

      {voters.filter((v: any) => v.name?.toLowerCase().includes(searchQuery.toLowerCase()))
        .length === 0 && (
        <View className="items-center rounded-2xl border border-dashed border-white/[0.08] p-8">
          <Ionicons name="people-outline" size={28} color="#334155" />
          <Text className="mt-2 text-sm text-slate-500">No students found.</Text>
        </View>
      )}

      {/* ADD STUDENT FORM MODAL */}
      <Modal
        visible={showForm}
        animationType="slide"
        transparent
        onRequestClose={() => {
          setShowForm(false);
          setVoterName('');
          setVoterID('');
          setVoterEmail('');
          setVoterPassword('');
        }}>
        <View className="flex-1 justify-end bg-black/80">
          <View className="max-h-[92%] overflow-hidden !rounded-t-3xl border-white/[0.1] bg-surface-900">
            <View className="flex-row items-center justify-between border-b border-white/[0.06] p-5">
              <View>
                <Text className="eyebrow">Voter Registry</Text>
                <Text className="text-lg font-semibold text-white">Register student</Text>
              </View>
              <TouchableOpacity
                onPress={() => {
                  setShowForm(false);
                  setVoterName('');
                  setVoterID('');
                  setVoterEmail('');
                  setVoterPassword('');
                }}
                className="h-9 w-9 items-center justify-center rounded-full border border-white/[0.08] bg-surface-850">
                <Ionicons name="close" size={16} color="#94a3b8" />
              </TouchableOpacity>
            </View>

            <ScrollView className="p-5" showsVerticalScrollIndicator={false}>
              <Text className="label">Full Name</Text>
              <TextInput
                placeholder="Enter full name"
                placeholderTextColor="#5b6472"
                value={voterName}
                onChangeText={setVoterName}
                className="input mb-4"
              />
              <Text className="label">Student ID</Text>
              <TextInput
                placeholder="Enter student ID"
                placeholderTextColor="#5b6472"
                value={voterID}
                onChangeText={setVoterID}
                className="input mb-4"
              />
              <Text className="label">Email</Text>
              <TextInput
                placeholder="Enter email"
                placeholderTextColor="#5b6472"
                value={voterEmail}
                onChangeText={setVoterEmail}
                autoCapitalize="none"
                className="input mb-4"
              />

              <Text className="label">Temporary Password</Text>
              <View className="mb-5 flex-row items-center">
                <TextInput
                  placeholder="Enter password"
                  placeholderTextColor="#5b6472"
                  value={voterPassword}
                  onChangeText={setVoterPassword}
                  className="input mr-2 flex-1"
                />
                <TouchableOpacity
                  onPress={generateRandomPassword}
                  className="btn btn-accent px-4 py-3.5">
                  <Ionicons name="dice-outline" size={16} color="#08090d" />
                  <Text className="ml-1.5 text-xs font-bold text-black">GENERATE</Text>
                </TouchableOpacity>
              </View>

              <View className="flex-row gap-3">
                <TouchableOpacity
                  onPress={() => {
                    setShowForm(false);
                    setVoterName('');
                    setVoterID('');
                    setVoterEmail('');
                    setVoterPassword('');
                  }}
                  disabled={isProcessing}
                  className="btn btn-ghost flex-1">
                  <Text className="text-sm font-semibold text-slate-200">Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={handleAddVoter}
                  disabled={isProcessing}
                  className="btn btn-primary flex-1">
                  {isProcessing ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="person-add-outline" size={18} color="#fff" />
                      <Text className="ml-2 text-[15px] font-semibold text-white">Add Voter</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>

              <TouchableOpacity
                onPress={() => {
                  setShowForm(false);
                  setVoterName('');
                  setVoterID('');
                  setVoterEmail('');
                  setVoterPassword('');
                  handleImportCSV();
                }}
                disabled={isProcessing}
                className="btn btn-ghost mt-3">
                <Ionicons name="cloud-upload-outline" size={16} color="#a5b4fc" />
                <Text className="ml-2 text-sm font-semibold text-primary-200">
                  Import Students from CSV
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* REMOVAL MODAL */}
      <Modal
        visible={isRemoveModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setIsRemoveModalVisible(false);
          setRemovalReason('');
          setVoterToRemove(null);
        }}>
        <View className="flex-1 items-center justify-center bg-black/80 p-6">
          <View className="card w-full !rounded-3xl border-white/[0.1] p-6">
            <View className="mb-3 h-12 w-12 items-center justify-center rounded-2xl border border-rose-500/25 bg-rose-500/10">
              <Ionicons name="person-remove-outline" size={22} color="#fb7185" />
            </View>
            <Text className="mb-1 text-lg font-semibold text-white">
              Remove {voterToRemove?.name}?
            </Text>
            <Text className="mb-4 text-sm text-slate-400">
              Provide a reason for removal for the audit logs.
            </Text>
            <TextInput
              placeholder="e.g. Duplicate account, Transferred..."
              placeholderTextColor="#5b6472"
              value={removalReason}
              onChangeText={setRemovalReason}
              multiline
              className="input mb-6 h-24"
            />
            <View className="flex-row gap-3">
              <TouchableOpacity
                onPress={() => setIsRemoveModalVisible(false)}
                className="btn btn-ghost flex-1">
                <Text className="text-sm font-semibold text-slate-200">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleFinalDelete}
                className="btn flex-1 border border-rose-500/40 bg-rose-500/90 active:bg-rose-600">
                <Text className="text-sm font-semibold text-white">Confirm</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* RESET PASSWORD MODAL */}
      <Modal
        visible={isResetModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setIsResetModalVisible(false);
          setVoterToReset(null);
          setNewResetPassword('');
          setIsPasswordReset(false);
        }}>
        <View className="flex-1 items-center justify-center bg-black/80 p-6">
          <View className="card w-full !rounded-3xl border-white/[0.1] p-6">
            <View className="mb-4 items-center">
              <View className="mb-3 h-14 w-14 items-center justify-center rounded-2xl border border-primary-500/30 bg-primary-500/15">
                <Ionicons name="person-outline" size={24} color="#a5b4fc" />
              </View>
              <Text className="text-lg font-semibold text-white">{voterToReset?.name}</Text>
              <Text className="text-xs text-slate-500">
                ID: {voterToReset?.student_id} • {voterToReset?.email}
              </Text>
              <View
                className={`mt-3 rounded-full border px-3 py-1 ${
                  voterToReset?.has_voted
                    ? 'border-emerald-500/25 bg-emerald-500/10'
                    : 'border-amber-500/25 bg-amber-500/10'
                }`}>
                <Text
                  className={`text-[11px] font-bold uppercase tracking-eyebrow ${
                    voterToReset?.has_voted ? 'text-emerald-300' : 'text-amber-300'
                  }`}>
                  {voterToReset?.has_voted ? 'Voted' : 'Pending'}
                </Text>
              </View>
            </View>

            {!isPasswordReset ? (
              <>
                <Text className="mb-5 text-center text-sm text-slate-400">
                  Generate a new password. The old password will be invalidated.
                </Text>

                <View className="flex-row gap-3">
                  <TouchableOpacity
                    onPress={() => {
                      setIsResetModalVisible(false);
                      setVoterToReset(null);
                      setNewResetPassword('');
                      setIsPasswordReset(false);
                    }}
                    className="btn btn-ghost flex-1">
                    <Text className="text-sm font-semibold text-slate-200">Close</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={generateAndResetPassword}
                    disabled={isProcessing}
                    className="btn btn-primary flex-1">
                    {isProcessing ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <>
                        <Ionicons name="refresh-outline" size={16} color="#fff" />
                        <Text className="ml-1.5 text-sm font-semibold text-white">Reset</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
                <TouchableOpacity
                  onPress={() => {
                    setIsResetModalVisible(false);
                    setVoterToRemove(voterToReset);
                    setIsRemoveModalVisible(true);
                  }}
                  className="btn btn-danger mt-3">
                  <Ionicons name="trash-outline" size={16} color="#fb7185" />
                  <Text className="ml-1.5 text-sm font-semibold text-rose-300">Remove Voter</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                {/* Password Generated View - After Reset */}
                <View className="mb-2 flex-row items-center justify-center">
                  <Ionicons name="checkmark-circle" size={18} color="#34d399" />
                  <Text className="ml-2 text-base font-semibold text-white">Password reset!</Text>
                </View>
                <Text className="mb-4 text-center text-sm text-slate-400">
                  Share this new password with{' '}
                  <Text className="font-semibold text-white">{voterToReset?.name}</Text>.
                </Text>

                {/* Generated Password Display */}
                <View className="mb-5 rounded-xl border border-accent-400/25 bg-accent-400/[0.06] p-4">
                  <View className="mb-2 flex-row items-center justify-between">
                    <Text className="text-[11px] font-semibold uppercase tracking-eyebrow text-accent-400">
                      New Password
                    </Text>
                    <TouchableOpacity
                      onPress={async () => {
                        await Clipboard.setStringAsync(newResetPassword);
                        if (Platform.OS === 'web') {
                          alert('Password copied to clipboard!');
                        } else {
                          Alert.alert('Copied', 'Password copied to clipboard!');
                        }
                      }}
                      className="flex-row items-center rounded-lg border border-accent-400/30 bg-accent-400/10 px-2.5 py-1">
                      <Ionicons name="copy-outline" size={13} color="#fbbf24" />
                      <Text className="ml-1 text-xs font-bold text-accent-400">COPY</Text>
                    </TouchableOpacity>
                  </View>
                  <Text className="text-center font-mono text-xl font-semibold tracking-widest text-accent-400">
                    {newResetPassword}
                  </Text>
                </View>

                <TouchableOpacity
                  onPress={() => {
                    setIsResetModalVisible(false);
                    setVoterToReset(null);
                    setNewResetPassword('');
                    setIsPasswordReset(false);
                  }}
                  className="btn btn-ghost">
                  <Text className="text-sm font-semibold text-slate-200">Close</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
};
