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
import { supabase } from '../config/supabase';

const POSITIONS = ['President', 'VP', 'Secretary', 'Treasurer'];
const DEFAULT_AVATAR = 'https://via.placeholder.com/150';

const VoterScreen = ({ navigation, route }: any) => {
  const [candidates, setCandidates] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState('President');
  const [selectedVotes, setSelectedVotes] = useState<any>({});
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState<any>(null);
  const [viewingCandidate, setViewingCandidate] = useState<any>(null);
  const [showReceiptOverride, setShowReceiptOverride] = useState(false);
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
      <View className="flex-1 bg-[#1a1a1a]">
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
              <Text className="text-2xl font-black italic text-[#f1c40f]">WELCOME, VOTER!</Text>
              <Text className="mt-2 text-sm font-bold text-white">Hello, {userData?.name}!</Text>
              <Text className="text-xs text-gray-500">ID: {userData?.student_id}</Text>
            </View>

            <View className="mb-4 border-b border-t border-gray-800 py-4">
              <Text className="mb-3 text-lg font-black italic text-[#f1c40f]">
                VOTING INSTRUCTIONS
              </Text>
              <View className="space-y-2">
                <View className="flex-row items-start">
                  <Text className="mr-2 font-bold text-[#f1c40f]">1.</Text>
                  <Text className="text-sm text-gray-300">
                    Review all candidates for each position carefully.
                  </Text>
                </View>
                <View className="flex-row items-start">
                  <Text className="mr-2 font-bold text-[#f1c40f]">2.</Text>
                  <Text className="text-sm text-gray-300">
                    Tap on a candidate to select your vote for each position.
                  </Text>
                </View>
                <View className="flex-row items-start">
                  <Text className="mr-2 font-bold text-[#f1c40f]">3.</Text>
                  <Text className="text-sm text-gray-300">
                    You must select a candidate for ALL positions to proceed.
                  </Text>
                </View>
                <View className="flex-row items-start">
                  <Text className="mr-2 font-bold text-[#f1c40f]">4.</Text>
                  <Text className="text-sm text-gray-300">
                    Review your ballot before submitting.
                  </Text>
                </View>
                <View className="flex-row items-start">
                  <Text className="mr-2 font-bold text-[#f1c40f]">5.</Text>
                  <Text className="text-sm text-gray-300">
                    Once submitted, your vote cannot be changed.
                  </Text>
                </View>
              </View>
            </View>

            <View className="mb-6 rounded-xl bg-black/50 p-4">
              <Text className="mb-2 text-sm font-black italic text-[#f1c40f]">
                TERMS AND CONDITIONS
              </Text>
              <ScrollView style={{ maxHeight: 150 }}>
                <Text className="text-xs leading-4 text-gray-400">
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
              <Text className="text-center text-lg font-black uppercase italic text-black">
                I Accept - Proceed to Vote
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleLogout}
              className="mt-4 rounded-xl border border-gray-800 p-4">
              <Text className="text-center text-sm font-bold text-red-500">Decline & Logout</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  if (!isStarted)
    return (
      <View className="flex-1 items-center justify-center bg-black p-10">
        <View className="mb-10 items-center">
          <View className="mb-4 rounded-full border-2 border-[#f1c40f] bg-white">
            <Image
              source={require('../assets/logo.png')}
              className="h-40 w-40"
              resizeMode="contain"
            />
          </View>
          <Text className="mt-1 pb-2 text-[30px] font-bold uppercase tracking-[3px] text-gray-400">
            ESOVA
          </Text>
          <Text className="text-4xl font-black italic tracking-tighter text-[#f1c40f]">
            VOTING<Text className="text-white">PORTAL</Text>
          </Text>
        </View>
        <Text className="text-xl font-black italic text-[#f1c40f]">NO VOTING SESSION YET</Text>
        <TouchableOpacity
          onPress={handleLogout}
          className="mt-8 rounded-full border border-gray-800 px-8 py-3">
          <Text className="font-bold text-red-500">LOGOUT</Text>
        </TouchableOpacity>
      </View>
    );

  return (
    <View className="flex-1 bg-[#1a1a1a]">
      <View className="flex-1">
        {/* HEADER BAR */}
        <View className="flex-row items-center justify-between border-b-2 border-[#f1c40f] bg-black px-6 pb-4 pt-12">
          <View>
            <Text className="text-xl font-black italic tracking-tighter text-[#f1c40f]">
              E-SOVA
            </Text>
            <Text className="text-[10px] uppercase tracking-[1px] text-white opacity-60">
              {isEnded ? 'SESSION' : `TIME LEFT`}
            </Text>
            <Text className="font-bold text-[#e74c3c]"> {timeLeft}</Text>
          </View>
          <View className="items-center justify-center rounded-full border-2 border-[#f1c40f] bg-white">
            <Image
              source={require('../assets/logo.png')}
              className="h-20 w-20"
              resizeMode="contain"
            />
          </View>
          <TouchableOpacity
            onPress={handleLogout}
            className="rounded-full border border-gray-800 bg-[#1a1a1a] px-4 py-2">
            <Text className="text-[10px] font-black tracking-widest text-red-500">LOGOUT</Text>
          </TouchableOpacity>
        </View>

        <ScrollView className="flex-1 px-4 pt-4">
          {/* LOGIC: IF ELECTION ENDED AND USER IS NOT VIEWING RECEIPT */}
          {isEnded && !showReceiptOverride ? (
            <View>
              {electionSettings?.results_published ? (
                /* OFFICIAL RESULTS PANEL */
                <View className="rounded-3xl border border-[#f1c40f] bg-[#1e1e1e] p-6">
                  <Text className="mb-6 text-center text-2xl font-black italic text-[#f1c40f]">
                    OFFICIAL RESULTS
                  </Text>
                  {POSITIONS.map((pos) => {
                    const sorted = candidates
                      .filter((c) => c.position === pos)
                      .sort((a, b) => b.votes - a.votes);
                    const winner = sorted[0];
                    return (
                      <View
                        key={pos}
                        className="mb-3 flex-row items-center justify-between rounded-xl bg-black/50 p-4">
                        <View>
                          <Text className="text-[8px] font-bold uppercase text-gray-500">
                            {pos} Winner
                          </Text>
                          <Text className="font-bold text-white">{winner?.name || 'N/A'}</Text>
                        </View>
                        <Text className="text-lg font-black text-[#ffff00]">
                          {winner?.votes || 0}
                        </Text>
                      </View>
                    );
                  })}
                  <TouchableOpacity
                    onPress={() => setShowReceiptOverride(true)}
                    className="mt-4 items-center rounded-xl bg-gray-800 p-4">
                    <Text className="text-[10px] font-bold uppercase text-[#f1c40f]">
                      View My Ballot Receipt
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : (
                /* POLLS CLOSED STATE (Hides candidate list even if user hasn't voted) */
                <View className="items-center rounded-3xl border border-gray-800 bg-[#1e1e1e] p-10">
                  <Text className="text-lg font-black text-white">The election has ended</Text>
                  <Text className="mt-2 text-center text-xs text-gray-500">
                    Please wait for the administrator to flash the official results.
                  </Text>
                  {userData?.has_voted && (
                    <TouchableOpacity
                      onPress={() => setShowReceiptOverride(true)}
                      className="mt-8 rounded-full border border-gray-700 px-8 py-3">
                      <Text className="text-[10px] font-bold text-[#f1c40f]">
                        VIEW BALLOT RECEIPT
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>
          ) : (
            /* ACTIVE VOTING (Only visible while isEnded is FALSE) */
            <>
              {step === 1 && !isEnded && (
                <View>
                  <View className="mb-4 rounded-xl border-l-4 border-[#f1c40f] bg-[#1e1e1e] p-4">
                    <Text className="text-lg font-bold text-white">Hello, {userData?.name}!</Text>
                    <Text className="text-xs font-bold uppercase text-gray-400">
                      ID: {userData?.student_id}
                    </Text>
                  </View>

                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    className="mb-6 flex-row rounded-full border border-gray-800 bg-black p-1">
                    {POSITIONS.map((pos) => (
                      <TouchableOpacity
                        key={pos}
                        onPress={() => setActiveTab(pos)}
                        className={`rounded-full px-6 py-2 ${activeTab === pos ? 'bg-[#f1c40f]' : ''}`}>
                        <Text
                          className={`text-[10px] font-black ${activeTab === pos ? 'text-black' : 'text-gray-500'}`}>
                          {pos}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>

                  {candidates
                    .filter((c) => c.position === activeTab)
                    .map((candidate) => (
                      <TouchableOpacity
                        key={candidate.id}
                        onPress={() =>
                          setSelectedVotes({ ...selectedVotes, [activeTab]: candidate })
                        }
                        className={`mb-3 flex-row items-center rounded-2xl border-2 p-4 ${selectedVotes[activeTab]?.id === candidate.id ? 'border-[#f1c40f] bg-[#2a2a2a]' : 'border-gray-800 bg-[#1e1e1e]'}`}>
                        <Image
                          source={{ uri: candidate.image || DEFAULT_AVATAR }}
                          className="mr-4 h-16 w-16 rounded-xl border border-gray-700 bg-black"
                        />
                        <View className="flex-1">
                          <Text
                            className={`text-lg font-black ${selectedVotes[activeTab]?.id === candidate.id ? 'text-[#f1c40f]' : 'text-white'}`}>
                            {candidate.name}
                          </Text>
                          <Text className="text-[10px] uppercase text-gray-400">
                            {candidate.course} • Year {candidate.year}
                          </Text>
                          <TouchableOpacity
                            onPress={() => setViewingCandidate(candidate)}
                            className="mt-1">
                            <Text className="text-[10px] font-bold text-[#f1c40f] underline">
                              VIEW PROFILE
                            </Text>
                          </TouchableOpacity>
                        </View>
                        {selectedVotes[activeTab]?.id === candidate.id && (
                          <View className="rounded-full bg-[#f1c40f] px-2 py-1">
                            <Text className="text-[8px] font-bold text-black">SELECTED</Text>
                          </View>
                        )}
                      </TouchableOpacity>
                    ))}
                  {POSITIONS.every((p) => selectedVotes[p]) && (
                    <TouchableOpacity
                      onPress={() => setStep(2)}
                      className="mb-10 mt-6 rounded-xl bg-[#f1c40f] p-4">
                      <Text className="text-center font-black text-black">REVIEW BALLOT</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}

              {step === 2 && !isEnded && (
                <View className="rounded-3xl border border-gray-800 bg-[#1e1e1e] p-6">
                  <Text className="mb-6 text-2xl font-black italic text-[#f1c40f]">
                    REVIEW BALLOT
                  </Text>
                  {POSITIONS.map((pos) => (
                    <View
                      key={pos}
                      className="mb-3 flex-row items-center justify-between rounded-xl border border-gray-900 bg-black p-4">
                      <View>
                        <Text className="text-[8px] uppercase text-gray-500">{pos}</Text>
                        <Text className="font-bold text-white">{selectedVotes[pos]?.name}</Text>
                      </View>
                      <TouchableOpacity
                        onPress={() => {
                          setStep(1);
                          setActiveTab(pos);
                        }}>
                        <Text className="text-xs text-[#f1c40f]">EDIT</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                  <TouchableOpacity
                    onPress={handleVoteSubmit}
                    className="mt-8 rounded-2xl bg-[#e74c3c] p-5">
                    <Text className="text-center text-xl font-black uppercase italic text-white">
                      Cast Vote Now
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* PERSISTENT RECEIPT VIEW (Accessible via Step 3 or Override) */}
              {(step === 3 || showReceiptOverride) && (
                <View>
                  <View className="mb-4 mt-4 rounded-lg border-t-8 border-[#f1c40f] bg-white p-6">
                    <Text className="text-center text-2xl font-black italic text-black">
                      OFFICIAL RECEIPT
                    </Text>
                    <View className="my-4 h-[1px] w-full border border-dashed bg-gray-200" />
                    <View className="mb-4">
                      <Text className="text-[10px] font-bold uppercase text-gray-500">
                        Voter: {userData?.name}
                      </Text>
                      <Text className="text-[10px] font-bold uppercase text-gray-500">
                        ID: {userData?.student_id}
                      </Text>
                      <Text className="text-[10px] font-bold uppercase text-gray-500">
                        Time Cast: {userData?.voted_at}
                      </Text>
                    </View>
                    <View className="rounded-lg bg-gray-100 p-4">
                      {POSITIONS.map((pos) => (
                        <View
                          key={pos}
                          className="flex-row justify-between border-b border-gray-200 py-2">
                          <Text className="text-[10px] font-bold text-gray-500">{pos}:</Text>
                          <Text className="text-[10px] font-black text-black">
                            {selectedVotes[pos]?.name?.toUpperCase()}
                          </Text>
                        </View>
                      ))}
                    </View>
                  </View>
                  {isEnded && (
                    <TouchableOpacity
                      onPress={() => setShowReceiptOverride(false)}
                      className="mb-20 items-center rounded-xl border border-gray-700 bg-black/50 p-4">
                      <Text className="text-[10px] font-bold uppercase text-white">
                        Back to Election Result
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </>
          )}
        </ScrollView>
      </View>

      {/* Profile Modal */}
      <Modal
        visible={!!viewingCandidate}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setViewingCandidate(null)}>
        <View className="flex-1 items-center justify-center bg-black/90 p-6">
          <View className="w-full rounded-3xl border border-gray-800 bg-[#1e1e1e] p-8">
            <Image
              source={{ uri: viewingCandidate?.image || DEFAULT_AVATAR }}
              className="mx-auto h-32 w-32 rounded-3xl border-2 border-[#f1c40f] bg-black"
            />
            <Text className="mt-4 text-center text-2xl font-bold text-white">
              {viewingCandidate?.name}
            </Text>
            <Text className="mb-1 text-center text-xs font-bold uppercase tracking-widest text-[#f1c40f]">
              {viewingCandidate?.position}
            </Text>
            <Text className="mb-4 text-center text-[10px] uppercase text-gray-400">
              {viewingCandidate?.course} • Year {viewingCandidate?.year}
            </Text>
            <Text className="mb-2 text-center text-[10px] italic text-gray-500">
              Background & Achievements
            </Text>
            <Text className="text-sm leading-5 text-gray-300">
              {viewingCandidate?.background || 'No platform information provided.'}
            </Text>
            <TouchableOpacity
              onPress={() => setViewingCandidate(null)}
              className="mt-8 items-center rounded-xl bg-[#f1c40f] p-4">
              <Text className="font-black text-black">CLOSE</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default VoterScreen;
