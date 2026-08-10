import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// Color + icon mapping for different action types
export const getActionStyle = (action: string) => {
  if (action.includes('ADD'))
    return { color: '#34d399', bg: 'rgba(52,211,153,0.12)', icon: 'person-add-outline' as const };
  if (action.includes('DELETE') || action.includes('REMOVE'))
    return { color: '#fb7185', bg: 'rgba(251,113,133,0.12)', icon: 'trash-outline' as const };
  if (action.includes('UPDATE') || action.includes('EDIT'))
    return { color: '#38bdf8', bg: 'rgba(56,189,248,0.12)', icon: 'create-outline' as const };
  if (action.includes('IMPORT'))
    return { color: '#c4b5fd', bg: 'rgba(196,181,253,0.12)', icon: 'download-outline' as const };
  if (action.includes('RESET'))
    return { color: '#fbbf24', bg: 'rgba(251,191,36,0.12)', icon: 'refresh-outline' as const };
  if (action.includes('VOTE'))
    return {
      color: '#fbbf24',
      bg: 'rgba(251,191,36,0.12)',
      icon: 'checkmark-circle-outline' as const,
    };
  return { color: '#94a3b8', bg: 'rgba(148,163,184,0.12)', icon: 'ellipse-outline' as const };
};

export const AdminLogsSection = ({ logs }: { logs: any[] }) => {
  const [revealedPasswords, setRevealedPasswords] = useState<Set<string>>(new Set());

  const togglePasswordReveal = (logId: string) => {
    setRevealedPasswords((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(logId)) {
        newSet.delete(logId);
      } else {
        newSet.add(logId);
      }
      return newSet;
    });
  };

  // Check if reason contains password (for password reset logs)
  const hasPassword = (reason: string) => {
    return reason && reason.includes('New password:');
  };

  // Mask the password in reason string
  const maskPassword = (reason: string) => {
    return reason.replace(/New password: .+/, 'New password: ●●●●●●');
  };

  // Helper to format timestamp (Supabase returns ISO string)
  const formatTimestamp = (timestamp: string) => {
    if (!timestamp) return '';
    try {
      const date = new Date(timestamp);
      return date.toLocaleString();
    } catch {
      return timestamp;
    }
  };

  // Get action description for better UX
  const getActionDescription = (action: string) => {
    const descriptions: { [key: string]: string } = {
      ADD_VOTER: 'Added Voter',
      ADD_CANDIDATE: 'Added Candidate',
      DELETE_VOTER: 'Removed Voter',
      DELETE_CANDIDATE: 'Removed Candidate',
      UPDATE_CANDIDATE: 'Updated Candidate',
      IMPORT_VOTERS: 'Bulk Import',
      RESET_ELECTION: 'Reset Election',
      VOTE_CAST: 'Vote Cast',
    };
    return descriptions[action] || action;
  };

  return (
    <ScrollView className="flex-1">
      {logs.length === 0 ? (
        <View className="items-center rounded-2xl border border-dashed border-white/[0.08] p-10">
          <Ionicons name="time-outline" size={28} color="#334155" />
          <Text className="mt-2 text-sm text-slate-500">No activity yet</Text>
        </View>
      ) : (
        logs.map((log) => {
          const style = getActionStyle(log.action);
          return (
            <View key={log.id} className="card mb-3 p-4">
              <View className="flex-row items-start">
                <View
                  className="mr-3 mt-0.5 h-9 w-9 items-center justify-center rounded-xl"
                  style={{ backgroundColor: style.bg }}>
                  <Ionicons name={style.icon} size={17} color={style.color} />
                </View>
                <View className="flex-1">
                  <View className="flex-row items-center justify-between">
                    <Text
                      className="text-sm font-semibold text-white"
                      style={{ color: style.color }}>
                      {getActionDescription(log.action)}
                    </Text>
                    <Text className="text-xs text-slate-500">{formatTimestamp(log.timestamp)}</Text>
                  </View>

                  <Text className="mt-1.5 text-sm text-slate-400">
                    Target: <Text className="font-medium text-white">{log.target_name}</Text>
                  </Text>
                  {log.target_id && (
                    <Text className="text-sm text-slate-500">
                      ID: <Text className="text-slate-400">{log.target_id}</Text>
                    </Text>
                  )}

                  {log.reason &&
                    (hasPassword(log.reason) ? (
                      <View className="mt-1.5 flex-row items-center">
                        <Text className="flex-1 pr-2 text-sm italic text-slate-500">
                          {revealedPasswords.has(log.id) ? log.reason : maskPassword(log.reason)}
                        </Text>
                        <TouchableOpacity
                          onPress={() => togglePasswordReveal(log.id)}
                          className="flex-shrink-0">
                          <Ionicons
                            name={revealedPasswords.has(log.id) ? 'eye-off-outline' : 'eye-outline'}
                            size={16}
                            color="#38bdf8"
                          />
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <Text className="mt-1.5 text-sm italic text-slate-500">
                        &ldquo;{log.reason}&rdquo;
                      </Text>
                    ))}

                  {log.admin_email && (
                    <View className="mt-2 flex-row items-center">
                      <Ionicons name="shield-checkmark-outline" size={12} color="#fbbf24" />
                      <Text className="ml-1.5 text-xs font-medium text-accent-400">
                        {log.admin_email}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            </View>
          );
        })
      )}
    </ScrollView>
  );
};
