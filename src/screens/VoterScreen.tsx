import React, { useState, useEffect, useRef } from 'react';
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
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../config/supabase';
import LogoutModal from '../components/LogoutModal';

const DEFAULT_POSITIONS = ['President', 'VP', 'Secretary', 'Treasurer'];
const DEFAULT_AVATAR = 'https://via.placeholder.com/150';

const VoterScreen = ({ navigation, route }: any) => {
  const [candidates, setCandidates] = useState<any[]>([]);
  const [positions, setPositions] = useState<string[]>(DEFAULT_POSITIONS);
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
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const submittingRef = useRef(false);

  useEffect(() => {
    let isMounted = true;

    const unsubscribe = subscribeToData();

    // Get voter data from navigation params (passed from LoginScreen)
    const voterData = route.params?.voterData;

    if (voterData) {
      setUserData(voterData);
      if (voterData.has_voted) {
        setStep(3);
        if (voterData.ballot) setSelectedVotes(voterData.ballot);
      }
      setLoading(false);
    } else {
      // Fallback: try to get from Supabase Auth (for admin users)
      checkAuthUser().finally(() => {
        if (isMounted) setLoading(false);
      });
    }

    return () => {
      isMounted = false;
      if (typeof unsubscribe === 'function') unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      if (user.email) await loadVoterProfile(user.email);
    } catch (error) {
      console.error('Auth error:', error);
      navigation.replace('Login');
    }
  };

  const loadVoterProfile = async (email?: string) => {
    if (!email) {
      navigation.replace('Login');
      return;
    }

    const { data } = await supabase.from('users').select('*').eq('email', email).single();

    if (data) {
      setUserData(data);
      if (data.has_voted) {
        setStep(3);
        if (data.ballot) setSelectedVotes(data.ballot);
      }
    } else {
      // No voter profile found for this authenticated user — reject access
      navigation.replace('Login');
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

    // Subscribe to positions changes
    const positionsChannel = supabase
      .channel('voter-positions')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'positions' }, (payload) => {
        fetchPositions();
      })
      .subscribe();

    fetchCandidates();
    fetchSettings();
    fetchPositions();

    return () => {
      supabase.removeChannel(candidatesChannel);
      supabase.removeChannel(settingsChannel);
      supabase.removeChannel(positionsChannel);
    };
  };

  const fetchPositions = async () => {
    try {
      const { data, error } = await supabase.from('positions').select('name').order('name');

      if (error) throw error;

      if (data && data.length > 0) {
        setPositions(data.map((p: any) => p.name));
        setActiveTab((prev) => (data.some((p: any) => p.name === prev) ? prev : data[0].name));
      } else {
        setPositions(DEFAULT_POSITIONS);
        setActiveTab((prev) => (DEFAULT_POSITIONS.includes(prev) ? prev : DEFAULT_POSITIONS[0]));
      }
    } catch (error) {
      console.error('Error fetching positions:', error);
      setPositions(DEFAULT_POSITIONS);
    }
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
        // Settings might not exist, use defaults (snake_case field name)
        setElectionSettings({
          status: 'started',
          end_time: new Date(Date.now() + 3600000).toISOString(),
        });
        return;
      }
      setElectionSettings(data);
    } catch {
      // Use default settings
      setElectionSettings({
        status: 'started',
        end_time: new Date(Date.now() + 3600000).toISOString(),
      });
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
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    supabase.auth.signOut().finally(() => navigation.replace('Login'));
  };

  const handleLogoutPress = () => setShowLogoutModal(true);

  const handleVoteSubmit = async () => {
    // Guard against double-submits (e.g. rapid taps, double network retries).
    if (submittingRef.current) return;
    submittingRef.current = true;

    // Check if session ended exactly when they clicked submit
    if (isEnded) {
      submittingRef.current = false;
      Alert.alert(
        'Time Expired',
        'The voting session has closed. Your vote could not be recorded.'
      );
      return;
    }

    setLoading(true);
    try {
      const ballot: any = {};
      for (const pos of positions) {
        if (selectedVotes[pos]) ballot[pos] = selectedVotes[pos];
      }

      if (Object.keys(ballot).length === 0) {
        submittingRef.current = false;
        setLoading(false);
        Alert.alert('Error', 'No candidates selected.');
        return;
      }

      // Primary path: atomic server-side transaction via RPC (recommended).
      let rpcSucceeded = false;
      const { error: rpcError } = await supabase.rpc('cast_vote', {
        p_voter_id: userData.id,
        p_ballot: ballot,
      });

      if (!rpcError) {
        rpcSucceeded = true;
      } else if (rpcError.code !== 'PGRST202') {
        // PGRST202 = function not found. Any other error is a real failure.
        throw rpcError;
      }

      // Fallback path: function not deployed yet. This mirrors the old
      // behaviour but refreshes vote counts immediately before incrementing
      // and still updates the user inside the same attempt.
      if (!rpcSucceeded) {
        for (const pos of positions) {
          const cand = selectedVotes[pos];
          if (!cand) continue;

          // Re-read the current vote count just before bumping to reduce the
          // chance of clobbering concurrent increments.
          const { data: fresh } = await supabase
            .from('candidates')
            .select('votes')
            .eq('id', cand.id)
            .single();
          const baseVotes = Number(fresh?.votes ?? cand.votes ?? 0);

          const { error } = await supabase
            .from('candidates')
            .update({ votes: baseVotes + 1 })
            .eq('id', cand.id);

          if (error) throw error;
        }

        // Update user's voted status
        const { error: userError } = await supabase
          .from('users')
          .update({
            has_voted: true,
            voted_at: new Date().toISOString(),
            ballot,
          })
          .eq('id', userData.id);

        if (userError) throw userError;
      }

      // Update local state
      setUserData({
        ...userData,
        has_voted: true,
        voted_at: new Date().toISOString(),
        ballot,
      });

      setStep(3);
      Alert.alert('Success', 'Vote recorded.');
    } catch (e: any) {
      console.error('Vote error:', e);
      Alert.alert('Error', e?.message || 'Failed to cast vote.');
    } finally {
      submittingRef.current = false;
      setLoading(false);
    }
  };

  const selectedCount = positions.filter((p) => selectedVotes[p]).length;
  const totalPositions = positions.length;
  const progressPct = totalPositions > 0 ? (selectedCount / totalPositions) * 100 : 0;
  const initials = (name: string) =>
    name
      ?.split(' ')
      .map((part) => part[0])
      .slice(0, 2)
      .join('')
      .toUpperCase() || '';

  if (loading)
    return (
      <View className="flex-1 items-center justify-center bg-surface-950">
        <ActivityIndicator size="large" color="#a78bfa" />
      </View>
    );

  // TERMS AND CONDITIONS / INSTRUCTIONS SCREEN (Shown before voting)
  if (showTermsModal && !isEnded && !userData?.has_voted) {
    return (
      <>
        <View className="flex-1 bg-surface-950">
          <View className="flex-1 items-center justify-center bg-black/80 p-5">
            <View className="w-full max-w-md overflow-hidden rounded-3xl border border-white/[0.08] bg-surface-800">
              <LinearGradient colors={['#161d33', '#101627']} className="px-6 pb-5 pt-7">
                <View className="items-center">
                  <View className="mb-4 h-16 w-16 items-center justify-center rounded-2xl border border-accent-400/40 bg-surface-800">
                    <Image
                      source={require('../assets/logo.png')}
                      className="h-11 w-11"
                      resizeMode="contain"
                    />
                  </View>
                  <Text className="text-center text-2xl font-bold tracking-tight text-white">
                    Welcome, voter!
                  </Text>
                  <Text className="mt-1 text-sm text-slate-400">
                    {userData?.name} • ID: {userData?.student_id}
                  </Text>
                </View>
              </LinearGradient>

              <View className="p-6">
                <Text className="mb-3 text-xs font-semibold uppercase tracking-eyebrow text-accent-400">
                  Voting Instructions
                </Text>
                {[
                  'Review all candidates for each position carefully.',
                  'Tap a candidate to select your vote for each position.',
                  'You must select a candidate for ALL positions to proceed.',
                  'Review your ballot before submitting.',
                  'Once submitted, your vote cannot be changed.',
                ].map((rule, i) => (
                  <View key={i} className="mb-2.5 flex-row items-start">
                    <View className="mr-3 mt-0.5 h-6 w-6 items-center justify-center rounded-full bg-primary-500/15">
                      <Text className="text-xs font-bold text-primary-300">{i + 1}</Text>
                    </View>
                    <Text className="flex-1 text-sm text-slate-300">{rule}</Text>
                  </View>
                ))}

                <View className="mt-4 rounded-xl border border-white/[0.06] bg-surface-850 p-4">
                  <Text className="mb-2 text-xs font-semibold uppercase tracking-eyebrow text-accent-400">
                    Terms & Conditions
                  </Text>
                  <ScrollView style={{ maxHeight: 130 }}>
                    <Text className="text-xs leading-5 text-slate-400">
                      • By proceeding with this vote, you acknowledge that your selection is final
                      and cannot be modified after submission.{'\n'}• You certify that you are an
                      eligible voter and have the right to participate in this election.{'\n'}• All
                      votes are confidential and will be counted anonymously.{'\n'}• Any attempt to
                      manipulate or disrupt the voting process is strictly prohibited.{'\n'}• The
                      election administrators reserve the right to invalidate any vote suspected of
                      being fraudulent.{'\n'}• By casting your vote, you agree to abide by all
                      election rules and regulations.{'\n'}
                      {'\n'}• In case of a TIE in the final vote count, the tied candidates will
                      decide between toss coin or draw lots to determine the winner.
                    </Text>
                  </ScrollView>
                </View>

                <TouchableOpacity
                  onPress={() => setShowTermsModal(false)}
                  className="btn btn-primary mt-5 overflow-hidden rounded-2xl">
                  <LinearGradient
                    colors={['#7c3aed', '#a78bfa']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    className="w-full flex-row items-center justify-center py-4">
                    <Ionicons name="checkmark-circle-outline" size={18} color="#fff" />
                    <Text className="ml-2 text-[15px] font-semibold text-white">
                      I Accept — Proceed to Vote
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity onPress={handleLogoutPress} className="btn btn-ghost mt-3">
                  <Ionicons name="log-out-outline" size={16} color="#cbd5e1" />
                  <Text className="ml-2 text-sm font-semibold text-slate-300">Logout</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>

        <LogoutModal
          visible={showLogoutModal}
          onClose={() => setShowLogoutModal(false)}
          onConfirm={handleLogout}
          loading={isLoggingOut}
          title="Log out of voting?"
          description="Your ballot is preserved. You'll need to sign in again to continue voting."
          confirmLabel="Logout"
        />
      </>
    );
  }

  if (!isStarted)
    return (
      <>
        <View className="flex-1 items-center justify-center bg-surface-950 p-10">
          <LinearGradient
            colors={['rgba(99,102,241,0.18)', 'rgba(99,102,241,0)']}
            className="absolute -top-20 h-72 w-72 rounded-full"
          />
          <View className="mb-8 items-center">
            <View className="mb-5 h-20 w-20 items-center justify-center rounded-3xl border border-accent-400/40 bg-surface-800">
              <Image
                source={require('../assets/logo.png')}
                className="h-14 w-14"
                resizeMode="contain"
              />
            </View>
            <Text className="text-xl font-semibold tracking-tight text-white">
              ESOVA Voting Portal
            </Text>
          </View>
          <View className="items-center rounded-2xl border border-amber-500/20 bg-amber-500/10 px-6 py-4">
            <Ionicons name="hourglass-outline" size={22} color="#fbbf24" />
            <Text className="mt-2 text-sm font-semibold text-amber-300">No voting session yet</Text>
            <Text className="mt-1 text-xs text-amber-200/60">
              Please wait for the administrator.
            </Text>
          </View>
          <TouchableOpacity onPress={handleLogoutPress} className="btn btn-ghost mt-8">
            <Ionicons name="log-out-outline" size={16} color="#cbd5e1" />
            <Text className="ml-2 text-sm font-semibold text-slate-300">Logout</Text>
          </TouchableOpacity>
        </View>

        <LogoutModal
          visible={showLogoutModal}
          onClose={() => setShowLogoutModal(false)}
          onConfirm={handleLogout}
          loading={isLoggingOut}
          title="Log out of voting?"
          description="Your ballot is preserved. You'll need to sign in again to continue voting."
          confirmLabel="Logout"
        />
      </>
    );

  return (
    <View className="flex-1 bg-surface-950">
      <View className="flex-1">
        {/* HEADER BAR */}
        <View className="flex-row items-center justify-between border-b border-white/[0.06] bg-surface-900/95 px-5 pb-4 pt-12">
          <View className="flex-row items-center">
            <View className="mr-2.5 h-10 w-10 items-center justify-center rounded-xl border border-violet-500/40 bg-surface-800">
              <Image
                source={require('../assets/logo.png')}
                className="h-7 w-7"
                resizeMode="contain"
              />
            </View>
            <View>
              <Text className="text-base font-bold tracking-tight text-white">E-SOVA</Text>
              <Text className="eyebrow">Voting Portal</Text>
            </View>
          </View>

          <View className="items-center rounded-xl border border-primary-500/25 bg-primary-500/10 px-3.5 py-1.5">
            <Text className="text-[10px] font-semibold uppercase tracking-eyebrow text-slate-400">
              {isEnded ? 'Session' : 'Time Left'}
            </Text>
            <Text
              className={`font-mono text-sm font-semibold ${isEnded ? 'text-rose-300' : 'text-primary-300'}`}>
              {timeLeft}
            </Text>
          </View>

          <TouchableOpacity
            onPress={handleLogoutPress}
            className="items-center justify-center rounded-xl border border-rose-500/25 bg-rose-500/10 px-3 py-2.5 active:bg-rose-500/20">
            <Ionicons name="log-out-outline" size={16} color="#fb7185" />
          </TouchableOpacity>
        </View>

        <ScrollView className="flex-1 px-4 pt-4">
          {/* LOGIC: IF ELECTION ENDED AND USER IS NOT VIEWING RECEIPT */}
          {isEnded && !showReceiptOverride ? (
            <View>
              {electionSettings?.results_published ? (
                /* OFFICIAL RESULTS PANEL - SHOWS ALL CANDIDATES WITH VOTES */
                <View className="card mb-8 p-6">
                  <View className="mb-6 items-center">
                    <View className="mb-3 h-12 w-12 items-center justify-center rounded-2xl border border-accent-400/40 bg-accent-400/10">
                      <Ionicons name="trophy-outline" size={22} color="#fbbf24" />
                    </View>
                    <Text className="text-center text-2xl font-bold tracking-tight text-white">
                      Official Results
                    </Text>
                    <Text className="mt-1 text-xs text-slate-500">
                      The votes are in. Congratulations to all candidates.
                    </Text>
                  </View>
                  {positions.map((pos) => {
                    const sorted = candidates
                      .filter((c) => c.position === pos)
                      .sort((a, b) => b.votes - a.votes);
                    if (sorted.length === 0) return null;
                    const maxVotes = Math.max(...sorted.map((c) => c.votes || 0));
                    return (
                      <View key={pos} className="mb-6">
                        <Text className="mb-3 text-xs font-semibold uppercase tracking-eyebrow text-primary-300">
                          {pos}
                        </Text>
                        {sorted.map((cand, index) => {
                          const isWinner = index === 0 && cand.votes > 0;
                          const share =
                            maxVotes > 0 ? Math.round(((cand.votes || 0) / maxVotes) * 100) : 0;
                          return (
                            <View
                              key={cand.id}
                              className={`mb-2.5 rounded-xl border p-3.5 ${
                                isWinner
                                  ? 'border-accent-400/30 bg-accent-400/[0.07]'
                                  : 'border-white/[0.05] bg-surface-850'
                              }`}>
                              <View className="flex-row items-center">
                                <Text
                                  className={`mr-3 w-7 text-base font-bold ${
                                    isWinner ? 'text-accent-400' : 'text-slate-500'
                                  }`}>
                                  {index + 1}.
                                </Text>
                                <View className="flex-1">
                                  <Text
                                    className={`text-base font-semibold ${isWinner ? 'text-white' : 'text-slate-200'}`}>
                                    {cand.name}
                                  </Text>
                                  <View className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-white/[0.08]">
                                    <View
                                      className={`h-full rounded-full ${isWinner ? 'bg-accent-400' : 'bg-primary-500/50'}`}
                                      style={{ width: `${share}%` }}
                                    />
                                  </View>
                                </View>
                                <View className="ml-3 items-end">
                                  <Text
                                    className={`text-lg font-bold ${isWinner ? 'text-accent-400' : 'text-white'}`}>
                                    {cand.votes || 0}
                                  </Text>
                                  {isWinner && (
                                    <View className="flex-row items-center">
                                      <Ionicons name="trophy" size={11} color="#fbbf24" />
                                      <Text className="ml-1 text-[10px] font-bold uppercase tracking-eyebrow text-accent-400">
                                        Winner
                                      </Text>
                                    </View>
                                  )}
                                </View>
                              </View>
                            </View>
                          );
                        })}
                      </View>
                    );
                  })}
                  <TouchableOpacity
                    onPress={() => setShowReceiptOverride(true)}
                    className="btn btn-ghost mb-2 mt-2">
                    <Ionicons name="receipt-outline" size={16} color="#a5b4fc" />
                    <Text className="ml-2 text-sm font-semibold text-primary-200">
                      View My Ballot Receipt
                    </Text>
                  </TouchableOpacity>
                </View>
              ) : (
                /* POLLS CLOSED STATE (Hides candidate list even if user hasn't voted) */
                <View className="card mb-8 items-center p-10">
                  <View className="mb-4 h-14 w-14 items-center justify-center rounded-2xl border border-white/[0.08] bg-surface-850">
                    <Ionicons name="stopwatch-outline" size={24} color="#94a3b8" />
                  </View>
                  <Text className="text-lg font-semibold text-white">The election has ended</Text>
                  <Text className="mt-2 text-center text-sm text-slate-500">
                    Please wait for the administrator to flash the official results.
                  </Text>
                  {userData?.has_voted && (
                    <TouchableOpacity
                      onPress={() => setShowReceiptOverride(true)}
                      className="btn btn-ghost mt-6">
                      <Ionicons name="receipt-outline" size={16} color="#a5b4fc" />
                      <Text className="ml-2 text-sm font-semibold text-primary-200">
                        View Ballot Receipt
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
                  {/* Step Indicator */}
                  <View className="mb-4 flex-row items-center justify-center gap-2">
                    {['Select', 'Review', 'Cast'].map((label, i) => {
                      const stepNum = i + 1;
                      const isActive = step === stepNum;
                      const isDone = step > stepNum;
                      return (
                        <React.Fragment key={label}>
                          {i > 0 && (
                            <View
                              className={`h-px flex-1 ${
                                isDone || isActive ? 'bg-violet-500' : 'bg-white/[0.08]'
                              }`}
                            />
                          )}
                          <View className="items-center">
                            <View
                              className={`h-7 w-7 items-center justify-center rounded-full ${
                                isActive
                                  ? 'bg-violet-500'
                                  : isDone
                                    ? 'bg-violet-500/30'
                                    : 'bg-white/[0.06]'
                              }`}>
                              {isDone ? (
                                <Ionicons name="checkmark" size={14} color="#c4b5fd" />
                              ) : (
                                <Text
                                  className={`text-xs font-bold ${
                                    isActive ? 'text-white' : 'text-slate-500'
                                  }`}>
                                  {stepNum}
                                </Text>
                              )}
                            </View>
                            <Text
                              className={`mt-1 text-[10px] font-semibold ${
                                isActive ? 'text-violet-300' : 'text-slate-500'
                              }`}>
                              {label}
                            </Text>
                          </View>
                        </React.Fragment>
                      );
                    })}
                  </View>

                  {/* Voter greeting */}
                  <View className="card mb-4 flex-row items-center p-4">
                    <View className="mr-3 h-12 w-12 items-center justify-center rounded-full border border-primary-500/40 bg-primary-500/15">
                      <Text className="text-sm font-bold text-primary-300">
                        {initials(userData?.name)}
                      </Text>
                    </View>
                    <View className="flex-1">
                      <Text className="text-base font-semibold text-white">
                        Hi, {userData?.name}!
                      </Text>
                      <Text className="text-xs font-semibold uppercase tracking-eyebrow text-slate-500">
                        ID: {userData?.student_id}
                      </Text>
                    </View>
                    <View className="items-end">
                      <Text className="text-xs text-slate-500">Selection</Text>
                      <Text className="text-sm font-semibold text-primary-300">
                        {selectedCount}/{totalPositions}
                      </Text>
                    </View>
                  </View>

                  {/* Selection progress */}
                  <View className="mb-5">
                    <View className="mb-1.5 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.08]">
                      <View
                        className="h-full rounded-full bg-primary-500"
                        style={{ width: `${progressPct}%` }}
                      />
                    </View>
                    <Text className="text-right text-[11px] text-slate-500">
                      {progressPct === 100
                        ? 'Ballot complete — review below'
                        : `${totalPositions - selectedCount} position${totalPositions - selectedCount !== 1 ? 's' : ''} remaining`}
                    </Text>
                  </View>

                  {/* Position tabs */}
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    className="mb-5 flex-row rounded-2xl border border-white/[0.06] bg-surface-850 p-1">
                    {positions.map((pos) => (
                      <TouchableOpacity
                        key={pos}
                        onPress={() => setActiveTab(pos)}
                        className={`rounded-xl px-5 py-2.5 ${
                          activeTab === pos ? 'bg-primary-500' : ''
                        }`}>
                        <Text
                          className={`text-xs font-semibold ${
                            activeTab === pos ? 'text-white' : 'text-slate-400'
                          }`}>
                          {pos}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>

                  {/* Candidate cards */}
                  {candidates
                    .filter((c) => c.position === activeTab)
                    .map((candidate) => {
                      const isSelected = selectedVotes[activeTab]?.id === candidate.id;
                      return (
                        <TouchableOpacity
                          key={candidate.id}
                          onPress={() =>
                            setSelectedVotes({ ...selectedVotes, [activeTab]: candidate })
                          }
                          activeOpacity={0.9}
                          className={`mb-3 overflow-hidden rounded-2xl border p-[1.5px] active:scale-[0.98] ${
                            isSelected ? 'border-transparent' : 'border-white/[0.06]'
                          }`}>
                          <LinearGradient
                            colors={
                              isSelected
                                ? ['#7c3aed', '#fbbf24']
                                : ['rgba(255,255,255,0.06)', 'rgba(255,255,255,0.06)']
                            }
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            className="rounded-[14px]">
                            <View
                              className={`flex-row items-center rounded-[13.5px] p-4 ${
                                isSelected ? 'bg-surface-900/95' : 'bg-surface-800'
                              }`}>
                              <View className="relative mr-3.5">
                                <Image
                                  source={{ uri: candidate.image || DEFAULT_AVATAR }}
                                  className={`h-16 w-16 rounded-2xl bg-surface-850 ${
                                    isSelected
                                      ? 'border-2 border-primary-400'
                                      : 'border border-white/10'
                                  }`}
                                />
                                {isSelected && (
                                  <View className="absolute -right-1.5 -top-1.5 h-6 w-6 items-center justify-center rounded-full bg-accent-400">
                                    <Ionicons name="checkmark" size={13} color="#08090d" />
                                  </View>
                                )}
                              </View>
                              <View className="flex-1">
                                <Text
                                  className={`text-base font-semibold ${
                                    isSelected ? 'text-white' : 'text-slate-100'
                                  }`}>
                                  {candidate.name}
                                </Text>
                                <Text className="text-xs uppercase tracking-eyebrow text-slate-500">
                                  {candidate.course} • Year {candidate.year}
                                </Text>
                                <TouchableOpacity
                                  onPress={() => setViewingCandidate(candidate)}
                                  className="mt-1.5 self-start">
                                  <Text className="text-xs font-semibold text-primary-300 underline">
                                    View profile
                                  </Text>
                                </TouchableOpacity>
                              </View>
                              <View
                                className={`ml-3 h-7 w-7 items-center justify-center rounded-full border-2 ${
                                  isSelected
                                    ? 'border-accent-400 bg-accent-400'
                                    : 'border-white/20 bg-surface-850'
                                }`}>
                                {!isSelected && (
                                  <View className="h-2 w-2 rounded-full bg-white/20" />
                                )}
                              </View>
                            </View>
                          </LinearGradient>
                        </TouchableOpacity>
                      );
                    })}

                  {candidates.filter((c) => c.position === activeTab).length === 0 && (
                    <View className="items-center rounded-2xl border border-dashed border-white/[0.08] p-8">
                      <Ionicons name="person-outline" size={26} color="#334155" />
                      <Text className="mt-2 text-sm text-slate-500">
                        No candidates for this position yet.
                      </Text>
                    </View>
                  )}

                  {/* Review ballot CTA */}
                  {progressPct === 100 && (
                    <TouchableOpacity
                      onPress={() => setStep(2)}
                      activeOpacity={0.95}
                      className="mb-10 mt-6 overflow-hidden rounded-2xl active:scale-[0.97]">
                      <LinearGradient
                        colors={['#7c3aed', '#a78bfa']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        className="w-full flex-row items-center justify-center py-4">
                        <Ionicons name="shield-checkmark-outline" size={18} color="#fff" />
                        <Text className="ml-2 text-[15px] font-semibold text-white">
                          Review Ballot
                        </Text>
                        <Ionicons name="arrow-forward" size={16} color="#fff" className="ml-2" />
                      </LinearGradient>
                    </TouchableOpacity>
                  )}
                </View>
              )}

              {step === 2 && !isEnded && (
                <View className="card mb-8 p-6">
                  {/* Step Indicator */}
                  <View className="mb-5 flex-row items-center justify-center gap-2">
                    {['Select', 'Review', 'Cast'].map((label, i) => {
                      const stepNum = i + 1;
                      const isActive = step === stepNum;
                      const isDone = step > stepNum;
                      return (
                        <React.Fragment key={label}>
                          {i > 0 && (
                            <View
                              className={`h-px flex-1 ${
                                isDone || isActive ? 'bg-violet-500' : 'bg-white/[0.08]'
                              }`}
                            />
                          )}
                          <View className="items-center">
                            <View
                              className={`h-7 w-7 items-center justify-center rounded-full ${
                                isActive
                                  ? 'bg-violet-500'
                                  : isDone
                                    ? 'bg-violet-500/30'
                                    : 'bg-white/[0.06]'
                              }`}>
                              {isDone ? (
                                <Ionicons name="checkmark" size={14} color="#c4b5fd" />
                              ) : (
                                <Text
                                  className={`text-xs font-bold ${
                                    isActive ? 'text-white' : 'text-slate-500'
                                  }`}>
                                  {stepNum}
                                </Text>
                              )}
                            </View>
                            <Text
                              className={`mt-1 text-[10px] font-semibold ${
                                isActive ? 'text-violet-300' : 'text-slate-500'
                              }`}>
                              {label}
                            </Text>
                          </View>
                        </React.Fragment>
                      );
                    })}
                  </View>

                  <View className="mb-5 items-center">
                    <View className="mb-3 h-12 w-12 items-center justify-center rounded-2xl border border-primary-500/30 bg-primary-500/15">
                      <Ionicons name="eye-outline" size={22} color="#a5b4fc" />
                    </View>
                    <Text className="text-2xl font-bold tracking-tight text-white">
                      Review Ballot
                    </Text>
                    <Text className="mt-1 text-xs text-slate-500">
                      Make sure your selections are correct before casting.
                    </Text>
                  </View>
                  {positions.map((pos) => (
                    <View
                      key={pos}
                      className="mb-2.5 flex-row items-center justify-between rounded-xl border border-white/[0.06] bg-surface-850 p-4">
                      <View className="flex-row items-center">
                        <View className="mr-3 h-8 w-8 items-center justify-center rounded-full bg-primary-500/15">
                          <Ionicons name="checkmark" size={14} color="#a5b4fc" />
                        </View>
                        <View>
                          <Text className="text-[10px] font-semibold uppercase tracking-eyebrow text-slate-500">
                            {pos}
                          </Text>
                          <Text className="text-sm font-semibold text-white">
                            {selectedVotes[pos]?.name}
                          </Text>
                        </View>
                      </View>
                      <TouchableOpacity
                        onPress={() => {
                          setStep(1);
                          setActiveTab(pos);
                        }}
                        className="rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-1.5">
                        <Text className="text-xs font-semibold text-primary-300">Edit</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                  <TouchableOpacity
                    onPress={handleVoteSubmit}
                    disabled={loading}
                    activeOpacity={0.95}
                    className="mb-8 mt-6 overflow-hidden rounded-2xl active:scale-[0.97] disabled:opacity-60">
                    <LinearGradient
                      colors={['#f43f5e', '#be123c']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      className="w-full flex-row items-center justify-center py-4">
                      {loading ? (
                        <ActivityIndicator color="#fff" size="small" />
                      ) : (
                        <>
                          <Ionicons name="checkmark-done" size={18} color="#fff" />
                          <Text className="ml-2 text-[15px] font-semibold text-white">
                            Cast Vote Now
                          </Text>
                        </>
                      )}
                    </LinearGradient>
                  </TouchableOpacity>
                </View>
              )}

              {/* PERSISTENT RECEIPT VIEW (Accessible via Step 3 or Override) */}
              {(step === 3 || showReceiptOverride) && (
                <View>
                  <View className="mb-4 mt-4 rounded-2xl border border-accent-400/25 bg-white p-6">
                    <View className="items-center">
                      <View className="mb-2 h-11 w-11 items-center justify-center rounded-full bg-accent-400/20">
                        <Ionicons name="ribbon-outline" size={20} color="#d97706" />
                      </View>
                      <Text className="text-center text-xl font-bold tracking-tight text-black">
                        OFFICIAL RECEIPT
                      </Text>
                      <Text className="mt-1 text-[10px] font-semibold uppercase tracking-eyebrow text-black/40">
                        ESOVA Election • Confidential
                      </Text>
                    </View>
                    <View className="my-4 border border-dashed border-black/15" />
                    <View className="mb-4">
                      <Text className="text-[11px] font-bold uppercase tracking-eyebrow text-black/50">
                        Voter: {userData?.name}
                      </Text>
                      <Text className="mt-0.5 text-[11px] font-bold uppercase tracking-eyebrow text-black/50">
                        ID: {userData?.student_id}
                      </Text>
                      <Text className="mt-0.5 text-[11px] font-bold uppercase tracking-eyebrow text-black/50">
                        Time Cast: {userData?.voted_at}
                      </Text>
                    </View>
                    <View className="rounded-xl bg-black/[0.04] p-4">
                      {positions.map((pos) => (
                        <View
                          key={pos}
                          className="flex-row items-center justify-between border-b border-black/[0.06] py-2.5 last:border-b-0">
                          <Text className="text-xs font-semibold uppercase tracking-eyebrow text-black/50">
                            {pos}
                          </Text>
                          <View className="flex-row items-center">
                            <Ionicons name="checkmark-circle" size={14} color="#d97706" />
                            <Text className="ml-1.5 text-sm font-bold text-black">
                              {selectedVotes[pos]?.name?.toUpperCase()}
                            </Text>
                          </View>
                        </View>
                      ))}
                    </View>
                    <View className="mt-5 items-center rounded-xl bg-accent-400/15 px-4 py-3">
                      <Text className="text-center text-[10px] font-semibold uppercase tracking-eyebrow text-black/60">
                        Thank you for voting. Your voice matters.
                      </Text>
                    </View>
                  </View>
                  {isEnded && (
                    <TouchableOpacity
                      onPress={() => setShowReceiptOverride(false)}
                      className="btn btn-ghost mb-20 mt-2">
                      <Ionicons name="arrow-back-outline" size={16} color="#cbd5e1" />
                      <Text className="ml-2 text-sm font-semibold text-slate-300">
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
        <View className="flex-1 items-center justify-center bg-black/80 p-6">
          <View className="card w-full overflow-hidden !rounded-3xl border-white/[0.1]">
            <LinearGradient colors={['#161d33', '#101627']} className="items-center p-6">
              <Image
                source={{ uri: viewingCandidate?.image || DEFAULT_AVATAR }}
                className="h-24 w-24 rounded-2xl border-2 border-accent-400/40 bg-surface-800"
              />
              <Text className="mt-4 text-xl font-semibold tracking-tight text-white">
                {viewingCandidate?.name}
              </Text>
              <Text className="text-xs font-semibold uppercase tracking-eyebrow text-accent-400">
                {viewingCandidate?.position}
              </Text>
              <Text className="mt-1 text-xs text-slate-400">
                {viewingCandidate?.course} • Year {viewingCandidate?.year}
              </Text>
            </LinearGradient>
            <View className="p-6 pt-4">
              <Text className="label">Background & Achievements</Text>
              <Text className="text-sm leading-5 text-slate-300">
                {viewingCandidate?.background || 'No platform information provided.'}
              </Text>
              <TouchableOpacity
                onPress={() => setViewingCandidate(null)}
                className="btn btn-primary mt-6">
                <Text className="text-[15px] font-semibold text-white">Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <LogoutModal
        visible={showLogoutModal}
        onClose={() => setShowLogoutModal(false)}
        onConfirm={handleLogout}
        loading={isLoggingOut}
        title="Log out of voting?"
        description="Your ballot is preserved. You'll need to sign in again to continue voting."
        confirmLabel="Logout"
      />
    </View>
  );
};

export default VoterScreen;
