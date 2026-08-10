import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  Alert,
  ScrollView,
  Image,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { DEFAULT_AVATAR } from '../../hooks/useAdminData';
import { supabase } from '../../config/supabase';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { LinearGradient } from 'expo-linear-gradient';

const DEFAULT_POSITIONS = ['President', 'VP', 'Secretary', 'Treasurer'];

export const OverviewSection = ({ voters, candidates, handleResetElection }: any) => {
  const [duration, setDuration] = useState('60');
  const [timeUnit, setTimeUnit] = useState<'min' | 'sec'>('min');
  const [settings, setSettings] = useState<any>(null);
  const [timeLeft, setTimeLeft] = useState<string>('00:00');
  const [isVotingOver, setIsVotingOver] = useState(false);
  const [positions, setPositions] = useState<string[]>(DEFAULT_POSITIONS);
  const [showSessionModal, setShowSessionModal] = useState(false);

  // Sync custom positions with Supabase
  useEffect(() => {
    const fetchPositions = async () => {
      try {
        const { data, error } = await supabase.from('positions').select('name').order('name');
        if (error) throw error;
        if (data && data.length > 0) {
          setPositions(data.map((p: any) => p.name));
        } else {
          setPositions(DEFAULT_POSITIONS);
        }
      } catch (error) {
        console.error('Error fetching positions:', error);
        setPositions(DEFAULT_POSITIONS);
      }
    };

    fetchPositions();

    const channel = supabase
      .channel('overview-positions')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'positions' }, (payload) => {
        fetchPositions();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Sync with Supabase Settings
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const { data, error } = await supabase
          .from('settings')
          .select('*')
          .eq('id', 'election_control')
          .single();

        if (data) setSettings(data);
        else if (error && error.code !== 'PGRST116') {
          // PGRST116 = no rows returned, which is fine for first-time
          console.error('Error fetching settings:', error);
        }
      } catch (error) {
        console.error('Error:', error);
      }
    };

    fetchSettings();

    // Subscribe to settings changes
    const channel = supabase
      .channel('overview-settings')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'settings' },
        (payload: any) => {
          if (payload.new && payload.new.id === 'election_control') {
            setSettings(payload.new);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Real-time Countdown & Auto-UI Logic
  useEffect(() => {
    const timer = setInterval(() => {
      if (settings?.end_time && settings?.status === 'started') {
        const now = Date.now();
        const endTime = new Date(settings.end_time).getTime();
        const diff = endTime - now;

        if (diff <= 0) {
          setTimeLeft('00:00');
          setIsVotingOver(true); // Automatically triggers the Flash button
        } else {
          setIsVotingOver(false);
          const m = Math.floor(diff / 60000);
          const s = Math.floor((diff % 60000) / 1000);
          setTimeLeft(`${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`);
        }
      } else {
        setTimeLeft('00:00');
        setIsVotingOver(false);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [settings]);

  const totalVotesCast = candidates.reduce((acc: number, curr: any) => acc + (curr.votes || 0), 0);
  const votedCount = voters.filter((v: any) => v.has_voted).length;
  const turnout = voters.length > 0 ? Math.round((votedCount / voters.length) * 100) : 0;

  const handleStartVoting = async () => {
    const multiplier = timeUnit === 'min' ? 60000 : 1000;
    const endTime = Date.now() + parseInt(duration) * multiplier;

    // Upsert settings
    const { error } = await supabase.from('settings').upsert(
      {
        id: 'election_control',
        status: 'started',
        end_time: new Date(endTime).toISOString(),
        results_published: false,
      },
      { onConflict: 'id' }
    );

    if (error) {
      console.error('Error starting election:', error);
      Alert.alert('Error', 'Failed to start election.');
      return;
    }
    Alert.alert('Success', 'Election session is now live.');
    setShowSessionModal(false);
  };

  const handleToggleResults = async () => {
    if (totalVotesCast === 0) {
      Alert.alert('Action Denied', 'No votes recorded yet.');
      return;
    }

    const newPublishedState = !settings?.results_published;

    const { error } = await supabase
      .from('settings')
      .update({ results_published: newPublishedState })
      .eq('id', 'election_control');

    if (error) {
      console.error('Error updating results:', error);
      Alert.alert('Error', 'Failed to update results visibility.');
    } else {
      Alert.alert(
        newPublishedState ? 'Results Published' : 'Results Hidden',
        newPublishedState
          ? 'The election results are now visible to all voters.'
          : 'The election results are now hidden from voters.'
      );
    }
  };

  const handlePrint = async () => {
    const date = new Date().toLocaleDateString();

    // Sort by Official Hierarchy then by Votes
    const sortedCandidates = [...candidates].sort((a, b) => {
      const posA = positions.indexOf(a.position);
      const posB = positions.indexOf(b.position);
      if (posA !== posB) return posA - posB;
      return (b.votes || 0) - (a.votes || 0);
    });

    const rows = sortedCandidates
      .map(
        (c: any) => `
      <tr>
        <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; color: #475569;">${c.position}</td>
        <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; color: #0f172a; font-weight: 600;">${c.name}</td>
        <td style="padding: 12px; border-bottom: 1px solid #e2e8f0; text-align: center; color: #0f172a; font-weight: 700;">${c.votes || 0}</td>
      </tr>
    `
      )
      .join('');

    const html = `
      <html>
        <body style="font-family: -apple-system, sans-serif; padding: 40px; color: #0f172a;">
          <div style="text-align: center; margin-bottom: 8px; letter-spacing: 2px; font-size: 12px; color: #d97706; font-weight: 600;">ESCR STUDENT ORGANIZATION</div>
          <h1 style="text-align: center; margin: 0 0 4px; font-size: 26px; color: #0f172a;">Official Election Results</h1>
          <p style="text-align: center; color: #64748b; margin: 0 0 32px;">Date: ${date}</p>
          <table style="width: 100%; border-collapse: collapse;">
            <thead>
              <tr style="background-color: #7c3aed; color: white;">
                <th style="padding: 12px; text-align: left;">POSITION</th>
                <th style="padding: 12px; text-align: left;">CANDIDATE</th>
                <th style="padding: 12px; text-align: center;">TOTAL VOTES</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
          <p style="margin-top: 32px; color: #64748b;">Total Registered Voters: ${voters.length} &middot; Voter Turnout: ${turnout}%</p>
        </body>
      </html>
    `;

    try {
      const { uri } = await Print.printToFileAsync({ html });
      await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
    } catch {
      Alert.alert('Error', 'Could not generate PDF.');
    }
  };

  const onResetPress = () => {
    Alert.alert('Reset Election', 'Clear all data and return to setup?', [
      { text: 'Cancel' },
      {
        text: 'Reset',
        style: 'destructive',
        onPress: async () => {
          await supabase.from('settings').upsert(
            {
              id: 'election_control',
              status: 'idle',
              end_time: null,
              results_published: false,
            },
            { onConflict: 'id' }
          );

          handleResetElection();
        },
      },
    ]);
  };

  const statusLabel =
    settings?.status === 'started' ? (isVotingOver ? 'Session Ended' : 'Session Active') : 'Ready';
  const statusColor = isVotingOver
    ? 'text-rose-300'
    : settings?.status === 'started'
      ? 'text-emerald-300'
      : 'text-slate-400';
  const statusBg = isVotingOver
    ? 'bg-rose-500/10 border-rose-500/25'
    : settings?.status === 'started'
      ? 'bg-emerald-500/10 border-emerald-500/25'
      : 'bg-white/[0.04] border-white/[0.08]';

  return (
    <ScrollView showsVerticalScrollIndicator={false}>
      {/* SESSION STATUS BANNER */}
      <View className={`mb-5 flex-row items-center rounded-2xl border p-4 ${statusBg}`}>
        <View className={`mr-3 h-9 w-9 items-center justify-center rounded-xl ${statusBg}`}>
          <Ionicons
            name={
              isVotingOver
                ? 'flag-outline'
                : settings?.status === 'started'
                  ? 'pulse-outline'
                  : 'radio-button-on-outline'
            }
            size={16}
            color={
              statusColor.includes('rose')
                ? '#fb7185'
                : statusColor.includes('emerald')
                  ? '#34d399'
                  : '#94a3b8'
            }
          />
        </View>
        <View className="flex-1">
          <Text className={`text-sm font-bold uppercase tracking-eyebrow ${statusColor}`}>
            {statusLabel}
          </Text>
          <Text className="mt-0.5 text-xs text-slate-500">
            {isVotingOver
              ? 'Voting has concluded. Flash results or print the tally.'
              : settings?.status === 'started'
                ? 'Ballots are being accepted in real-time.'
                : 'Configure a timed session to open the polls.'}
          </Text>
        </View>
      </View>

      {/* TIMER & CONTROLS */}
      <View className="card mb-5 p-5">
        <View className="mb-4 flex-row items-center justify-between">
          <View>
            <Text className="eyebrow">Session Controls</Text>
            <Text className="text-lg font-semibold text-white">Election Timer</Text>
          </View>
          <View
            className={`rounded-xl border px-4 py-2 ${
              isVotingOver
                ? 'border-rose-500/25 bg-rose-500/10'
                : settings?.status === 'started'
                  ? 'border-emerald-500/25 bg-emerald-500/10'
                  : 'border-primary-500/25 bg-primary-500/10'
            }`}>
            <Text
              className={`font-mono text-xl font-semibold ${
                isVotingOver ? 'text-rose-300' : 'text-primary-300'
              }`}>
              {timeLeft}
            </Text>
          </View>
        </View>

        {settings?.status !== 'started' ? (
          /* --- READY STATE: show summary + action, form lives in modal --- */
          <View className="flex-row items-center justify-between">
            <View className="flex-1 pr-4">
              <Text className="text-sm font-semibold text-white">Ready to open voting</Text>
              <Text className="mt-0.5 text-xs text-slate-500">
                Set a duration and open the polls to voters.
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => setShowSessionModal(true)}
              activeOpacity={0.95}
              className="overflow-hidden rounded-2xl active:scale-[0.97]">
              <LinearGradient
                colors={['#7c3aed', '#a78bfa']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                className="flex-row items-center px-5 py-3">
                <Ionicons name="play" size={16} color="#fff" />
                <Text className="ml-1.5 text-sm font-semibold text-white">Start Session</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        ) : (
          /* --- ACTIVE / ENDED STATE: read-only summary + flash action --- */
          <View>
            <View className="mb-3 flex-row items-center">
              <View
                className={`mr-3 h-9 w-9 items-center justify-center rounded-xl ${
                  isVotingOver
                    ? 'border border-rose-500/25 bg-rose-500/10'
                    : 'border border-emerald-500/25 bg-emerald-500/10'
                }`}>
                <Ionicons
                  name={isVotingOver ? 'flag-outline' : 'pulse-outline'}
                  size={16}
                  color={isVotingOver ? '#fb7185' : '#34d399'}
                />
              </View>
              <View className="flex-1">
                <Text className="text-sm font-semibold text-white">
                  {isVotingOver ? 'Voting has ended' : 'Voting is live'}
                </Text>
                <Text className="mt-0.5 text-xs text-slate-500">
                  {isVotingOver
                    ? 'All ballots are in. Flash results or print the official tally.'
                    : `Ballots close in ${timeLeft}. Results stay hidden until you publish.`}
                </Text>
              </View>
            </View>

            {isVotingOver && (
              <TouchableOpacity
                onPress={handleToggleResults}
                className={`${
                  settings?.results_published
                    ? 'border border-rose-500/25 bg-rose-500/10'
                    : 'bg-primary-500'
                } items-center rounded-xl p-4`}>
                <Text
                  className={`${
                    settings?.results_published ? 'text-rose-300' : 'text-white'
                  } text-sm font-semibold uppercase tracking-eyebrow`}>
                  {settings?.results_published
                    ? 'Hide Results from Voters'
                    : 'Flash Results to Voters'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>

      {/* STATS GRID */}
      <View className="mb-5 flex-row gap-3">
        <View className="card flex-1 p-4">
          <Text className="eyebrow">Turnout</Text>
          <Text className="mt-2 text-3xl font-bold tracking-tight text-white">{votedCount}</Text>
          <Text className="text-xs text-slate-500">of {voters.length} voters</Text>
          <View className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.08]">
            <View className="h-full rounded-full bg-primary-500" style={{ width: `${turnout}%` }} />
          </View>
          <Text className="mt-1.5 text-xs font-semibold text-primary-300">{turnout}% turnout</Text>
        </View>
        <View className="card flex-1 p-4">
          <Text className="eyebrow">Votes Cast</Text>
          <Text className="mt-2 text-3xl font-bold tracking-tight text-white">
            {totalVotesCast}
          </Text>
          <Text className="text-xs text-slate-500">across all positions</Text>
          <View className="mt-3 flex-row items-center">
            <Ionicons name="bar-chart-outline" size={14} color="#fbbf24" />
            <Text className="ml-1.5 text-xs font-semibold text-accent-400">
              {candidates.length} candidates
            </Text>
          </View>
        </View>
      </View>

      {/* ACTIONS */}
      <View className="card mb-5 p-4">
        <Text className="eyebrow">Administration</Text>
        <Text className="mt-0.5 text-sm text-slate-400">Reset data or export results</Text>
        <View className="mt-3 flex-row flex-wrap gap-2">
          {isVotingOver && settings?.status === 'started' && (
            <TouchableOpacity onPress={handlePrint} className="btn btn-ghost px-4 py-2.5">
              <Ionicons name="print-outline" size={15} color="#cbd5e1" />
              <Text className="ml-1.5 text-xs font-semibold text-slate-200">Print</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={onResetPress} className="btn btn-danger px-4 py-2.5">
            <Ionicons name="refresh-outline" size={15} color="#fb7185" />
            <Text className="ml-1.5 text-xs font-semibold text-rose-300">Reset</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* CANDIDATES TABLE */}
      {positions.map((pos) => {
        const posCand = candidates.filter((c: any) => c.position === pos);
        if (posCand.length === 0) return null;

        const sortedCand = [...posCand].sort((a, b) => (b.votes || 0) - (a.votes || 0));
        const maxVotes = Math.max(...posCand.map((c: any) => c.votes || 0));
        const totalPosVotes = posCand.reduce((acc: number, c: any) => acc + (c.votes || 0), 0);

        return (
          <View key={pos} className="card mb-5 p-5">
            <View className="mb-4 flex-row items-center justify-between">
              <Text className="text-base font-semibold text-white">{pos}</Text>
              <Text className="eyebrow">
                {totalPosVotes} vote{totalPosVotes !== 1 ? 's' : ''}
              </Text>
            </View>
            {sortedCand.map((c: any, index: number) => {
              const isWinner = isVotingOver && c.votes === maxVotes && maxVotes > 0;
              const isFirst = index === 0;
              const tiedCandidates = posCand.filter((x: any) => x.votes === maxVotes);
              const hasTie = isVotingOver && tiedCandidates.length > 1 && maxVotes > 0;
              const isTied = c.votes === maxVotes && hasTie;
              // Standard competition ranking: #1 for the top group, tied members share
              // the same integer rank (no fractional ranks like #1.5).
              const rankDisplay =
                sortedCand.filter((x: any) => (x.votes || 0) > (c.votes || 0)).length + 1;
              const voteShare =
                totalPosVotes > 0 ? Math.round(((c.votes || 0) / totalPosVotes) * 100) : 0;

              return (
                <View
                  key={c.id}
                  className={`mb-2.5 rounded-xl border p-3 ${
                    isTied
                      ? 'border-violet-500/30 bg-violet-500/10'
                      : isFirst
                        ? 'border-accent-400/25 bg-accent-400/[0.06]'
                        : 'border-white/[0.05] bg-surface-850'
                  }`}>
                  <View className="flex-row items-center">
                    <Text
                      className={`mr-3 w-8 text-lg font-bold ${
                        isTied ? 'text-violet-300' : isFirst ? 'text-accent-400' : 'text-slate-500'
                      }`}>
                      #{rankDisplay}
                    </Text>
                    <Image
                      source={{ uri: c.image || DEFAULT_AVATAR }}
                      className={`mr-3 h-11 w-11 rounded-full ${
                        isFirst ? 'border border-accent-400/40' : 'border border-white/10'
                      }`}
                    />
                    <View className="flex-1">
                      <Text
                        className={`text-base font-semibold ${isTied ? 'text-violet-200' : 'text-white'}`}>
                        {c.name}
                      </Text>
                      <View className="mt-1 h-1 w-full overflow-hidden rounded-full bg-white/[0.08]">
                        <View
                          className={`h-full rounded-full ${
                            isTied
                              ? 'bg-violet-400'
                              : isFirst
                                ? 'bg-accent-400'
                                : 'bg-primary-500/60'
                          }`}
                          style={{ width: `${voteShare}%` }}
                        />
                      </View>
                    </View>
                    <View className="ml-3 items-end">
                      <Text
                        className={`text-xl font-bold ${
                          isTied ? 'text-violet-300' : isWinner ? 'text-accent-400' : 'text-white'
                        }`}>
                        {c.votes || 0}
                      </Text>
                      <Text className="text-[10px] text-slate-500">{voteShare}%</Text>
                    </View>
                  </View>
                  {isTied && (
                    <View className="mt-2 flex-row items-center">
                      <Ionicons name="git-compare-outline" size={13} color="#c4b5fd" />
                      <Text className="ml-1.5 text-xs font-semibold text-violet-300">Tie</Text>
                    </View>
                  )}
                  {isWinner && !isTied && (
                    <View className="mt-2 flex-row items-center">
                      <Ionicons name="trophy-outline" size={13} color="#fbbf24" />
                      <Text className="ml-1.5 text-xs font-semibold text-accent-400">Winner</Text>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        );
      })}

      {/* --- START SESSION MODAL --- */}
      <Modal
        visible={showSessionModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowSessionModal(false)}>
        <View className="flex-1 justify-end bg-black/80">
          <View className="max-h-[80%] overflow-hidden !rounded-t-3xl border-white/[0.1] bg-surface-900">
            <View className="flex-row items-center justify-between border-b border-white/[0.06] p-5">
              <View>
                <Text className="eyebrow">Session Setup</Text>
                <Text className="text-lg font-semibold text-white">Start Voting Session</Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowSessionModal(false)}
                className="h-9 w-9 items-center justify-center rounded-full border border-white/[0.08] bg-surface-850">
                <Ionicons name="close" size={16} color="#94a3b8" />
              </TouchableOpacity>
            </View>

            <ScrollView className="p-5" showsVerticalScrollIndicator={false}>
              <Text className="mb-2 text-sm text-slate-400">
                Choose how long voters have to submit their ballots. Results stay hidden until you
                publish them.
              </Text>

              <Text className="label mt-1">Duration</Text>
              <View className="mb-4 flex-row items-center">
                <View className="mr-2 flex-row rounded-xl border border-white/[0.08] bg-surface-850 p-1">
                  <TouchableOpacity
                    onPress={() => setTimeUnit('min')}
                    className={`rounded-lg px-3.5 py-2 ${
                      timeUnit === 'min' ? 'bg-primary-500' : ''
                    }`}>
                    <Text
                      className={`text-sm font-semibold ${
                        timeUnit === 'min' ? 'text-white' : 'text-slate-400'
                      }`}>
                      MIN
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => setTimeUnit('sec')}
                    className={`rounded-lg px-3.5 py-2 ${
                      timeUnit === 'sec' ? 'bg-primary-500' : ''
                    }`}>
                    <Text
                      className={`text-sm font-semibold ${
                        timeUnit === 'sec' ? 'text-white' : 'text-slate-400'
                      }`}>
                      SEC
                    </Text>
                  </TouchableOpacity>
                </View>
                <TextInput
                  className="flex-1 rounded-xl border border-white/[0.08] bg-surface-850 p-3.5 text-base text-white"
                  keyboardType="numeric"
                  value={duration}
                  onChangeText={setDuration}
                />
              </View>

              <TouchableOpacity onPress={handleStartVoting} className="btn btn-primary w-full">
                <Ionicons name="play" size={16} color="#fff" />
                <Text className="ml-1.5 text-sm font-semibold text-white">Start Session</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setShowSessionModal(false)}
                className="mt-3 items-center">
                <Text className="text-sm text-slate-400">Cancel</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
};
