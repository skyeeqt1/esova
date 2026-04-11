import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Dimensions,
  TextInput,
  Alert,
  ScrollView,
  Image,
} from 'react-native';
import { BarChart } from 'react-native-chart-kit';
import { POSITIONS, DEFAULT_AVATAR } from '../../hooks/useAdminData';
import { supabase } from '../../config/supabase';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

export const OverviewSection = ({ voters, candidates, handleResetElection }: any) => {
  const [duration, setDuration] = useState('60');
  const [timeUnit, setTimeUnit] = useState<'min' | 'sec'>('min');
  const [settings, setSettings] = useState<any>(null);
  const [timeLeft, setTimeLeft] = useState<string>('00:00');
  const [isVotingOver, setIsVotingOver] = useState(false);

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
      .on('postgres_changes', { event: '*', schema: 'public', table: 'settings' }, (payload) => {
        if (payload.new && payload.new.id === 'election_control') {
          setSettings(payload.new);
        }
      })
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
      const posA = POSITIONS.indexOf(a.position);
      const posB = POSITIONS.indexOf(b.position);
      if (posA !== posB) return posA - posB;
      return (b.votes || 0) - (a.votes || 0);
    });

    const rows = sortedCandidates
      .map(
        (c: any) => `
      <tr>
        <td style="padding: 10px; border-bottom: 1px solid #eee;">${c.position}</td>
        <td style="padding: 10px; border-bottom: 1px solid #eee;">${c.name}</td>
        <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: center;"><b>${c.votes || 0}</b></td>
      </tr>
    `
      )
      .join('');

    const html = `
      <html>
        <body style="font-family: Arial, sans-serif; padding: 40px; color: #333;">
          <h1 style="text-align: center; margin-bottom: 5px;">Official Election Results</h1>
          <p style="text-align: center; color: #666; margin-bottom: 30px;">Date: ${date}</p>
          <table style="width: 100%; border-collapse: collapse;">
            <thead>
              <tr style="background-color: #00b894; color: white;">
                <th style="padding: 12px; text-align: left;">POSITION</th>
                <th style="padding: 12px; text-align: left;">CANDIDATE</th>
                <th style="padding: 12px; text-align: center;">TOTAL VOTES</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
          <p style="margin-top: 40px;">Total Registered Voters: ${voters.length}</p>
        </body>
      </html>
    `;

    try {
      const { uri } = await Print.printToFileAsync({ html });
      await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
    } catch (error) {
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

  return (
    <ScrollView showsVerticalScrollIndicator={false}>
      {/* TIMER & CONTROLS */}
      <View className="mb-6 rounded-2xl border border-gray-800 bg-[#1e1e1e] p-5">
        <View className="mb-4 flex-row items-center justify-between">
          <Text className="text-base font-bold uppercase text-[#00b894]">Duration & Controls</Text>
          <View className="rounded-lg border border-gray-800 bg-black px-3 py-1">
            <Text
              className={`font-mono text-xl font-bold ${isVotingOver ? 'text-red-500' : 'text-[#00b894]'}`}>
              {timeLeft}
            </Text>
          </View>
        </View>

        <View className="mb-4 flex-row items-center">
          <View className="mr-2 flex-row rounded-xl border border-gray-800 bg-black p-1">
            <TouchableOpacity
              onPress={() => setTimeUnit('min')}
              className={`rounded-lg px-3 py-2 ${timeUnit === 'min' ? 'bg-[#00b894]' : ''}`}>
              <Text
                className={`text-base font-bold ${timeUnit === 'min' ? 'text-black' : 'text-gray-500'}`}>
                MIN
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setTimeUnit('sec')}
              className={`rounded-lg px-3 py-2 ${timeUnit === 'sec' ? 'bg-[#00b894]' : ''}`}>
              <Text
                className={`text-base font-bold ${timeUnit === 'sec' ? 'text-black' : 'text-gray-500'}`}>
                SEC
              </Text>
            </TouchableOpacity>
          </View>
          <TextInput
            className="mr-2 flex-1 rounded-xl border border-gray-700 bg-black p-4 text-lg text-white"
            keyboardType="numeric"
            value={duration}
            onChangeText={setDuration}
          />
          <TouchableOpacity
            onPress={handleStartVoting}
            className="rounded-xl bg-[#00b894] px-6 py-3">
            <Text className="text-base font-bold uppercase text-black">Start</Text>
          </TouchableOpacity>
        </View>

        {isVotingOver && settings?.status === 'started' && (
          <TouchableOpacity
            onPress={handleToggleResults}
            className={`${settings?.results_published ? 'border border-red-500 bg-red-500/20' : 'bg-blue-600'} items-center rounded-xl p-4`}>
            <Text
              className={`${settings?.results_published ? 'text-red-500' : 'text-white'} text-base font-bold uppercase`}>
              {settings?.results_published ? 'HIDE RESULTS FROM VOTERS' : 'FLASH RESULTS TO VOTERS'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* STATS & PRINT */}
      <View className="mb-6 items-center rounded-2xl border border-gray-800 bg-[#1e1e1e] p-6">
        <View
          className={`mb-2 rounded-full px-4 py-1 ${isVotingOver ? 'bg-red-500/10' : 'bg-green-500/10'}`}>
          <Text
            className={`text-sm font-bold uppercase ${isVotingOver ? 'text-red-500' : 'text-green-500'}`}>
            {settings?.status === 'started'
              ? isVotingOver
                ? 'Session Ended'
                : 'Session Active'
              : 'Ready'}
          </Text>
        </View>
        <Text className="text-base font-bold uppercase text-gray-400">Registered Voters</Text>
        <Text className="my-2 text-6xl font-bold text-white">{voters.length}</Text>
        {(settings?.status === 'started' || settings?.status === 'idle') && (
          <View className="mt-2 rounded-full bg-[#f1c40f]/20 px-4 py-2">
            <Text className="text-lg font-bold text-[#f1c40f]">
              {voters.filter((v: any) => v.has_voted).length} / {voters.length} voted
            </Text>
          </View>
        )}

        <View className="mt-4 flex-row gap-4">
          <TouchableOpacity
            onPress={onResetPress}
            className="rounded-full border border-red-500/50 bg-red-500/10 px-6 py-2">
            <Text className="text-base font-bold uppercase text-red-500">Reset</Text>
          </TouchableOpacity>
          {isVotingOver && settings?.status === 'started' && (
            <TouchableOpacity
              onPress={handlePrint}
              className="rounded-full border border-white/50 bg-white/10 px-6 py-2">
              <Text className="text-base font-bold uppercase text-white">Print Results</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* CANDIDATES TABLE */}
      {POSITIONS.map((pos) => {
        const posCand = candidates.filter((c: any) => c.position === pos);
        if (posCand.length === 0) return null;

        const sortedCand = [...posCand].sort((a, b) => (b.votes || 0) - (a.votes || 0));
        const maxVotes = Math.max(...posCand.map((c: any) => c.votes || 0));

        return (
          <View key={pos} className="mb-6 rounded-2xl border border-gray-800 bg-[#1e1e1e] p-4">
            <Text className="mb-4 text-center text-lg font-bold uppercase tracking-widest text-[#00b894]">
              {pos}
            </Text>
            {sortedCand.map((c: any, index: number) => {
              const isWinner = isVotingOver && c.votes === maxVotes && maxVotes > 0;
              const isFirst = index === 0;
              const tiedCandidates = posCand.filter((x: any) => x.votes === maxVotes);
              const hasTie = isVotingOver && tiedCandidates.length > 1 && maxVotes > 0;
              const isTied = c.votes === maxVotes && hasTie;
              const rankDisplay = isTied ? (tiedCandidates.length + 1) / 2 : index + 1;
              const rankColor = isFirst ? 'text-[#f1c40f]' : 'text-gray-400';
              return (
                <View
                  key={c.id}
                  className={`mb-3 flex-row items-center rounded-xl p-2 ${isTied ? 'border border-purple-500 bg-purple-500/20' : isFirst ? 'border border-[#00b894] bg-[#00b894]/20' : 'border border-transparent bg-black/30'}`}>
                  <Text className={`w-10 text-xl font-bold ${rankColor}`}>#{rankDisplay}</Text>
                  <Image
                    source={{ uri: c.image || DEFAULT_AVATAR }}
                    className="mr-3 h-14 w-14 rounded-full"
                  />
                  <View className="flex-1">
                    <Text
                      className={`text-xl font-bold text-white ${isTied ? 'text-purple-400' : isWinner ? 'text-[#00b894]' : ''}`}>
                      {c.name}
                    </Text>
                  </View>
                  <View className="items-end">
                    <Text
                      className={`text-2xl font-bold ${isTied ? 'text-purple-400' : isWinner ? 'text-[#00b894]' : 'text-white'}`}>
                      {c.votes || 0}
                    </Text>
                    {isTied && <Text className="text-base font-bold text-purple-400">TIE</Text>}
                  </View>
                </View>
              );
            })}
          </View>
        );
      })}
    </ScrollView>
  );
};
