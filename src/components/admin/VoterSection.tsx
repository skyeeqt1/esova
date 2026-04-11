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
  Clipboard,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../../config/supabase';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import Papa from 'papaparse';

interface FilePickerResult {
  assets: Array<{ uri: string }>;
  canceled: boolean;
}

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
  const [importProgress, setImportProgress] = useState('');
  const [isRemoveModalVisible, setIsRemoveModalVisible] = useState(false);
  const [voterToRemove, setVoterToRemove] = useState<any>(null);
  const [removalReason, setRemovalReason] = useState('');
  const [isResetModalVisible, setIsResetModalVisible] = useState(false);
  const [voterToReset, setVoterToReset] = useState<any>(null);
  const [newResetPassword, setNewResetPassword] = useState('');
  const [isPasswordReset, setIsPasswordReset] = useState(false);

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
      Platform.OS === 'web' ? alert(msg) : Alert.alert('Required Fields', msg);
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
        password: voterPassword.trim(), // Store password in table
        must_change_password: true, // Force password change on first login
      });

      if (dbError) {
        console.error('Database error:', dbError);
        const errorMessage =
          dbError.code === '23505'
            ? 'This Student ID is already registered. Please use a different ID.'
            : dbError.message;
        Platform.OS === 'web' ? alert(errorMessage) : Alert.alert('Error', errorMessage);
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
        Platform.OS === 'web'
          ? alert('Log Error: ' + logError.message)
          : Alert.alert('Log Error', 'Could not add activity log: ' + logError.message);
      }

      // Refresh logs to show new entry
      if (refreshData) {
        await refreshData();
      }

      setVoterName('');
      setVoterID('');
      setVoterEmail('');
      setVoterPassword('');

      const msg = `Student ${voterName} added successfully!`;
      Platform.OS === 'web' ? alert(msg) : Alert.alert('Success', msg);

      // Refresh data if function provided
      if (refreshData) {
        await refreshData();
      }
    } catch (e: any) {
      const errorMsg = e.message || 'An error occurred';
      Platform.OS === 'web' ? alert(errorMsg) : Alert.alert('Error', errorMsg);
    }
    setIsProcessing(false);
  };

  const confirmDelete = (voter: any) => {
    setVoterToRemove(voter);
    setIsRemoveModalVisible(true);
  };

  const confirmReset = (voter: any) => {
    setVoterToReset(voter);
    setIsResetModalVisible(true);
    setIsPasswordReset(false); // Reset state to show confirmation first
    setNewResetPassword('');
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
          password: generatedPassword,
          must_change_password: true, // Force password change on next login
        })
        .eq('id', voterToReset.id);

      if (dbError) {
        console.error('Database error:', dbError);
        Platform.OS === 'web' ? alert(dbError.message) : Alert.alert('Error', dbError.message);
        setIsProcessing(false);
        return;
      }

      // Log the password reset action
      const { error: logError } = await supabase.from('admin_logs').insert({
        action: 'RESET_PASSWORD',
        target_name: voterToReset.name,
        target_id: voterToReset.student_id,
        reason: `Password reset by admin. New password: ${generatedPassword}`,
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
      Platform.OS === 'web' ? alert(errorMsg) : Alert.alert('Error', errorMsg);
    }
    setIsProcessing(false);
  };

  const handleFinalDelete = async () => {
    if (!removalReason.trim()) {
      Platform.OS === 'web'
        ? alert('Reason is required')
        : Alert.alert('Error', 'Please provide a reason.');
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
            setImportProgress(`Importing ${i + 1}/${records.length}`);
            try {
              // Add directly to users table (NOT in Supabase Auth)
              const password = row.password || row.studentId || 'defaultPassword123';
              const { error: dbError } = await supabase.from('users').insert({
                name: row.fullname,
                email: row.email,
                student_id: row.studentId,
                role: 'voter',
                has_voted: false,
                password: password,
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
          setImportProgress('');
          Alert.alert('Complete', 'Import finished.');
        },
      });
    } catch (e) {
      setIsProcessing(false);
    }
  };

  return (
    <ScrollView ref={scrollViewRef} showsVerticalScrollIndicator={false}>
      {/* ADD STUDENT FORM */}
      <View className="mb-6 rounded-2xl border border-gray-800 bg-[#1e1e1e] p-5">
        <Text className="mb-4 text-lg font-bold uppercase tracking-widest text-[#00b894]">
          Register Student
        </Text>
        <TextInput
          placeholder="Full Name"
          placeholderTextColor="#444"
          value={voterName}
          onChangeText={setVoterName}
          className="mb-3 rounded-lg border border-gray-800 bg-[#121212] p-4 text-lg text-white"
        />
        <View className="mb-3 flex-row gap-2">
          <TextInput
            placeholder="Student ID"
            placeholderTextColor="#444"
            value={voterID}
            onChangeText={setVoterID}
            className="flex-1 rounded-lg border border-gray-800 bg-[#121212] p-4 text-lg text-white"
          />
          <TextInput
            placeholder="Email"
            placeholderTextColor="#444"
            value={voterEmail}
            onChangeText={setVoterEmail}
            className="flex-1 rounded-lg border border-gray-800 bg-[#121212] p-4 text-lg text-white"
          />
        </View>
        <View className="mb-4 flex-row gap-2">
          <TextInput
            placeholder="Password"
            placeholderTextColor="#444"
            value={voterPassword}
            onChangeText={setVoterPassword}
            className="flex-1 rounded-lg border border-gray-800 bg-[#121212] p-4 text-lg text-white"
          />
          <TouchableOpacity
            onPress={generateRandomPassword}
            className="items-center justify-center rounded-lg bg-[#f1c40f] px-4">
            <Text className="text-base font-bold text-black">GENERATE</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          onPress={handleAddVoter}
          disabled={isProcessing}
          className="items-center rounded-xl bg-[#00b894] p-4">
          {isProcessing ? (
            <ActivityIndicator color="black" />
          ) : (
            <Text className="text-base font-bold uppercase text-black">Add Voter</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* SEARCH BAR */}
      <TextInput
        placeholder="Search students..."
        placeholderTextColor="#444"
        onChangeText={setSearchQuery}
        className="mb-4 rounded-xl border border-gray-800 bg-[#1e1e1e] p-4 text-lg text-white"
      />

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
            className="mb-2 flex-row items-center rounded-xl border border-gray-800 bg-[#1e1e1e] p-4">
            <View className="flex-1">
              <Text className="text-xl font-bold text-white" numberOfLines={1}>
                {v.name}
              </Text>
              <Text className="text-base font-bold uppercase text-gray-500">{v.student_id}</Text>
            </View>
            <View
              className={`rounded px-3 py-1 ${v.has_voted ? 'bg-green-500/20' : 'bg-yellow-500/10'}`}>
              <Text
                className={`text-sm font-bold ${v.has_voted ? 'text-green-500' : 'text-yellow-600'}`}>
                {v.has_voted ? 'VOTED' : 'PENDING'}
              </Text>
            </View>
          </TouchableOpacity>
        ))}

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
          <View className="w-full rounded-3xl border border-gray-800 bg-[#1e1e1e] p-6">
            <Text className="mb-2 text-2xl font-bold text-white">
              Remove {voterToRemove?.name}?
            </Text>
            <Text className="mb-4 text-base text-gray-500">
              Provide a reason for removal for the audit logs.
            </Text>
            <TextInput
              placeholder="e.g. Duplicate account, Transferred..."
              placeholderTextColor="#444"
              value={removalReason}
              onChangeText={setRemovalReason}
              multiline
              className="mb-6 h-24 rounded-xl border border-gray-800 bg-[#121212] p-4 text-lg text-white"
            />
            <View className="flex-row gap-3">
              <TouchableOpacity
                onPress={() => setIsRemoveModalVisible(false)}
                className="flex-1 items-center rounded-xl bg-gray-800 p-4">
                <Text className="text-lg text-white">Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleFinalDelete}
                className="flex-1 items-center rounded-xl bg-red-600 p-4">
                <Text className="text-lg font-bold text-white">Confirm</Text>
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
          <View className="w-full rounded-3xl border border-gray-800 bg-[#1e1e1e] p-6">
            <Text className="mb-4 text-center text-3xl font-bold text-white">
              {voterToReset?.name}
            </Text>
            <Text className="mb-1 text-center text-lg text-gray-400">
              ID: {voterToReset?.student_id}
            </Text>
            <Text className="mb-1 text-center text-lg text-gray-400">
              Email: {voterToReset?.email}
            </Text>
            <View
              className={`mx-auto mb-6 mt-2 rounded-full px-4 py-1 ${voterToReset?.has_voted ? 'bg-green-500/20' : 'bg-yellow-500/10'}`}>
              <Text
                className={`text-base font-bold ${voterToReset?.has_voted ? 'text-green-500' : 'text-yellow-600'}`}>
                {voterToReset?.has_voted ? 'VOTED' : 'PENDING'}
              </Text>
            </View>

            {!isPasswordReset ? (
              <>
                <Text className="mb-4 text-base text-gray-500">
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
                    className="flex-1 items-center rounded-xl bg-gray-800 p-4">
                    <Text className="text-lg text-white">Close</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={generateAndResetPassword}
                    className="flex-1 items-center rounded-xl bg-[#f1c40f] p-4">
                    <Text className="text-lg font-bold text-black">Reset</Text>
                  </TouchableOpacity>
                </View>
                <TouchableOpacity
                  onPress={() => {
                    setIsResetModalVisible(false);
                    setVoterToRemove(voterToReset);
                    setIsRemoveModalVisible(true);
                  }}
                  className="mt-3 items-center rounded-xl border border-red-500 bg-red-500/10 p-4">
                  <Text className="text-lg font-bold text-red-500">Remove Voter</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                {/* Password Generated View - After Reset */}
                <Text className="mb-2 text-2xl font-bold text-white">Password Reset!</Text>
                <Text className="mb-4 text-base text-gray-500">
                  Password for <Text className="font-bold text-white">{voterToReset?.name}</Text>{' '}
                  has been reset successfully.
                </Text>

                {/* Generated Password Display */}
                <View className="mb-4 rounded-xl border border-gray-800 bg-[#121212] p-4">
                  <View className="mb-2 flex-row items-center justify-between">
                    <Text className="text-base font-bold uppercase text-gray-500">
                      New Password
                    </Text>
                    <TouchableOpacity
                      onPress={() => {
                        Clipboard.setString(newResetPassword);
                        Platform.OS === 'web'
                          ? alert('Password copied to clipboard!')
                          : Alert.alert('Copied', 'Password copied to clipboard!');
                      }}
                      className="rounded bg-[#f1c40f]/20 px-3 py-1">
                      <Text className="text-base font-bold text-[#f1c40f]">COPY</Text>
                    </TouchableOpacity>
                  </View>
                  <Text className="text-center text-2xl font-bold tracking-widest text-[#f1c40f]">
                    {newResetPassword}
                  </Text>
                </View>

                <Text className="mb-6 text-base text-gray-500">
                  Make sure to share this new password with the student.
                </Text>

                <TouchableOpacity
                  onPress={() => {
                    setIsResetModalVisible(false);
                    setVoterToReset(null);
                    setNewResetPassword('');
                    setIsPasswordReset(false);
                  }}
                  className="items-center rounded-xl bg-gray-800 p-4">
                  <Text className="text-lg text-white">Close</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
};
