import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Image } from 'react-native';
import { useAdminData } from '../hooks/useAdminData';
import { OverviewSection } from '../components/admin/OverviewSection';
import { CandidateSection } from '../components/admin/CandidateSection';
import { VoterSection } from '../components/admin/VoterSection';
import { AdminLogsSection } from '../components/admin/AdminLogsSection'; // Import added

const AdminDashboard = ({ navigation }: any) => {
  // Added 'logs' to the state type
  const [activeSection, setActiveSection] = useState<'overview' | 'candidates' | 'voters' | 'logs'>('overview');
  const adminData = useAdminData();

  return (
    <View className="flex-1 bg-[#121212] pt-12">
      <View className="px-6 flex-row justify-between items-center mb-6">
        <View className="bg-white rounded-full border-2 border-[#f1c40f]">
           <Image source={require("../img/escrlogo.png")} className="w-20 h-20" resizeMode="contain" />
        </View>
        <View>
          <Text className="text-[#00b894] text-xl font-bold">ESCR ADMIN</Text>
          <Text className="text-gray-500 text-[10px]">Election Control Panel</Text>
        </View>
        <TouchableOpacity onPress={() => navigation.replace('Login')} className="bg-red-500/10 px-4 py-2 rounded-full">
          <Text className="text-red-500 text-xs font-bold">Logout</Text>
        </TouchableOpacity>
      </View>

      <View className="flex-row px-6 mb-6 gap-2"> 
        {/* Added 'logs' to the map array */}
        {['overview', 'candidates', 'voters', 'logs'].map((s) => (
          <TouchableOpacity key={s} onPress={() => setActiveSection(s as any)} 
            className={`flex-1 py-2 rounded-full items-center ${activeSection === s ? 'bg-[#00b894]' : 'bg-gray-800'}`}>
            <Text className={`font-bold text-[10px] uppercase ${activeSection === s ? 'text-black' : 'text-gray-500'}`}>{s}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView className="px-6" showsVerticalScrollIndicator={false}>
        {activeSection === 'overview' && <OverviewSection {...adminData} />}
        {activeSection === 'candidates' && <CandidateSection {...adminData} />}
        {activeSection === 'voters' && <VoterSection {...adminData} />}
        {/* Render logic for logs section added */}
        {activeSection === 'logs' && <AdminLogsSection {...adminData} />}
      </ScrollView>
    </View>
  );
};

export default AdminDashboard;