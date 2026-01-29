import React, { useState } from 'react';
import { 
  View, Text, TextInput, TouchableOpacity, Image, 
  ScrollView, ActivityIndicator, Platform, Modal 
} from 'react-native';
import { db, storage } from '../../config/firebase';
import { collection, addDoc, updateDoc, doc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { DEFAULT_AVATAR, POSITIONS } from '../../hooks/useAdminData';

export const CandidateSection = ({ candidates, handleDeleteItem, isProcessing, setIsProcessing }: any) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedCandidate, setSelectedCandidate] = useState<any>(null); // State for the Modal
  
  // Form States
  const [candName, setCandName] = useState('');
  const [candCourse, setCandCourse] = useState('');
  const [candYear, setCandYear] = useState('');
  const [candBlock, setCandBlock] = useState('');
  const [candAge, setCandAge] = useState('');
  const [candGender, setCandGender] = useState('');
  const [candBackground, setCandBackground] = useState('');
  const [candPos, setCandPos] = useState('President');
  const [candImage, setCandImage] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<any>(null);

  const handleSave = async () => {
    setIsProcessing(true);
    try {
      let finalImageUrl = candImage || DEFAULT_AVATAR;
      if (imageFile) {
        const storageRef = ref(storage, `candidates/${Date.now()}`);
        const snapshot = await uploadBytes(storageRef, imageFile);
        finalImageUrl = await getDownloadURL(snapshot.ref);
      }
      const payload = { 
        name: candName, year: candYear, block: candBlock, 
        course: candCourse, position: candPos, age: candAge, 
        gender: candGender, background: candBackground, image: finalImageUrl 
      };
      
      editingId 
        ? await updateDoc(doc(db, "candidates", editingId), payload) 
        : await addDoc(collection(db, "candidates"), { ...payload, votes: 0 });
      
      resetForm();
    } catch (e) { console.error(e); }
    setIsProcessing(false);
  };

  const resetForm = () => { 
    setEditingId(null); setCandName(''); setCandYear(''); setCandCourse(''); 
    setCandBlock(''); setCandAge(''); setCandGender(''); setCandBackground('');
    setCandImage(null); setImageFile(null); 
  };

  const pickImage = () => {
    if (Platform.OS === 'web') {
      const input = document.createElement("input");
      input.type = "file"; input.accept = "image/*";
      input.onchange = (e: any) => {
        const file = e.target.files[0];
        if (file) { setImageFile(file); setCandImage(URL.createObjectURL(file)); }
      };
      input.click();
    }
  };

  return (
    <View>
      {/* --- FORM SECTION --- */}
      <View className="bg-[#1e1e1e] p-5 rounded-2xl border border-gray-800 mb-6">
        <TouchableOpacity onPress={pickImage} className="items-center mb-4">
          <Image source={{ uri: candImage || DEFAULT_AVATAR }} className="w-20 h-20 rounded-full border-2 border-[#00b894]" />
          <Text className="text-[#00b894] text-[10px] font-bold mt-2">UPLOAD PHOTO</Text>
        </TouchableOpacity>
        
        <TextInput placeholder="Name" placeholderTextColor="#444" value={candName} onChangeText={setCandName} className="bg-[#121212] text-white p-3 rounded-lg mb-3" />
        
        <View className="flex-row space-x-2 mb-4 gap-2">
          <TextInput placeholder="Course" placeholderTextColor="#444" value={candCourse} onChangeText={setCandCourse} className="flex-1 bg-[#121212] text-white p-3 rounded-lg" />
          <TextInput placeholder="Year" placeholderTextColor="#444" value={candYear} onChangeText={setCandYear} className="flex-1 bg-[#121212] text-white p-3 rounded-lg" />
          <TextInput placeholder="Block" placeholderTextColor="#444" value={candBlock} onChangeText={setCandBlock} className="flex-1 bg-[#121212] text-white p-3 rounded-lg" />
        </View>

        <View className="flex-row space-x-2 mb-4 gap-2">
          <TextInput placeholder="Age" placeholderTextColor="#444" value={candAge} onChangeText={setCandAge} className="flex-1 bg-[#121212] text-white p-3 rounded-lg" />
          <TextInput placeholder="Gender" placeholderTextColor="#444" value={candGender} onChangeText={setCandGender} className="flex-1 bg-[#121212] text-white p-3 rounded-lg" />
        </View>

        <TextInput 
          placeholder="Achievements & Background" 
          placeholderTextColor="#444" 
          value={candBackground} 
          onChangeText={setCandBackground} 
          multiline 
          className="bg-[#121212] text-white p-3 rounded-lg mb-4 h-20" 
        />

        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4">
          {POSITIONS.map(p => (
            <TouchableOpacity key={p} onPress={() => setCandPos(p)} className={`mr-2 px-4 py-2 rounded-full border ${candPos === p ? 'bg-[#00b894] border-[#00b894]' : 'border-gray-700'}`}>
              <Text className={`text-xs ${candPos === p ? 'text-black font-bold' : 'text-gray-500'}`}>{p}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        <TouchableOpacity onPress={handleSave} className="bg-[#00b894] p-4 rounded-xl items-center">
          {isProcessing ? <ActivityIndicator color="black" /> : <Text className="text-black font-bold">{editingId ? "UPDATE" : "REGISTER"}</Text>}
        </TouchableOpacity>
      </View>

      {/* --- LIST SECTION --- */}
      {candidates.map((c: any) => (
        <View key={c.id} className="bg-[#1e1e1e] p-4 rounded-xl mb-3 flex-row items-center border border-gray-800">
          <Image source={{ uri: c.image || DEFAULT_AVATAR }} className="w-10 h-10 rounded-full mr-4" />
          <View className="flex-1">
            <Text className="text-white font-bold">{c.name}</Text>
            <Text className="text-[#00b894] text-[10px] uppercase">{c.position}</Text>
          </View>
          
          <TouchableOpacity onPress={() => setSelectedCandidate(c)} className="mr-4">
            <Text className="text-[#00b894] text-xs font-bold">VIEW</Text>
          </TouchableOpacity>
          
          <TouchableOpacity onPress={() => { 
            setEditingId(c.id); setCandName(c.name); setCandPos(c.position); setCandYear(c.year); 
            setCandBlock(c.block); setCandCourse(c.course); setCandAge(c.age); setCandGender(c.gender);
            setCandBackground(c.background); setCandImage(c.image); 
          }} className="mr-4">
            <Text className="text-blue-500 text-xs font-bold">EDIT</Text>
          </TouchableOpacity>
          
          <TouchableOpacity onPress={() => handleDeleteItem("candidates", c.id)}>
            <Text className="text-red-500 text-xs font-bold">DELETE</Text>
          </TouchableOpacity>
        </View>
      ))}

      {/* --- CANDIDATE DETAIL MODAL --- */}
      <Modal visible={!!selectedCandidate} animationType="slide" transparent={true}>
        <View className="flex-1 justify-center items-center bg-black/80 p-6">
          <View className="bg-[#1e1e1e] w-full rounded-3xl border border-gray-800 overflow-hidden">
            <View className="items-center p-6 bg-[#252525]">
               <Image source={{ uri: selectedCandidate?.image || DEFAULT_AVATAR }} className="w-32 h-32 rounded-2xl border-2 border-[#00b894]" />
               <Text className="text-white text-2xl font-bold mt-4">{selectedCandidate?.name}</Text>
               <Text className="text-[#00b894] font-bold uppercase tracking-widest">{selectedCandidate?.position}</Text>
            </View>

            <ScrollView className="p-6 max-h-96">
                <DetailRow label="Course" value={selectedCandidate?.course} />
                <DetailRow label="Year & Block" value={`${selectedCandidate?.year} - ${selectedCandidate?.block}`} />
                <DetailRow label="Age/Gender" value={`${selectedCandidate?.age} y/o • ${selectedCandidate?.gender}`} />
                <View className="mt-4">
                    <Text className="text-gray-500 text-[10px] uppercase font-bold">Background & Achievements</Text>
                    <Text className="text-gray-300 mt-1 leading-5">{selectedCandidate?.background || "No background provided."}</Text>
                </View>
            </ScrollView>

            <TouchableOpacity 
              onPress={() => setSelectedCandidate(null)}
              className="m-6 bg-gray-800 p-4 rounded-xl items-center"
            >
              <Text className="text-white font-bold">CLOSE</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

// Helper component for Modal Rows
const DetailRow = ({ label, value }: { label: string, value: string }) => (
    <View className="flex-row justify-between border-b border-gray-800 py-3">
        <Text className="text-gray-500 text-xs">{label}</Text>
        <Text className="text-white text-xs font-bold">{value}</Text>
    </View>
);