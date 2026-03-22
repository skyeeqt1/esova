import React, { useState, useMemo, useEffect } from 'react';
import { 
  View, Text, TextInput, TouchableOpacity, Image, 
  ScrollView, ActivityIndicator, Platform, Modal, Alert, BackHandler
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy'; 
import { decode } from 'base64-arraybuffer';

// Configs
import { supabase } from '../../config/supabase';

// Shared Hooks/Data
import { DEFAULT_AVATAR, POSITIONS } from '../../hooks/useAdminData';

// Callback to refresh data from parent
interface Props {
  candidates: any[];
  handleDeleteItem: any;
  isProcessing: boolean;
  setIsProcessing: any;
  onRefresh?: () => void;
}

export const CandidateSection = ({ candidates, handleDeleteItem, isProcessing, setIsProcessing, refreshData }: any) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedCandidate, setSelectedCandidate] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const initialState = {
    name: '', course: '', year: '', block: '', 
    age: '', gender: '', background: '', position: 'President'
  };
  
  const [form, setForm] = useState(initialState);
  const [candImage, setCandImage] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<any>(null);

  // Handle back button to close modal instead of going back
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (selectedCandidate) {
        setSelectedCandidate(null); // Close the modal
        return true; // Prevent default back button behavior
      }
      return false;
    });

    return () => backHandler.remove();
  }, [selectedCandidate]);

  // --- SEARCH LOGIC ---
  const filteredCandidates = useMemo(() => {
    return candidates.filter((c: any) => 
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.position.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [searchTerm, candidates]);

  // --- STORAGE UPLOAD ---
  const uploadToSupabase = async (uri: string) => {
    try {
      const fileName = `profile_${Date.now()}.png`;
      const filePath = `candidates/${fileName}`;
      let body;
      
      if (Platform.OS === 'web') {
        body = imageFile; 
      } else {
        const base64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' });
        body = decode(base64);
      }

      const { data, error } = await supabase.storage
        .from('candidate-images')
        .upload(filePath, body, { contentType: 'image/png', upsert: true });

      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from('candidate-images').getPublicUrl(filePath);
      return publicUrl;
    } catch (err: any) {
      throw new Error(err.message || "Upload failed.");
    }
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return Alert.alert("Denied", "Gallery access needed.");

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'], 
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.3,
    });

    if (!result.canceled) {
      const selectedUri = result.assets[0].uri;
      setCandImage(selectedUri);
      if (Platform.OS === 'web') {
        const response = await fetch(selectedUri);
        setImageFile(await response.blob());
      }
    }
  };

  const handleSave = async () => {
    if (!form.name || !form.course) return Alert.alert("Error", "Name and Course are required.");
    setIsProcessing(true);
    try {
      let finalImageUrl = candImage || DEFAULT_AVATAR;
      const isNewLocalFile = candImage && (candImage.startsWith('file:') || candImage.startsWith('content:') || candImage.startsWith('ph:'));

      if (isNewLocalFile) finalImageUrl = await uploadToSupabase(candImage);

      const payload = { ...form, image: finalImageUrl };
      
      if (editingId) {
        // Update existing candidate
        const { error } = await supabase
          .from('candidates')
          .update(payload)
          .eq('id', editingId);
        
        if (error) throw error;
        
        // Log the update action
        const { error: logError } = await supabase.from('admin_logs').insert({
          action: "UPDATE_CANDIDATE",
          target_name: form.name,
          target_id: form.position,
          reason: `Updated candidate details - Course: ${form.course}, Year: ${form.year}`,
          timestamp: new Date().toISOString(),
        });
        
        if (logError) {
          console.error('Failed to add log:', logError);
          Alert.alert("Log Error", "Could not add activity log: " + logError.message);
        }
        
        // Refresh data immediately after update
        if (refreshData) {
          await refreshData();
        }
        
        Alert.alert("Updated", "Candidate information synced.");
      } else {
        // Add new candidate
        const { error } = await supabase
          .from('candidates')
          .insert({ ...payload, votes: 0 });
        
        if (error) throw error;
        
        // Log the addition
        const { error: logError } = await supabase.from('admin_logs').insert({
          action: "ADD_CANDIDATE",
          target_name: form.name,
          target_id: form.position,
          reason: `New candidate registered - Course: ${form.course}, Year: ${form.year}`,
          timestamp: new Date().toISOString(),
        });
        
        if (logError) {
          console.error('Failed to add log:', logError);
          Alert.alert("Log Error", "Could not add activity log: " + logError.message);
        }
        
        // Refresh logs to show new entry
        if (refreshData) {
          await refreshData();
        }
        
        Alert.alert("Registered", "New candidate added.");
      }
      
      // Refresh data immediately after save
      if (refreshData) {
        await refreshData();
      }
      
      resetForm();
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const confirmDelete = (id: string) => {
    Alert.alert(
      "Remove Candidate",
      "Are you sure you want to delete this candidate? This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: () => handleDeleteItem("candidates", id) }
      ]
    );
  };

  const resetForm = () => {
    setEditingId(null);
    setForm(initialState);
    setCandImage(null);
    setImageFile(null);
  };

  return (
    <View className="flex-1">
      {/* --- REGISTRATION FORM --- */}
      <View className="bg-[#1e1e1e] p-5 rounded-2xl border border-gray-800 mb-6">
        <TouchableOpacity onPress={pickImage} className="items-center mb-4">
          <Image source={{ uri: candImage || DEFAULT_AVATAR }} className="w-20 h-20 rounded-full border-2 border-[#00b894]" />
          <Text className="text-[#00b894] text-[10px] font-bold mt-2 uppercase">Tap to Upload Photo</Text>
        </TouchableOpacity>
        
        <TextInput placeholder="Full Name" placeholderTextColor="#444" value={form.name} onChangeText={(t) => setForm({...form, name: t})} className="bg-[#121212] text-white p-3 rounded-lg mb-3" />
        
        {/* ADDED POSITION SELECTION HERE */}
        <Text className="text-gray-500 text-[10px] uppercase font-bold mb-2 ml-1">Select Position</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-row mb-4">
          {POSITIONS.map((pos: string) => (
            <TouchableOpacity 
              key={pos} 
              onPress={() => setForm({...form, position: pos})}
              className={`mr-2 px-4 py-2 rounded-full border ${
                form.position === pos 
                  ? 'bg-[#00b894] border-[#00b894]' 
                  : 'bg-[#121212] border-gray-800'
              }`}
            >
              <Text className={`text-[10px] font-bold ${form.position === pos ? 'text-black' : 'text-gray-400'}`}>
                {pos.toUpperCase()}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View className="flex-row gap-2 mb-3">
          <TextInput placeholder="Course" placeholderTextColor="#444" value={form.course} onChangeText={(t) => setForm({...form, course: t})} className="flex-1 bg-[#121212] text-white p-3 rounded-lg" />
          <TextInput placeholder="Year" placeholderTextColor="#444" value={form.year} onChangeText={(t) => setForm({...form, year: t})} className="flex-1 bg-[#121212] text-white p-3 rounded-lg" />
          <TextInput placeholder="Block" placeholderTextColor="#444" value={form.block} onChangeText={(t) => setForm({...form, block: t})} className="flex-1 bg-[#121212] text-white p-3 rounded-lg" />
        </View>
        <View className="flex-row gap-2 mb-3">
          <TextInput placeholder="Age" placeholderTextColor="#444" value={form.age} onChangeText={(t) => setForm({...form, age: t})} keyboardType="numeric" className="flex-1 bg-[#121212] text-white p-3 rounded-lg" />
          <TextInput placeholder="Gender" placeholderTextColor="#444" value={form.gender} onChangeText={(t) => setForm({...form, gender: t})} className="flex-1 bg-[#121212] text-white p-3 rounded-lg" />
        </View>
        <TextInput placeholder="Achievements & Background" placeholderTextColor="#444" value={form.background} onChangeText={(t) => setForm({...form, background: t})} multiline className="bg-[#121212] text-white p-3 rounded-lg mb-4 h-20" />
        <TouchableOpacity onPress={handleSave} className="bg-[#00b894] p-4 rounded-xl items-center">
          {isProcessing ? <ActivityIndicator color="black" /> : <Text className="text-black font-bold uppercase">{editingId ? "Update Candidate" : "Register Candidate"}</Text>}
        </TouchableOpacity>
        {editingId && <TouchableOpacity onPress={resetForm} className="mt-2 items-center"><Text className="text-gray-500 text-xs">Cancel Edit</Text></TouchableOpacity>}
      </View>

      {/* --- SEARCH BAR --- */}
      <View className="mb-4">
        <TextInput 
          placeholder="Search by name or position..." 
          placeholderTextColor="#666" 
          value={searchTerm}
          onChangeText={setSearchTerm}
          className="bg-[#1e1e1e] text-white p-4 rounded-xl border border-gray-800"
        />
      </View>

      {/* --- LIST SECTION --- */}
      {filteredCandidates.map((c: any) => (
        <View key={c.id} className="bg-[#1e1e1e] p-4 rounded-xl mb-3 flex-row items-center border border-gray-800">
          <Image source={{ uri: c.image || DEFAULT_AVATAR }} className="w-16 h-16 rounded-full mr-1" />
          <View className="flex-1">
            <Text className="text-white font-bold">{c.name}</Text>
            <Text className="text-[#00b894] text-[10px] uppercase font-semibold">{c.position}</Text>
          </View>
          
          <View className="flex-row gap-4">
            <TouchableOpacity onPress={() => setSelectedCandidate(c)}><Text className="text-[#00b894] text-xs font-bold">VIEW</Text></TouchableOpacity>
            <TouchableOpacity onPress={() => { setEditingId(c.id); setForm({ ...c }); setCandImage(c.image); }}><Text className="text-blue-500 text-xs font-bold">EDIT</Text></TouchableOpacity>
            <TouchableOpacity onPress={() => confirmDelete(c.id)}><Text className="text-red-500 text-xs font-bold">DELETE</Text></TouchableOpacity>
          </View>
        </View>
      ))}

      {filteredCandidates.length === 0 && (
        <Text className="text-gray-600 text-center mt-4">No candidates found.</Text>
      )}

      {/* --- DETAIL MODAL (Functional) --- */}
      <Modal visible={!!selectedCandidate} animationType="slide" transparent={true} onRequestClose={() => setSelectedCandidate(null)}>
        <View className="flex-1 justify-center items-center bg-black/90 p-6">
          <View className="bg-[#1e1e1e] w-full rounded-3xl border border-gray-800 overflow-hidden">
            <View className="items-center p-6 bg-[#252525]">
               <Image source={{ uri: selectedCandidate?.image || DEFAULT_AVATAR }} className="w-40 h-40 rounded-2xl border-2 border-[#00b894]" />
               <Text className="text-white text-2xl font-bold mt-4">{selectedCandidate?.name}</Text>
               <Text className="text-[#00b894] font-bold uppercase tracking-widest text-xs">{selectedCandidate?.position}</Text>
            </View>

            <ScrollView className="p-6 max-h-80">
                <DetailRow label="Academic" value={`${selectedCandidate?.course} • Yr ${selectedCandidate?.year}-${selectedCandidate?.block}`} />
                <DetailRow label="Personal" value={`${selectedCandidate?.age} y/o • ${selectedCandidate?.gender}`} />
                <View className="mt-4">
                    <Text className="text-gray-500 text-[10px] uppercase font-bold">Biography</Text>
                    <Text className="text-gray-300 mt-2 leading-5">{selectedCandidate?.background || "No bio provided."}</Text>
                </View>
            </ScrollView>

            <TouchableOpacity onPress={() => setSelectedCandidate(null)} className="m-6 bg-[#333] p-4 rounded-xl items-center">
              <Text className="text-white font-bold">CLOSE</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const DetailRow = ({ label, value }: { label: string, value: string }) => (
  <View className="flex-row justify-between border-b border-gray-800 py-3">
    <Text className="text-gray-500 text-[11px] uppercase">{label}</Text>
    <Text className="text-white text-xs font-bold">{value}</Text>
  </View>
);
