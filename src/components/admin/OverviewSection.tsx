import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Dimensions, TextInput, Alert, ScrollView } from 'react-native';
import { BarChart } from "react-native-chart-kit";
import { POSITIONS } from '../../hooks/useAdminData';
import { supabase } from '../../config/supabase';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

export const OverviewSection = ({ voters, candidates, handleResetElection }: any) => {
  const [duration, setDuration] = useState('60');
  const [timeUnit, setTimeUnit] = useState<'min' | 'sec'>('min');
  const [settings, setSettings] = useState<any>(null);
  const [timeLeft, setTimeLeft] = useState<string>("00:00");
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
          setTimeLeft("00:00");
          setIsVotingOver(true); // Automatically triggers the Flash button
        } else {
          setIsVotingOver(false);
          const m = Math.floor(diff / 60000);
          const s = Math.floor((diff % 60000) / 1000);
          setTimeLeft(`${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`);
        }
      } else {
        setTimeLeft("00:00");
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
    const { error } = await supabase
      .from('settings')
      .upsert({
        id: 'election_control',
        status: 'started',
        end_time: new Date(endTime).toISOString(),
        results_published: false
      }, { onConflict: 'id' });

    if (error) {
      console.error('Error starting election:', error);
      Alert.alert("Error", "Failed to start election.");
      return;
    }
    Alert.alert("Success", "Election session is now live.");
  };

  const handleToggleResults = async () => {
    if (totalVotesCast === 0) {
      Alert.alert("Action Denied", "No votes recorded yet.");
      return;
    }
    
    const newPublishedState = !settings?.results_published;
    
    const { error } = await supabase
      .from('settings')
      .update({ results_published: newPublishedState })
      .eq('id', 'election_control');

    if (error) {
      console.error('Error updating results:', error);
      Alert.alert("Error", "Failed to update results visibility.");
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

    const rows = sortedCandidates.map((c: any) => `
      <tr>
        <td style="padding: 10px; border-bottom: 1px solid #eee;">${c.position}</td>
        <td style="padding: 10px; border-bottom: 1px solid #eee;">${c.name}</td>
        <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: center;"><b>${c.votes || 0}</b></td>
      </tr>
    `).join('');

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
      Alert.alert("Error", "Could not generate PDF.");
    }
  };

  const onResetPress = () => {
    Alert.alert("Reset Election", "Clear all data and return to setup?", [
      { text: "Cancel" },
      { 
        text: "Reset", 
        style: 'destructive', 
        onPress: async () => {
          await supabase
            .from('settings')
            .upsert({
              id: 'election_control',
              status: 'idle',
              end_time: null,
              results_published: false
            }, { onConflict: 'id' });
          
          handleResetElection(); 
        } 
      }
    ]);
  };

  return (
    <ScrollView showsVerticalScrollIndicator={false}>
      {/* TIMER & CONTROLS */}
      <View className="bg-[#1e1e1e] p-5 rounded-2xl border border-gray-800 mb-6">
        <View className="flex-row justify-between items-center mb-4">
            <Text className="text-[#00b894] font-bold text-xs uppercase">Duration & Controls</Text>
            <View className="bg-black px-3 py-1 rounded-lg border border-gray-800">
                <Text className={`font-mono font-bold ${isVotingOver ? 'text-red-500' : 'text-[#00b894]'}`}>
                    {timeLeft}
                </Text>
            </View>
        </View>

        <View className="flex-row items-center mb-4">
          <View className="flex-row bg-black rounded-xl p-1 mr-2 border border-gray-800">
            <TouchableOpacity onPress={() => setTimeUnit('min')} className={`px-3 py-2 rounded-lg ${timeUnit === 'min' ? 'bg-[#00b894]' : ''}`}>
              <Text className={`text-[10px] font-bold ${timeUnit === 'min' ? 'text-black' : 'text-gray-500'}`}>MIN</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setTimeUnit('sec')} className={`px-3 py-2 rounded-lg ${timeUnit === 'sec' ? 'bg-[#00b894]' : ''}`}>
              <Text className={`text-[10px] font-bold ${timeUnit === 'sec' ? 'text-black' : 'text-gray-500'}`}>SEC</Text>
            </TouchableOpacity>
          </View>
          <TextInput 
            className="flex-1 bg-black text-white p-3 rounded-xl border border-gray-700 mr-2"
            keyboardType="numeric"
            value={duration}
            onChangeText={setDuration}
          />
          <TouchableOpacity onPress={handleStartVoting} className="bg-[#00b894] px-6 py-3 rounded-xl">
            <Text className="text-black font-bold uppercase text-xs">Start</Text>
          </TouchableOpacity>
        </View>

        {isVotingOver && settings?.status === 'started' && (
          <TouchableOpacity 
            onPress={handleToggleResults} 
            className={`${settings?.results_published ? 'bg-red-500/20 border border-red-500' : 'bg-blue-600'} p-4 rounded-xl items-center`}
          >
            <Text className={`${settings?.results_published ? 'text-red-500' : 'text-white'} font-bold uppercase text-xs`}>
              {settings?.results_published ? 'HIDE RESULTS FROM VOTERS' : 'FLASH RESULTS TO VOTERS'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* STATS & PRINT */}
      <View className="bg-[#1e1e1e] p-6 rounded-2xl border border-gray-800 items-center mb-6">
        <View className={`px-4 py-1 rounded-full mb-2 ${isVotingOver ? 'bg-red-500/10' : 'bg-green-500/10'}`}>
            <Text className={`text-[8px] font-bold uppercase ${isVotingOver ? 'text-red-500' : 'text-green-500'}`}>
                {settings?.status === 'started' ? (isVotingOver ? "Session Ended" : "Session Active") : "Ready"}
            </Text>
        </View>
        <Text className="text-gray-400 text-xs font-bold uppercase">Total Voters</Text>
        <Text className="text-white text-5xl font-bold my-2">{voters.length}</Text>
        
        <View className="flex-row mt-4 gap-4">
            <TouchableOpacity onPress={onResetPress} className="bg-red-500/10 border border-red-500/50 px-6 py-2 rounded-full">
              <Text className="text-red-500 text-[10px] font-bold uppercase">Reset</Text>
            </TouchableOpacity>
            {isVotingOver && settings?.status === 'started' && (
                <TouchableOpacity onPress={handlePrint} className="bg-white/10 border border-white/50 px-6 py-2 rounded-full">
                    <Text className="text-white text-[10px] font-bold uppercase">Print Results</Text>
                </TouchableOpacity>
            )}
        </View>
      </View>

      {/* DYNAMIC CHARTS WITH WINNER BADGE */}
      {POSITIONS.map((pos) => {
        const posCand = candidates.filter((c: any) => c.position === pos);
        if (posCand.length === 0) return null;

        const maxVotes = Math.max(...posCand.map((c: any) => c.votes || 0));

        return (
          <View key={pos} className="mb-6 bg-[#1e1e1e] p-4 rounded-2xl border border-gray-800">
            <Text className="text-[#00b894] font-bold mb-4 uppercase text-center text-xs tracking-widest">{pos}</Text>
            <BarChart 
              data={{
                labels: posCand.map((c: any) => {
                    const name = c.name.split(' ')[0];
                    return (isVotingOver && c.votes === maxVotes && maxVotes > 0) ? `👑 ${name}` : name;
                }),
                datasets: [{ data: posCand.map((c: any) => c.votes || 0) }]
              }}
              width={Dimensions.get("window").width - 80} 
              height={180} 
              fromZero
              chartConfig={{
                backgroundGradientFrom: "#1e1e1e", 
                backgroundGradientTo: "#1e1e1e",
                color: (opacity = 1) => `rgba(0, 184, 148, ${opacity})`, 
                labelColor: () => '#aaa',
                decimalPlaces: 0,
              }}
              style={{ borderRadius: 16 }}

            />
          </View>
        );
      })}
    </ScrollView>
  );
};
