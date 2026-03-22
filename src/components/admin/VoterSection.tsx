import React, { useState, useRef, useEffect } from 'react';
import { 
  View, Text, TextInput, TouchableOpacity, ActivityIndicator, 
  Alert, Platform, ScrollView, Modal
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

export const VoterSection = ({ voters, handleDeleteItem, isProcessing, setIsProcessing, refreshData }: any) => {
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
      const msg = "All fields are required";
      Platform.OS === 'web' ? alert(msg) : Alert.alert("Required Fields", msg);
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
        role: "voter",
        has_voted: false,
        ballot: null,
        voted_at: null,
        password: voterPassword.trim() // Store password in table
      });

      if (dbError) {
        console.error('Database error:', dbError);
        Platform.OS === 'web' ? alert(dbError.message) : Alert.alert("Error", dbError.message);
        setIsProcessing(false);
        return;
      }

      // Log the voter addition
      const { error: logError } = await supabase.from('admin_logs').insert({
        action: "ADD_VOTER",
        target_name: voterName.trim(),
        target_id: voterID.trim(),
        reason: `Student registered - Email: ${voterEmail.toLowerCase().trim()}`,
        timestamp: new Date().toISOString(),
      });
      
      if (logError) {
        console.error('Failed to add log:', logError);
        Platform.OS === 'web' ? alert("Log Error: " + logError.message) : Alert.alert("Log Error", "Could not add activity log: " + logError.message);
      }
      
      // Refresh logs to show new entry
      if (refreshData) {
        await refreshData();
      }

      setVoterName(''); setVoterID(''); setVoterEmail(''); setVoterPassword('');

      const msg = `Student ${voterName} added successfully!`;
      Platform.OS === 'web' ? alert(msg) : Alert.alert("Success", msg);
      
      // Refresh data if function provided
      if (refreshData) {
        await refreshData();
      }
    } catch (e: any) {
      const errorMsg = e.message || "An error occurred";
      Platform.OS === 'web' ? alert(errorMsg) : Alert.alert("Error", errorMsg);
    }
    setIsProcessing(false);
  };

  const confirmDelete = (voter: any) => {
    setVoterToRemove(voter);
    setIsRemoveModalVisible(true);
  };

  const handleFinalDelete = async () => {
    if (!removalReason.trim()) {
      Platform.OS === 'web' ? alert("Reason is required") : Alert.alert("Error", "Please provide a reason.");
      return;
    }

    setIsProcessing(true);
    try {
      // 1. Log the deletion to admin_logs table
      const { error: logError } = await supabase.from('admin_logs').insert({
        action: "DELETE_VOTER",
        target_name: voterToRemove.name,
        target_id: voterToRemove.student_id,
        reason: removalReason,
        timestamp: new Date().toISOString(),
      });

      if (logError) {
        console.error('Log error:', logError);
      }

      // 2. Perform the actual deletion
      await handleDeleteItem("users", voterToRemove.id);
      
      setIsRemoveModalVisible(false);
      setVoterToRemove(null);
      setRemovalReason('');
      
      Platform.OS === 'web' ? alert("Removed successfully") : Alert.alert("Success", "Voter removed.");
    } catch (error) {
      console.error(error);
    }
    setIsProcessing(false);
  };

  const handleImportCSV = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: 'text/csv' });
      if (result.canceled) return;

      setIsProcessing(true);
      const fileUri = result.assets[0].uri;
      const fileContent = Platform.OS === 'web' ? fileUri : await FileSystem.readAsStringAsync(fileUri);

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
                role: "voter",
                has_voted: false,
                password: password,
              });

              if (dbError) {
                console.warn('DB error for:', row.email, dbError.message);
              }
            } catch (err) { 
              console.warn(err); 
            }
          }
          
          // Log the bulk import
          const { error: logError } = await supabase.from('admin_logs').insert({
            action: "IMPORT_VOTERS",
            target_name: `${records.length} students`,
            target_id: "BULK_IMPORT",
            reason: `Bulk import from CSV file`,
            timestamp: new Date().toISOString(),
          });
          
          if (logError) {
            console.error('Failed to add log:', logError);
          }
          
          setIsProcessing(false);
          setImportProgress('');
          Alert.alert("Complete", "Import finished.");
        }
      });
    } catch (e) { 
      setIsProcessing(false); 
    }
  };

  return (
    <ScrollView ref={scrollViewRef} showsVerticalScrollIndicator={false}>
      {/* ADD STUDENT FORM */}
      <View className="bg-[#1e1e1e] p-5 rounded-2xl border border-gray-800 mb-6">
        <Text className="text-[#00b894] font-bold mb-4 uppercase tracking-widest text-xs">Register Student</Text>
        <TextInput placeholder="Full Name" placeholderTextColor="#444" value={voterName} onChangeText={setVoterName} className="bg-[#121212] text-white p-3 rounded-lg mb-3 border border-gray-800" />
        <View className="flex-row gap-2 mb-3">
          <TextInput placeholder="Student ID" placeholderTextColor="#444" value={voterID} onChangeText={setVoterID} className="flex-1 bg-[#121212] text-white p-3 rounded-lg border border-gray-800" />
          <TextInput placeholder="Email" placeholderTextColor="#444" value={voterEmail} onChangeText={setVoterEmail} className="flex-1 bg-[#121212] text-white p-3 rounded-lg border border-gray-800" />
        </View>
        <TextInput placeholder="Password" placeholderTextColor="#444" value={voterPassword} onChangeText={setVoterPassword} secureTextEntry className="bg-[#121212] text-white p-3 rounded-lg mb-4 border border-gray-800" />
        
        <TouchableOpacity onPress={handleAddVoter} disabled={isProcessing} className="bg-[#00b894] p-4 rounded-xl items-center">
          {isProcessing ? <ActivityIndicator color="black" /> : <Text className="text-black font-bold uppercase">Add Voter</Text>}
        </TouchableOpacity>
      </View>

      {/* CSV IMPORT */}

      {/* SEARCH BAR */}
      <TextInput placeholder="Search students..." placeholderTextColor="#444" onChangeText={setSearchQuery} className="bg-[#1e1e1e] text-white p-4 rounded-xl border border-gray-800 mb-4" />

      {/* VOTER LIST */}
      {voters.filter((v: any) => v.name?.toLowerCase().includes(searchQuery.toLowerCase())).map((v: any) => (
        <View key={v.id} className="bg-[#1e1e1e] p-4 rounded-xl mb-2 border border-gray-800 flex-row items-center">
          <View className="flex-1">
            <Text className="text-white font-bold">{v.name}</Text>
            <Text className="text-gray-500 text-[10px] uppercase font-bold">{v.student_id}</Text>
          </View>
          <View className={`px-2 py-1 rounded mr-3 ${v.has_voted ? 'bg-green-500/20' : 'bg-yellow-500/10'}`}>
            <Text className={`text-[8px] font-bold ${v.has_voted ? 'text-green-500' : 'text-yellow-600'}`}>{v.has_voted ? 'VOTED' : 'PENDING'}</Text>
          </View>
          <TouchableOpacity onPress={() => confirmDelete(v)} className="bg-red-500/10 p-2 rounded">
            <Text className="text-red-500 text-xs font-bold">REMOVE</Text>
          </TouchableOpacity>
        </View>
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
        }}
      >
        <View className="flex-1 justify-center items-center bg-black/80 p-6">
          <View className="bg-[#1e1e1e] w-full p-6 rounded-3xl border border-gray-800">
            <Text className="text-white text-xl font-bold mb-2">Remove {voterToRemove?.name}?</Text>
            <Text className="text-gray-500 text-xs mb-4">Provide a reason for removal for the audit logs.</Text>
            <TextInput 
              placeholder="e.g. Duplicate account, Transferred..." 
              placeholderTextColor="#444" 
              value={removalReason} 
              onChangeText={setRemovalReason}                 
              multiline
              className="bg-[#121212] text-white p-4 rounded-xl mb-6 border border-gray-800 h-24"
            />
            <View className="flex-row gap-3">
              <TouchableOpacity onPress={() => setIsRemoveModalVisible(false)} className="flex-1 p-4 rounded-xl bg-gray-800 items-center"><Text className="text-white">Cancel</Text></TouchableOpacity>
              <TouchableOpacity onPress={handleFinalDelete} className="flex-1 p-4 rounded-xl bg-red-600 items-center"><Text className="text-white font-bold">Confirm</Text></TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
};
