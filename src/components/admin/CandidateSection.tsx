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
import * as FileSystem from 'expo-file-system';
import { decode } from 'base64-arraybuffer';
import { Ionicons } from '@expo/vector-icons';

// Configs
import { supabase, CANDIDATE_IMAGES_BUCKET } from '../../config/supabase';

// Shared Hooks/Data
import { DEFAULT_AVATAR, POSITIONS } from '../../hooks/useAdminData';

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
  const [showAddPositionModal, setShowAddPositionModal] = useState(false);
  const [newPositionName, setNewPositionName] = useState('');
  const [editingPositionIndex, setEditingPositionIndex] = useState<number | null>(null);
  const [editingPositionName, setEditingPositionName] = useState('');
  const [showEditPositionModal, setShowEditPositionModal] = useState(false);
  const [showForm, setShowForm] = useState(false);

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

      const { error } = await supabase.storage
        .from(CANDIDATE_IMAGES_BUCKET)
        .upload(filePath, body, { contentType: 'image/png', upsert: true });

      if (error) throw error;
      const {
        data: { publicUrl },
      } = supabase.storage.from(CANDIDATE_IMAGES_BUCKET).getPublicUrl(filePath);
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
      setShowForm(false);
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
    <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
      {/* --- HEADER: LIST SUMMARY + ADD ACTION --- */}
      <View className="mb-4 flex-row items-center justify-between">
        <View>
          <Text className="eyebrow">Candidates</Text>
          <Text className="text-lg font-semibold text-white">{candidates.length} registered</Text>
        </View>
        <TouchableOpacity
          onPress={() => {
            resetForm();
            setShowForm(true);
          }}
          className="btn btn-primary px-4 py-2.5">
          <Ionicons name="add" size={16} color="#fff" />
          <Text className="ml-1.5 text-sm font-semibold text-white">Add Candidate</Text>
        </TouchableOpacity>
      </View>

      {/* --- SEARCH BAR --- */}
      <View className="mb-4 flex-row items-center rounded-xl border border-white/[0.08] bg-surface-850">
        <View className="pl-4">
          <Ionicons name="search-outline" size={16} color="#64748b" />
        </View>
        <TextInput
          placeholder="Search by name or position..."
          placeholderTextColor="#5b6472"
          value={searchTerm}
          onChangeText={setSearchTerm}
          className="flex-1 px-3 py-3.5 text-base text-white"
        />
      </View>

      {/* --- LIST SECTION --- */}
      {filteredCandidates.map((c: any) => (
        <TouchableOpacity
          key={c.id}
          onPress={() => setSelectedCandidate(c)}
          activeOpacity={0.9}
          className="card mb-3 flex-row items-center p-4 active:scale-[0.98] active:bg-surface-750">
          <Image
            source={{ uri: c.image || DEFAULT_AVATAR }}
            className="mr-3 h-12 w-12 rounded-full border border-white/10"
          />
          <View className="flex-1">
            <Text className="text-base font-semibold text-white" numberOfLines={1}>
              {c.name}
            </Text>
            <Text className="text-xs font-semibold uppercase tracking-eyebrow text-primary-300">
              {c.position}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color="#475569" />
        </TouchableOpacity>
      ))}

      {filteredCandidates.length === 0 && (
        <View className="items-center rounded-2xl border border-dashed border-white/[0.08] p-8">
          <Ionicons name="people-outline" size={28} color="#334155" />
          <Text className="mt-2 text-sm text-slate-500">No candidates found.</Text>
        </View>
      )}

      {/* --- REGISTER / EDIT FORM MODAL --- */}
      <Modal
        visible={showForm}
        animationType="slide"
        transparent={true}
        onRequestClose={() => {
          setShowForm(false);
          resetForm();
        }}>
        <View className="flex-1 justify-end bg-black/80">
          <View className="max-h-[92%] overflow-hidden !rounded-t-3xl border-white/[0.1] bg-surface-900">
            <View className="flex-row items-center justify-between border-b border-white/[0.06] p-5">
              <View>
                <Text className="eyebrow">Candidate Registry</Text>
                <Text className="text-lg font-semibold text-white">
                  {editingId ? 'Edit candidate' : 'Register a candidate'}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => {
                  setShowForm(false);
                  resetForm();
                }}
                className="h-9 w-9 items-center justify-center rounded-full border border-white/[0.08] bg-surface-850">
                <Ionicons name="close" size={16} color="#94a3b8" />
              </TouchableOpacity>
            </View>

            <ScrollView className="p-5" showsVerticalScrollIndicator={false}>
              <TouchableOpacity onPress={pickImage} className="mb-5 items-center">
                <View className="relative">
                  <Image
                    source={{ uri: candImage || DEFAULT_AVATAR }}
                    className="h-24 w-24 rounded-full border-2 border-primary-500/40 bg-surface-850"
                  />
                  <View className="absolute -bottom-1 -right-1 h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-primary-500">
                    <Ionicons name="camera" size={14} color="#fff" />
                  </View>
                </View>
                <Text className="mt-2 text-xs font-semibold text-primary-300">
                  {candImage ? 'Change photo' : 'Tap to upload photo'}
                </Text>
              </TouchableOpacity>

              <Text className="label">Full Name</Text>
              <TextInput
                placeholder="Enter candidate name"
                placeholderTextColor="#5b6472"
                value={form.name}
                onChangeText={(t) => setForm({ ...form, name: t })}
                className="input mb-4"
              />

              {/* POSITION SELECTION */}
              <View className="mb-2 flex-row items-center justify-between">
                <Text className="label">Select Position</Text>
                <TouchableOpacity
                  onPress={() => {
                    setShowAddPositionModal(true);
                  }}
                  className="mb-2 flex-row items-center">
                  <Ionicons name="add-circle-outline" size={16} color="#a78bfa" />
                  <Text className="ml-1 text-xs font-semibold text-primary-300">Add position</Text>
                </TouchableOpacity>
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                className="mb-4 flex-row">
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
                            Alert.alert(
                              'Delete Position',
                              `Are you sure you want to delete "${pos}"?`,
                              [
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
                                      setForm({
                                        ...form,
                                        position: newPositions[0] || 'President',
                                      });
                                    }
                                  },
                                },
                              ]
                            );
                          },
                        },
                      ]);
                    }}
                    className={`mr-2 rounded-full border px-4 py-2 ${
                      form.position === pos
                        ? 'border-primary-500 bg-primary-500'
                        : 'border-white/[0.08] bg-surface-850'
                    }`}>
                    <Text
                      className={`text-xs font-semibold ${
                        form.position === pos ? 'text-white' : 'text-slate-400'
                      }`}>
                      {pos.toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <View className="mb-4 flex-row gap-2">
                <View className="flex-1">
                  <Text className="label">Course</Text>
                  <TextInput
                    placeholder="Course"
                    placeholderTextColor="#5b6472"
                    value={form.course}
                    onChangeText={(t) => setForm({ ...form, course: t })}
                    className="input"
                  />
                </View>
                <View className="flex-1">
                  <Text className="label">Year</Text>
                  <TextInput
                    placeholder="Year"
                    placeholderTextColor="#5b6472"
                    value={form.year}
                    onChangeText={(t) => setForm({ ...form, year: t })}
                    className="input"
                  />
                </View>
              </View>
              <View className="mb-4 flex-row gap-2">
                <View className="flex-1">
                  <Text className="label">Block</Text>
                  <TextInput
                    placeholder="Block"
                    placeholderTextColor="#5b6472"
                    value={form.block}
                    onChangeText={(t) => setForm({ ...form, block: t })}
                    className="input"
                  />
                </View>
                <View className="flex-1">
                  <Text className="label">Age</Text>
                  <TextInput
                    placeholder="Age"
                    placeholderTextColor="#5b6472"
                    value={form.age}
                    onChangeText={(t) => setForm({ ...form, age: t })}
                    keyboardType="numeric"
                    className="input"
                  />
                </View>
                <View className="flex-1">
                  <Text className="label">Gender</Text>
                  <TextInput
                    placeholder="Gender"
                    placeholderTextColor="#5b6472"
                    value={form.gender}
                    onChangeText={(t) => setForm({ ...form, gender: t })}
                    className="input"
                  />
                </View>
              </View>

              <Text className="label">Achievements & Background</Text>
              <TextInput
                placeholder="Platform, achievements, background..."
                placeholderTextColor="#5b6472"
                value={form.background}
                onChangeText={(t) => setForm({ ...form, background: t })}
                multiline
                className="input mb-5 h-24"
              />

              <View className="flex-row gap-3">
                {editingId && (
                  <TouchableOpacity
                    onPress={() => {
                      setShowForm(false);
                      resetForm();
                    }}
                    className="btn btn-ghost flex-1">
                    <Text className="text-sm font-semibold text-slate-200">Cancel</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  onPress={handleSave}
                  className={`btn btn-primary ${editingId ? 'flex-1' : 'w-full'}`}>
                  {isProcessing ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="person-add-outline" size={18} color="#fff" />
                      <Text className="ml-2 text-[15px] font-semibold text-white">
                        {editingId ? 'Update Candidate' : 'Register Candidate'}
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* --- DETAIL MODAL (Functional) --- */}
      <Modal
        visible={!!selectedCandidate}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setSelectedCandidate(null)}>
        <View className="flex-1 items-center justify-center bg-black/80 p-6">
          <View className="card w-full overflow-hidden !rounded-3xl border-white/[0.1]">
            <View className="items-center bg-surface-850 p-6">
              <View className="relative">
                <Image
                  source={{ uri: selectedCandidate?.image || DEFAULT_AVATAR }}
                  className="h-24 w-24 rounded-full border-2 border-accent-400/40 bg-surface-800"
                />
                <View className="absolute -right-1 -top-1 h-7 w-7 items-center justify-center rounded-full bg-accent-400">
                  <Ionicons name="star" size={13} color="#08090d" />
                </View>
              </View>
              <Text className="mt-4 text-xl font-semibold tracking-tight text-white">
                {selectedCandidate?.name}
              </Text>
              <Text className="text-xs font-semibold uppercase tracking-eyebrow text-accent-400">
                {selectedCandidate?.position}
              </Text>
            </View>

            <ScrollView className="max-h-72 p-6">
              <DetailRow
                label="Academic"
                value={`${selectedCandidate?.course} • Yr ${selectedCandidate?.year}-${selectedCandidate?.block}`}
              />
              <DetailRow
                label="Personal"
                value={`${selectedCandidate?.age} y/o • ${selectedCandidate?.gender}`}
              />
              <View className="mt-4">
                <Text className="label">Biography</Text>
                <Text className="text-sm leading-5 text-slate-300">
                  {selectedCandidate?.background || 'No bio provided.'}
                </Text>
              </View>
            </ScrollView>

            <View className="mx-6 mb-6 flex-row gap-3">
              <TouchableOpacity
                onPress={() => {
                  setSelectedCandidate(null);
                  setEditingId(selectedCandidate.id);
                  setForm({ ...selectedCandidate });
                  setCandImage(selectedCandidate.image);
                  setShowForm(true);
                }}
                className="btn btn-ghost flex-1">
                <Ionicons name="create-outline" size={16} color="#cbd5e1" />
                <Text className="ml-1.5 text-sm font-semibold text-slate-200">Edit</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  setSelectedCandidate(null);
                  confirmDelete(selectedCandidate.id);
                }}
                className="btn btn-danger flex-1">
                <Ionicons name="trash-outline" size={16} color="#fb7185" />
                <Text className="ml-1.5 text-sm font-semibold text-rose-300">Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* --- ADD POSITION MODAL --- */}
      <Modal
        visible={showAddPositionModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowAddPositionModal(false)}>
        <View className="flex-1 items-center justify-center bg-black/80 p-6">
          <View className="card w-full !rounded-3xl border-white/[0.1] p-6">
            <Text className="mb-1 text-lg font-semibold text-white">Add New Position</Text>
            <Text className="mb-4 text-sm text-slate-400">
              Create a new position for candidates to run under.
            </Text>
            <TextInput
              placeholder="Enter position name"
              placeholderTextColor="#5b6472"
              value={newPositionName}
              onChangeText={setNewPositionName}
              className="input mb-5"
            />
            <View className="flex-row gap-3">
              <TouchableOpacity
                onPress={() => {
                  setShowAddPositionModal(false);
                  setNewPositionName('');
                }}
                className="btn btn-ghost flex-1">
                <Text className="text-sm font-semibold text-slate-200">Cancel</Text>
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
                className="btn btn-primary flex-1">
                <Ionicons name="add" size={16} color="#fff" />
                <Text className="ml-1.5 text-sm font-semibold text-white">Add</Text>
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
        <View className="flex-1 items-center justify-center bg-black/80 p-6">
          <View className="card w-full !rounded-3xl border-white/[0.1] p-6">
            <Text className="mb-1 text-lg font-semibold text-white">Edit Position</Text>
            <Text className="mb-4 text-sm text-slate-400">Rename this position.</Text>
            <TextInput
              placeholder="Enter new position name"
              placeholderTextColor="#5b6472"
              value={editingPositionName}
              onChangeText={setEditingPositionName}
              className="input mb-5"
            />
            <View className="flex-row gap-3">
              <TouchableOpacity
                onPress={() => {
                  setShowEditPositionModal(false);
                  setEditingPositionIndex(null);
                  setEditingPositionName('');
                }}
                className="btn btn-ghost flex-1">
                <Text className="text-sm font-semibold text-slate-200">Cancel</Text>
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
                className="btn btn-primary flex-1">
                <Ionicons name="checkmark" size={16} color="#fff" />
                <Text className="ml-1.5 text-sm font-semibold text-white">Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
};

const DetailRow = ({ label, value }: { label: string; value: string }) => (
  <View className="flex-row justify-between border-b border-white/[0.06] py-3">
    <Text className="text-xs uppercase tracking-eyebrow text-slate-500">{label}</Text>
    <Text className="text-sm font-semibold text-white">{value}</Text>
  </View>
);
