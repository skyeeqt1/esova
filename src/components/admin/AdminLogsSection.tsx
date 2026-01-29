import React from 'react';
import { View, Text, ScrollView } from 'react-native';

export const AdminLogsSection = ({ logs }: { logs: any[] }) => {
  return (
    <ScrollView className="flex-1">
      {logs.map((log) => (
        <View key={log.id} className="bg-[#1e1e1e] p-4 rounded-xl mb-2 border-l-4 border-red-500">
          <View className="flex-row justify-between">
            <Text className="text-white font-bold text-xs">{log.action}</Text>
            <Text className="text-gray-500 text-[9px]">
              {log.timestamp?.toDate().toLocaleString()}
            </Text>
          </View>
          <Text className="text-gray-400 text-[11px] mt-1">
            Target: <Text className="text-white">{log.targetName}</Text>
          </Text>
          <Text className="text-gray-500 text-[10px] italic mt-1">"{log.reason}"</Text>
        </View>
      ))}
    </ScrollView>
  );
};