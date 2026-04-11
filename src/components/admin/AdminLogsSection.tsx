import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// Color mapping for different action types
export const getActionColor = (action: string) => {
  if (action.includes('ADD')) return '#00b894'; // Green for additions
  if (action.includes('DELETE')) return '#e74c3c'; // Red for deletions
  if (action.includes('UPDATE') || action.includes('EDIT')) return '#3498db'; // Blue for updates
  if (action.includes('IMPORT')) return '#9b59b6'; // Purple for imports
  if (action.includes('RESET')) return '#e67e22'; // Orange for reset
  if (action.includes('VOTE')) return '#f1c40f'; // Yellow for voting
  return '#95a5a6'; // Gray for others
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
        <View className="items-center rounded-xl bg-[#1e1e1e] p-6">
          <Text className="text-lg text-gray-500">No logs yet</Text>
        </View>
      ) : (
        logs.map((log) => {
          const actionColor = getActionColor(log.action);
          return (
            <View
              key={log.id}
              className="mb-2 rounded-xl border-l-4 bg-[#1e1e1e] p-4"
              style={{ borderLeftColor: actionColor }}>
              <View className="flex-row items-center justify-between">
                <Text className="text-base font-bold text-white" style={{ color: actionColor }}>
                  {getActionDescription(log.action)}
                </Text>
                <Text className="text-sm text-gray-500">{formatTimestamp(log.timestamp)}</Text>
              </View>
              <Text className="mt-1 text-base text-gray-400">
                Target: <Text className="font-medium text-white">{log.target_name}</Text>
              </Text>
              {log.target_id && (
                <Text className="text-base text-gray-500">
                  ID: <Text className="text-gray-400">{log.target_id}</Text>
                </Text>
              )}
              {log.reason &&
                (hasPassword(log.reason) ? (
                  <View className="mt-1 flex-row items-center">
                    <Text className="flex-1 pr-2 text-base italic text-gray-500">
                      {revealedPasswords.has(log.id) ? log.reason : maskPassword(log.reason)}
                    </Text>
                    <TouchableOpacity
                      onPress={() => togglePasswordReveal(log.id)}
                      className="flex-shrink-0">
                      <Ionicons
                        name={revealedPasswords.has(log.id) ? 'eye-off' : 'eye'}
                        size={18}
                        color="#3498db"
                      />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <Text className="mt-1 text-base italic text-gray-500">"{log.reason}"</Text>
                ))}
              {log.admin_email && (
                <Text className="mt-1 text-base font-medium text-[#f1c40f]">
                  By: {log.admin_email}
                </Text>
              )}
            </View>
          );
        })
      )}
    </ScrollView>
  );
};
