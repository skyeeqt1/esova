import React from 'react';
import { View, Text, ScrollView } from 'react-native';

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
      'ADD_VOTER': 'Added Voter',
      'ADD_CANDIDATE': 'Added Candidate',
      'DELETE_VOTER': 'Removed Voter',
      'DELETE_CANDIDATE': 'Removed Candidate',
      'UPDATE_CANDIDATE': 'Updated Candidate',
      'IMPORT_VOTERS': 'Bulk Import',
      'RESET_ELECTION': 'Reset Election',
      'VOTE_CAST': 'Vote Cast',
    };
    return descriptions[action] || action;
  };

  return (
    <ScrollView className="flex-1">
      {logs.length === 0 ? (
        <View className="bg-[#1e1e1e] p-6 rounded-xl items-center">
          <Text className="text-gray-500">No logs yet</Text>
        </View>
      ) : (
        logs.map((log) => {
          const actionColor = getActionColor(log.action);
          return (
            <View 
              key={log.id} 
              className="bg-[#1e1e1e] p-4 rounded-xl mb-2 border-l-4"
              style={{ borderLeftColor: actionColor }}
            >
              <View className="flex-row justify-between items-center">
                <Text className="text-white font-bold text-xs" style={{ color: actionColor }}>
                  {getActionDescription(log.action)}
                </Text>
                <Text className="text-gray-500 text-[9px]">
                  {formatTimestamp(log.timestamp)}
                </Text>
              </View>
              <Text className="text-gray-400 text-[11px] mt-1">
                Target: <Text className="text-white font-medium">{log.target_name}</Text>
              </Text>
              {log.target_id && (
                <Text className="text-gray-500 text-[10px]">
                  ID: <Text className="text-gray-400">{log.target_id}</Text>
                </Text>
              )}
              {log.reason && (
                <Text className="text-gray-500 text-[10px] italic mt-1">"{log.reason}"</Text>
              )}
            </View>
          );
        })
      )}
    </ScrollView>
  );
};
