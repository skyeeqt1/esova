import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Image,
  Alert,
  ActivityIndicator,
  Modal,
  BackHandler,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../config/supabase';

const POSITIONS = ['President', 'VP', 'Secretary', 'Treasurer'];
const DEFAULT_AVATAR = 'https://via.placeholder.com/150';

const VoterScreen = ({ navigation, route }: any) => {
  const insets = useSafeAreaInsets();
  const [candidates, setCandidates] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState('President');
  const [selectedVotes, setSelectedVotes] = useState<any>({});
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState<any>(null);
  const [viewingCandidate, setViewingCandidate] = useState<any>(null);
  const [electionSettings, setElectionSettings] = useState<any>(null);
  const [timeLeft, setTimeLeft] = useState('');
  const [showTermsModal, setShowTermsModal] = useState(true);

  useEffect(() => {
    // Get voter data from navigation params (passed from LoginScreen)
    const voterData = route.params?.voterData;

    if (voterData) {
      setUserData(voterData);
      if (voterData.has_voted) {
        setStep(3);
        if (voterData.ballot) setSelectedVotes(voterData.ballot);
      }
    } else {
      // Fallback: try to get from Supabase Auth (for admin users)
      checkAuthUser();
      return;
    }

    subscribeToData();
    setLoading(false);
  }, []);

  const checkAuthUser = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        navigation.replace('Login');
        return;
      }
      if (user.email) loadVoterProfile(user.email);
      subscribeToData();
    } catch (error) {
      console.error('Auth error:', error);
      navigation.replace('Login');
    }
  };

  const loadVoterProfile = async (email?: string) => {
    try {
      // First try to find by email
      let userDataArray = null;

      if (email) {
        const { data } = await supabase.from('users').select('*').eq('email', email).single();

        if (data) userDataArray = data;
      }

      if (!userDataArray) {
        // Fallback: try to find by any method
        const { data: allUsers } = await supabase.from('users').select('*').limit(1);

        if (allUsers && allUsers.length > 0) {
          // For demo, use first user - in production match by email
          userDataArray = allUsers[0];
        }
      }

      if (userDataArray) {
        setUserData(userDataArray);
        if (userDataArray.has_voted) {
          setStep(3);
          if (userDataArray.ballot) setSelectedVotes(userDataArray.ballot);
        }
      }
    } catch (error) {
      console.error('Error loading voter profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const subscribeToData = () => {
    // Subscribe to candidates changes
    const candidatesChannel = supabase
      .channel('voter-candidates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'candidates' }, (payload) => {
        fetchCandidates();
      })
      .subscribe();

    // Subscribe to settings changes
    const settingsChannel = supabase
      .channel('voter-settings')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'settings' }, (payload) => {
        fetchSettings();
      })
      .subscribe();

    fetchCandidates();
    fetchSettings();

    return () => {
      supabase.removeChannel(candidatesChannel);
      supabase.removeChannel(settingsChannel);
    };
  };

  const fetchCandidates = async () => {
    try {
      const { data, error } = await supabase.from('candidates').select('*');

      if (error) throw error;
      setCandidates(data || []);
    } catch (error) {
      console.error('Error fetching candidates:', error);
    }
  };

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('settings')
        .select('*')
        .eq('id', 'election_control')
        .single();

      if (error) {
        // Settings might not exist, use defaults
        setElectionSettings({ status: 'started', endTime: Date.now() + 3600000 });
        return;
      }
      setElectionSettings(data);
    } catch (error) {
      // Use default settings
      setElectionSettings({ status: 'started', endTime: Date.now() + 3600000 });
    }
  };

  // Handle back button to close modal instead of going back
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (viewingCandidate) {
        setViewingCandidate(null); // Close the modal
        return true; // Prevent default back button behavior
      }
      return false;
    });

    return () => backHandler.remove();
  }, [viewingCandidate]);

  useEffect(() => {
    const timer = setInterval(() => {
      if (electionSettings?.end_time) {
        const endTime = new Date(electionSettings.end_time).getTime();
        const diff = endTime - Date.now();
        if (diff > 0) {
          const m = Math.floor(diff / 60000);
          const s = Math.floor((diff % 60000) / 1000);
          setTimeLeft(`${m}m ${s}s`);
        } else {
          setTimeLeft('CLOSED');
        }
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [electionSettings]);

  const isStarted = electionSettings?.status === 'started';
  const endTime = electionSettings?.end_time ? new Date(electionSettings.end_time).getTime() : 0;
  const isEnded = endTime < Date.now();

  const handleLogout = () => {
    Alert.alert('Logout Session', 'Are you sure you want to exit?', [
      { text: 'Cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          await supabase.auth.signOut();
          navigation.replace('Login');
        },
      },
    ]);
  };

  const handleVoteSubmit = async () => {
    // Check if session ended exactly when they clicked submit
    if (isEnded) {
      Alert.alert(
        'Time Expired',
        'The voting session has closed. Your vote could not be recorded.'
      );
      return;
    }

    setLoading(true);
    try {
      // Update each candidate's vote count
      for (const pos of POSITIONS) {
        const cand = selectedVotes[pos];
        if (cand) {
          const { error } = await supabase
            .from('candidates')
            .update({ votes: cand.votes + 1 })
            .eq('id', cand.id);

          if (error) throw error;
        }
      }

      // Update user's voted status
      if (userData) {
        const { error } = await supabase
          .from('users')
          .update({
            has_voted: true,
            voted_at: new Date().toISOString(),
            ballot: selectedVotes,
          })
          .eq('id', userData.id);

        if (error) throw error;

        // Update local state
        setUserData({
          ...userData,
          has_voted: true,
          voted_at: new Date().toISOString(),
          ballot: selectedVotes,
        });
      }

      setStep(3);
      Alert.alert('Success', 'Vote recorded.');
    } catch (e) {
      console.error('Vote error:', e);
      Alert.alert('Error', 'Failed to cast vote.');
    }
    setLoading(false);
  };

  if (loading)
    return (
      <View className="flex-1 items-center justify-center bg-[#1a1a1a]">
        <ActivityIndicator size="large" color="#f1c40f" />
      </View>
    );

  // TERMS AND CONDITIONS / INSTRUCTIONS SCREEN (Shown before voting)
  if (showTermsModal && !isEnded && !userData?.has_voted) {
    return (
      <View className="flex-1 bg-[#1a1a1a] pb-12">
        <View className="flex-1 items-center  justify-center bg-black/80">
          <View className="w-full max-w-md rounded-3xl border border-[#f1c40f] bg-[#1e1e1e] p-6">
            <View className="mb-4 items-center">
              <View className="mb-4 rounded-full border-2 border-[#f1c40f] bg-white">
                <Image
                  source={require('../assets/logo.png')}
                  className="h-24 w-24"
                  resizeMode="contain"
                />
              </View>
              <Text className="text-2xl sm:text-4xl font-black italic text-[#f1c40f]">WELCOME, VOTER!</Text>
              <Text className="mt-2 text-lg font-bold text-white">Hello, {userData?.name}!</Text>
              <Text className="text-base text-gray-500">ID: {userData?.student_id}</Text>
            </View>

            <View className="mb-4 border-b border-t border-gray-800 py-4">
              <Text className="mb-3 text-xl sm:text-2xl font-black italic text-[#f1c40f]">
                VOTING INSTRUCTIONS
              </Text>
              <View className="space-y-2">
                <View className="flex-row items-start">
                  <Text className="mr-2 font-bold text-[#f1c40f]">1.</Text>
              <Text className="text-base sm:text-lg text-gray-300">
                    Review all candidates for each position carefully.
                  </Text>
                </View>
                <View className="flex-row items-start">
                  <Text className="mr-2 font-bold text-[#f1c40f]">2.</Text>
                  <Text className="text-lg text-gray-300">
                    Tap on a candidate to select your vote for each position.
                  </Text>
                </View>
                <View className="flex-row items-start">
                  <Text className="mr-2 font-bold text-[#f1c40f]">3.</Text>
                  <Text className="text-lg text-gray-300">
                    You must select a candidate for ALL positions to proceed.
                  </Text>
                </View>
                <View className="flex-row items-start">
                  <Text className="mr-2 font-bold text-[#f1c40f]">4.</Text>
                  <Text className="text-lg text-gray-300">
                    Review your ballot before submitting.
                  </Text>
                </View>
                <View className="flex-row items-start">
                  <Text className="mr-2 font-bold text-[#f1c40f]">5.</Text>
                  <Text className="text-lg text-gray-300">
                    Once submitted, your vote cannot be changed.
                  </Text>
                </View>
              </View>
            </View>

            <View className="mb-6 rounded-xl bg-black/50 p-4">
              <Text className="mb-2 text-lg font-black italic text-[#f1c40f]">
                TERMS AND CONDITIONS
              </Text>
              <ScrollView style={{ maxHeight: 150 }}>
                <Text className="text-base leading-5 text-gray-400">
                  • By proceeding with this vote, you acknowledge that your selection is final and
                  cannot be modified after submission.{'\n'}• You certify that you are an eligible
                  voter and have the right to participate in this election.{'\n'}• All votes are
                  confidential and will be counted anonymously.{'\n'}• Any attempt to manipulate or
                  disrupt the voting process is strictly prohibited.{'\n'}• The election
                  administrators reserve the right to invalidate any vote suspected of being
                  fraudulent.{'\n'}• By casting your vote, you agree to abide by all election rules
                  and regulations.{'\n'}
                  {'\n'}• In case of a TIE in the final vote count, the tied candidates will decide
                  between toss coin or draw lots to determine the winner.
                </Text>
              </ScrollView>
            </View>

            <TouchableOpacity
onPress={() => setShowTermsModal(false)}
              className="rounded-xl border-b-4 border-yellow-700 bg-[#f1c40f] p-4">
              <Text className="text-center text-lg sm:text-xl font-black uppercase italic text-black">
                I Accept - Proceed to Vote
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleLogout}
              className="mt-4 rounded-xl border border-gray-800 p-4">
              <Text className="text-center text-base font-bold text-red-500">Decline & Logout</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }
};

export default VoterScreen;
