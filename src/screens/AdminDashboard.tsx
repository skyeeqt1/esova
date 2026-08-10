import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAdminData } from '../hooks/useAdminData';
import { supabase } from '../config/supabase';
import { OverviewSection } from '../components/admin/OverviewSection';
import { CandidateSection } from '../components/admin/CandidateSection';
import { VoterSection } from '../components/admin/VoterSection';
import { AdminLogsSection } from '../components/admin/AdminLogsSection';
import LogoutModal from '../components/LogoutModal';

type SectionKey = 'overview' | 'candidates' | 'voters' | 'logs';

const SECTIONS: {
  key: SectionKey;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconActive: keyof typeof Ionicons.glyphMap;
}[] = [
  { key: 'overview', label: 'Overview', icon: 'stats-chart-outline', iconActive: 'stats-chart' },
  { key: 'candidates', label: 'Candidates', icon: 'people-outline', iconActive: 'people' },
  { key: 'voters', label: 'Voters', icon: 'person-add-outline', iconActive: 'person-add' },
  { key: 'logs', label: 'Activity', icon: 'time-outline', iconActive: 'time' },
];

const AdminDashboard = ({ navigation, route }: any) => {
  const [activeSection, setActiveSection] = useState<SectionKey>('overview');
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const adminEmail = route?.params?.adminEmail || '';
  const adminData = useAdminData(adminEmail);

  const handleLogout = () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    supabase.auth.signOut().finally(() => navigation.replace('Login'));
  };

  const handleLogoutPress = () => setShowLogoutModal(true);

  return (
    <SafeAreaView className="flex-1 bg-surface-950" edges={['top']}>
      {/* HEADER */}
      <View className="flex-row items-center justify-between border-b border-white/[0.06] bg-surface-900/95 px-5 pb-3 pt-2">
        <View className="flex-row items-center">
          <View className="mr-3 h-10 w-10 items-center justify-center rounded-xl border border-white/[0.1] bg-surface-800">
            <Image
              source={require('../assets/logo.png')}
              className="h-6 w-6"
              resizeMode="contain"
            />
          </View>
          <View>
            <Text className="text-[15px] font-bold tracking-tight text-white">ESCR Admin</Text>
            <Text className="eyebrow">Election Control Panel</Text>
          </View>
        </View>
        <TouchableOpacity
          onPress={handleLogoutPress}
          className="items-center justify-center rounded-xl border border-rose-500/25 bg-rose-500/10 px-3 py-2 active:scale-[0.97] active:bg-rose-500/20">
          <Ionicons name="log-out-outline" size={16} color="#fb7185" />
        </TouchableOpacity>
      </View>

      {/* SECTION CONTENT */}
      <View className="flex-1 px-5 pt-4" key={activeSection}>
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
        {activeSection === 'logs' && <AdminLogsSection {...adminData} />}
      </View>

      {/* BOTTOM TAB BAR */}
      <View className="flex-row items-center border-t border-white/[0.06] bg-surface-900/95 px-2 pb-2 pt-2">
        {SECTIONS.map((s) => {
          const active = activeSection === s.key;
          return (
            <TouchableOpacity
              key={s.key}
              onPress={() => setActiveSection(s.key)}
              className={`flex-1 items-center justify-center py-2 active:scale-[0.95]`}>
              <View className="relative items-center">
                {active && <View className="absolute -top-2 h-1 w-6 rounded-full bg-violet-400" />}
                <Ionicons
                  name={active ? s.iconActive : s.icon}
                  size={22}
                  color={active ? '#a78bfa' : '#64748b'}
                />
              </View>
              <Text
                className={`mt-1 text-[10px] font-semibold ${
                  active ? 'text-violet-300' : 'text-slate-500'
                }`}>
                {s.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <LogoutModal
        visible={showLogoutModal}
        onClose={() => setShowLogoutModal(false)}
        onConfirm={handleLogout}
        loading={isLoggingOut}
        title="Log out of admin panel?"
        description="Your session will be closed and you'll need to sign in again to manage the election."
        confirmLabel="Logout"
      />
    </SafeAreaView>
  );
};

export default AdminDashboard;
