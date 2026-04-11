import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  ScrollView,
  ActivityIndicator,
  Platform,
  Modal,
  Alert,
  BackHandler,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { decode } from 'base64-arraybuffer';
import { Ionicons } from '@expo/vector-icons';

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

export const CandidateSection = ({
  candidates,
  handleDeleteItem,
  isProcessing,
  setIsProcessing,
  refreshData,
  adminEmail,
}: any) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedCandidate, setSelectedCandidate] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [positions, setPositions] = useState<string[]>([]);
  const [positionsLoading, setPositionsLoading] = useState(true);
  const [showAddPositionModal, setShowAddPositionModal] = useState(false);
  const [newPositionName, setNewPositionName] = useState('');
  const [editingPositionIndex, setEditingPositionIndex] = useState<number | null>(null);
  const [editingPositionName, setEditingPositionName] = useState('');
  const [showEditPositionModal, setShowEditPositionModal] = useState(false);

  // Fetch positions from Supabase on mount
  useEffect(() => {
    const fetchPositions = async () => {
      try {
        const { data, error } = await supabase.from('positions').select('name').order('name');

        if (error) throw error;

        if (data && data.length > 0) {
          setPositions(data.map((p: any) => p.name));
        } else {
          // Fallback to default positions if table is empty
          setPositions(POSITIONS);
        }
      } catch (error) {
        console.error('Failed to fetch positions:', error);
        setPositions(POSITIONS);
      } finally {
        setPositionsLoading(false);
      }
    };

    fetchPositions();
  }, []);

  const initialState = {
    name: '',
    course: '',
    year: '',
    block: '',
    age: '',
    gender: '',
    background: '',
    position: 'President',
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
    return candidates.filter(
      (c: any) =>
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
      const {
        data: { publicUrl },
      } = supabase.storage.from('candidate-images').getPublicUrl(filePath);
      return publicUrl;
    } catch (err: any) {
      throw new Error(err.message || 'Upload failed.');
    }
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return Alert.alert('Denied', 'Gallery access needed.');

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
    if (!form.name || !form.course) return Alert.alert('Error', 'Name and Course are required.');
    setIsProcessing(true);
    try {
      let finalImageUrl = candImage || DEFAULT_AVATAR;
      const isNewLocalFile =
        candImage &&
        (candImage.startsWith('file:') ||
          candImage.startsWith('content:') ||
          candImage.startsWith('ph:'));

      if (isNewLocalFile) finalImageUrl = await uploadToSupabase(candImage);

      const payload = { ...form, image: finalImageUrl };

      if (editingId) {
        // Update existing candidate
        const { error } = await supabase.from('candidates').update(payload).eq('id', editingId);

        if (error) throw error;

        // Log the update action
        const { error: logError } = await supabase.from('admin_logs').insert({
          action: 'UPDATE_CANDIDATE',
          target_name: form.name,
          target_id: form.position,
          reason: `Updated candidate details - Course: ${form.course}, Year: ${form.year}`,
          admin_email: adminEmail,
          timestamp: new Date().toISOString(),
        });

        if (logError) {
          console.error('Failed to add log:', logError);
          Alert.alert('Log Error', 'Could not add activity log: ' + logError.message);
        }

        // Refresh data immediately after update
        if (refreshData) {
          await refreshData();
        }

        Alert.alert('Updated', 'Candidate information synced.');
      } else {
        // Add new candidate
        const { error } = await supabase.from('candidates').insert({ ...payload, votes: 0 });

        if (error) throw error;

        // Log the addition
        const { error: logError } = await supabase.from('admin_logs').insert({
          action: 'ADD_CANDIDATE',
          target_name: form.name,
          target_id: form.position,
          reason: `New candidate registered - Course: ${form.course}, Year: ${form.year}`,
          admin_email: adminEmail,
          timestamp: new Date().toISOString(),
        });

        if (logError) {
          console.error('Failed to add log:', logError);
          Alert.alert('Log Error', 'Could not add activity log: ' + logError.message);
        }

        // Refresh logs to show new entry
        if (refreshData) {
          await refreshData();
        }

        Alert.alert('Registered', 'New candidate added.');
      }

      // Refresh data immediately after save
      if (refreshData) {
        await refreshData();
      }

      resetForm();
    } catch (e: any) {
      Alert.alert('Error', e.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const confirmDelete = (id: string) => {
    Alert.alert(
      'Remove Candidate',
      'Are you sure you want to delete this candidate? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => handleDeleteItem('candidates', id) },
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
      <View className="mb-6 rounded-2xl border border-gray-800 bg-[#1e1e1e] p-5">
        <TouchableOpacity onPress={pickImage} className="mb-4 items-center">
          <Image
            source={{ uri: candImage || DEFAULT_AVATAR }}
            className="h-24 w-24 rounded-full border-2 border-[#00b894]"
          />
          <Text className="mt-2 text-base font-bold uppercase text-[#00b894]">
            Tap to Upload Photo
          </Text>
        </TouchableOpacity>

        <TextInput
          placeholder="Full Name"
          placeholderTextColor="#444"
          value={form.name}
          onChangeText={(t) => setForm({ ...form, name: t })}
          className="mb-3 rounded-lg bg-[#121212] p-4 text-lg text-white"
        />

        {/* ADDED POSITION SELECTION HERE */}
        <View className="mb-2 ml-1 flex-row items-center justify-between">
          <Text className="text-base font-bold uppercase text-gray-500">Select Position</Text>
          <TouchableOpacity
            onPress={() => {
              setShowAddPositionModal(true);
            }}
            className="flex-row items-center">
            <Ionicons name="add-circle-outline" size={22} color="#00b894" />
            <Text className="ml-1 text-base font-bold text-[#00b894]">Add</Text>
          </TouchableOpacity>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4 flex-row">
          {positions.map((pos: string, index: number) => (
            <TouchableOpacity
              key={pos + index}
              onPress={() => setForm({ ...form, position: pos })}
              onLongPress={() => {
                Alert.alert(pos.toUpperCase(), 'What would you like to do?', [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Edit',
                    onPress: () => {
                      setEditingPositionIndex(index);
                      setEditingPositionName(pos);
                      setShowEditPositionModal(true);
                    },
                  },
                  {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: () => {
                      Alert.alert('Delete Position', `Are you sure you want to delete "${pos}"?`, [
                        { text: 'Cancel', style: 'cancel' },
                        {
                          text: 'Delete',
                          style: 'destructive',
                          onPress: async () => {
                            const newPositions = positions.filter((_, i) => i !== index);
                            setPositions(newPositions);
                            // Delete from database
                            const { error: deleteError } = await supabase
                              .from('positions')
                              .delete()
                              .eq('name', pos);
                            if (deleteError) {
                              console.error('Failed to delete position:', deleteError);
                              Alert.alert('Error', 'Failed to delete position');
                            }
                            if (form.position === pos) {
                              setForm({ ...form, position: newPositions[0] || 'President' });
                            }
                          },
                        },
                      ]);
                    },
                  },
                ]);
              }}
              className={`mr-2 rounded-full border px-4 py-2 ${
                form.position === pos
                  ? 'border-[#00b894] bg-[#00b894]'
                  : 'border-gray-800 bg-[#121212]'
              }`}>
              <Text
                className={`text-base font-bold ${form.position === pos ? 'text-black' : 'text-gray-400'}`}>
                {pos.toUpperCase()}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <View className="mb-3 flex-row gap-2">
          <TextInput
            placeholder="Course"
            placeholderTextColor="#444"
            value={form.course}
            onChangeText={(t) => setForm({ ...form, course: t })}
            className="flex-1 rounded-lg bg-[#121212] p-4 text-lg text-white"
          />
          <TextInput
            placeholder="Year"
            placeholderTextColor="#444"
            value={form.year}
            onChangeText={(t) => setForm({ ...form, year: t })}
            className="flex-1 rounded-lg bg-[#121212] p-4 text-lg text-white"
          />
          <TextInput
            placeholder="Block"
            placeholderTextColor="#444"
            value={form.block}
            onChangeText={(t) => setForm({ ...form, block: t })}
            className="flex-1 rounded-lg bg-[#121212] p-4 text-lg text-white"
          />
        </View>
        <View className="mb-3 flex-row gap-2">
          <TextInput
            placeholder="Age"
            placeholderTextColor="#444"
            value={form.age}
            onChangeText={(t) => setForm({ ...form, age: t })}
            keyboardType="numeric"
            className="flex-1 rounded-lg bg-[#121212] p-4 text-lg text-white"
          />
          <TextInput
            placeholder="Gender"
            placeholderTextColor="#444"
            value={form.gender}
            onChangeText={(t) => setForm({ ...form, gender: t })}
            className="flex-1 rounded-lg bg-[#121212] p-4 text-lg text-white"
          />
        </View>
        <TextInput
          placeholder="Achievements & Background"
          placeholderTextColor="#444"
          value={form.background}
          onChangeText={(t) => setForm({ ...form, background: t })}
          multiline
          className="mb-4 h-24 rounded-lg bg-[#121212] p-4 text-lg text-white"
        />
        <TouchableOpacity onPress={handleSave} className="items-center rounded-xl bg-[#00b894] p-4">
          {isProcessing ? (
            <ActivityIndicator color="black" />
          ) : (
            <Text className="text-lg font-bold uppercase text-black">
              {editingId ? 'Update Candidate' : 'Register Candidate'}
            </Text>
          )}
        </TouchableOpacity>
        {editingId && (
          <TouchableOpacity onPress={resetForm} className="mt-2 items-center">
            <Text className="text-base text-gray-500">Cancel Edit</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* --- SEARCH BAR --- */}
      <View className="mb-4">
        <TextInput
          placeholder="Search by name or position..."
          placeholderTextColor="#666"
          value={searchTerm}
          onChangeText={setSearchTerm}
          className="rounded-xl border border-gray-800 bg-[#1e1e1e] p-4 text-lg text-white"
        />
      </View>

      {/* --- LIST SECTION --- */}
      {filteredCandidates.map((c: any) => (
        <TouchableOpacity
          key={c.id}
          onPress={() => setSelectedCandidate(c)}
          className="mb-3 flex-row items-center rounded-xl border border-gray-800 bg-[#1e1e1e] p-4">
          <Image
            source={{ uri: c.image || DEFAULT_AVATAR }}
            className="mr-3 h-20 w-20 rounded-full"
          />
          <View className="flex-1">
            <Text className="text-xl font-bold text-white" numberOfLines={1}>
              {c.name}
            </Text>
            <Text className="text-base font-semibold uppercase text-[#00b894]">{c.position}</Text>
          </View>
        </TouchableOpacity>
      ))}

      {filteredCandidates.length === 0 && (
        <Text className="mt-4 text-center text-lg text-gray-600">No candidates found.</Text>
      )}

      {/* --- DETAIL MODAL (Functional) --- */}
      <Modal
        visible={!!selectedCandidate}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setSelectedCandidate(null)}>
        <View className="flex-1 items-center justify-center bg-black/90 p-6">
          <View className="w-full overflow-hidden rounded-3xl border border-gray-800 bg-[#1e1e1e]">
            <View className="items-center bg-[#252525] p-6">
              <Image
                source={{ uri: selectedCandidate?.image || DEFAULT_AVATAR }}
                className="h-48 w-48 rounded-2xl border-2 border-[#00b894]"
              />
              <Text className="mt-4 text-3xl font-bold text-white">{selectedCandidate?.name}</Text>
              <Text className="text-base font-bold uppercase tracking-widest text-[#00b894]">
                {selectedCandidate?.position}
              </Text>
            </View>

            <ScrollView className="max-h-80 p-6">
              <DetailRow
                label="Academic"
                value={`${selectedCandidate?.course} • Yr ${selectedCandidate?.year}-${selectedCandidate?.block}`}
              />
              <DetailRow
                label="Personal"
                value={`${selectedCandidate?.age} y/o • ${selectedCandidate?.gender}`}
              />
              <View className="mt-4">
                <Text className="text-base font-bold uppercase text-gray-500">Biography</Text>
                <Text className="mt-2 text-lg leading-5 text-gray-300">
                  {selectedCandidate?.background || 'No bio provided.'}
                </Text>
              </View>
            </ScrollView>

            <View className="mx-6 flex-row gap-3">
              <TouchableOpacity
                onPress={() => {
                  setSelectedCandidate(null);
                  setEditingId(selectedCandidate.id);
                  setForm({ ...selectedCandidate });
                  setCandImage(selectedCandidate.image);
                }}
                className="flex-1 items-center rounded-xl bg-blue-600 p-4">
                <Text className="text-lg font-bold text-white">EDIT</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  setSelectedCandidate(null);
                  confirmDelete(selectedCandidate.id);
                }}
                className="flex-1 items-center rounded-xl border border-red-500 bg-red-500/10 p-4">
                <Text className="text-lg font-bold text-red-500">DELETE</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              onPress={() => setSelectedCandidate(null)}
              className="m-6 items-center rounded-xl bg-[#333] p-4">
              <Text className="text-lg font-bold text-white">CLOSE</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* --- ADD POSITION MODAL --- */}
      <Modal
        visible={showAddPositionModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowAddPositionModal(false)}>
        <View className="flex-1 items-center justify-center bg-black/90 p-6">
          <View className="w-full rounded-3xl border border-gray-800 bg-[#1e1e1e] p-6">
            <Text className="mb-4 text-center text-2xl font-bold text-white">Add New Position</Text>
            <TextInput
              placeholder="Enter position name"
              placeholderTextColor="#666"
              value={newPositionName}
              onChangeText={setNewPositionName}
              className="mb-4 rounded-xl border border-gray-800 bg-[#121212] p-4 text-lg text-white"
            />
            <View className="flex-row gap-3">
              <TouchableOpacity
                onPress={() => {
                  setShowAddPositionModal(false);
                  setNewPositionName('');
                }}
                className="flex-1 items-center rounded-xl bg-[#333] p-4">
                <Text className="text-lg font-bold text-white">CANCEL</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={async () => {
                  if (newPositionName && newPositionName.trim()) {
                    const trimmed = newPositionName.trim();
                    if (positions.includes(trimmed)) {
                      Alert.alert('Error', 'Position already exists');
                    } else {
                      setPositions([...positions, trimmed]);
                      // Insert into database
                      const { error: insertError } = await supabase
                        .from('positions')
                        .insert({ name: trimmed });
                      if (insertError) {
                        console.error('Failed to add position:', insertError);
                        Alert.alert('Error', 'Failed to add position');
                      }
                      setForm({ ...form, position: trimmed });
                      setShowAddPositionModal(false);
                      setNewPositionName('');
                    }
                  }
                }}
                className="flex-1 items-center rounded-xl bg-[#00b894] p-4">
                <Text className="text-lg font-bold text-black">ADD</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* --- EDIT POSITION MODAL --- */}
      <Modal
        visible={showEditPositionModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowEditPositionModal(false)}>
        <View className="flex-1 items-center justify-center bg-black/90 p-6">
          <View className="w-full rounded-3xl border border-gray-800 bg-[#1e1e1e] p-6">
            <Text className="mb-4 text-center text-2xl font-bold text-white">Edit Position</Text>
            <TextInput
              placeholder="Enter new position name"
              placeholderTextColor="#666"
              value={editingPositionName}
              onChangeText={setEditingPositionName}
              className="mb-4 rounded-xl border border-gray-800 bg-[#121212] p-4 text-lg text-white"
            />
            <View className="flex-row gap-3">
              <TouchableOpacity
                onPress={() => {
                  setShowEditPositionModal(false);
                  setEditingPositionIndex(null);
                  setEditingPositionName('');
                }}
                className="flex-1 items-center rounded-xl bg-[#333] p-4">
                <Text className="text-lg font-bold text-white">CANCEL</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={async () => {
                  if (editingPositionName && editingPositionName.trim()) {
                    const trimmed = editingPositionName.trim();
                    if (positions.includes(trimmed)) {
                      Alert.alert('Error', 'Position already exists');
                    } else if (editingPositionIndex !== null) {
                      const oldName = positions[editingPositionIndex];
                      const newPositions = [...positions];
                      newPositions[editingPositionIndex] = trimmed;
                      setPositions(newPositions);
                      // Update in database
                      const { error: updateError } = await supabase
                        .from('positions')
                        .update({ name: trimmed })
                        .eq('name', oldName);
                      if (updateError) {
                        console.error('Failed to update position:', updateError);
                        Alert.alert('Error', 'Failed to update position');
                      }
                      if (form.position === oldName) {
                        setForm({ ...form, position: trimmed });
                      }
                      setShowEditPositionModal(false);
                      setEditingPositionIndex(null);
                      setEditingPositionName('');
                    }
                  }
                }}
                className="flex-1 items-center rounded-xl bg-[#3498db] p-4">
                <Text className="text-lg font-bold text-white">SAVE</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const DetailRow = ({ label, value }: { label: string; value: string }) => (
  <View className="flex-row justify-between border-b border-gray-800 py-3">
    <Text className="text-base uppercase text-gray-500">{label}</Text>
    <Text className="text-base font-bold text-white">{value}</Text>
  </View>
);
