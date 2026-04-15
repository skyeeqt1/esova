import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Image, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAdminData } from '../hooks/useAdminData';
import { OverviewSection } from '../components/admin/OverviewSection';
import { CandidateSection } from '../components/admin/CandidateSection';
import { VoterSection } from '../components/admin/VoterSection';
import { AdminLogsSection } from '../components/admin/AdminLogsSection';

const AdminDashboard = ({ navigation, route }: any) => {
  const [activeSection, setActiveSection] = useState<'overview' | 'candidates' | 'voters' | 'logs'>(
    'overview'
  );
  const adminEmail = route?.params?.adminEmail || '';
  const adminData = useAdminData(adminEmail);

  return (
    <SafeAreaView className="flex-1 bg-[#121212]">
      <View className="mb-6 flex-row items-center justify-between px-6">
        <View className="rounded-full border-2 border-[#f1c40f] bg-white">
          <Image
            source={require('../assets/logo.png')}
            className="h-20 w-20"
            resizeMode="contain"
          />
        </View>
        <View>
          <Text className="text-xl sm:text-2xl font-bold text-[#00b894]">ESCR ADMIN</Text>
          <Text className="text-base text-gray-500">Election Control Panel</Text>
        </View>
        <TouchableOpacity
          onPress={() => navigation.replace('Login')}
          className="rounded-full bg-red-500/10 px-4 py-2">
          <Text className="text-base font-bold text-red-500">Logout</Text>
        </TouchableOpacity>
      </View>

      <View className="mb-6 flex-row gap-2 px-6">
        {/* Added 'logs' to the map array */}
        {['overview', 'candidates', 'voters', 'logs'].map((s) => (
          <TouchableOpacity
            key={s}
            onPress={() => setActiveSection(s as any)}
            className={`flex-1 items-center rounded-full py-3 ${activeSection === s ? 'bg-[#00b894]' : 'bg-gray-800'}`}>
            <Text
              className={`text-sm font-bold uppercase ${activeSection === s ? 'text-black' : 'text-gray-500'}`}>
              {s}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView className="px-6" showsVerticalScrollIndicator={false} key={activeSection}>
        {activeSection === 'overview' && <OverviewSection {...adminData} />}
        {activeSection === 'candidates' && (
          <CandidateSection
            {...adminData}
            refreshData={adminData.refreshData}
            adminEmail={adminData.currentAdminEmail}
          />
        )}
        {activeSection === 'voters' && (
          <VoterSection
            {...adminData}
            refreshData={adminData.refreshData}
            adminEmail={adminData.currentAdminEmail}
          />
        )}
        {/* Render logic for logs section */}
        {activeSection === 'logs' && <AdminLogsSection {...adminData} />}
      </ScrollView>
    </SafeAreaView>
  );
};

export default AdminDashboard;
