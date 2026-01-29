import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';

const VoterProfile = ({ route, navigation }: any) => {
  const { student } = route.params;

  return (
    <ScrollView className="flex-1 bg-[#121212] p-6 pt-12">
      <TouchableOpacity onPress={() => navigation.goBack()} className="mb-6">
        <Text className="text-[#00b894] font-bold">← Back to Dashboard</Text>
      </TouchableOpacity>

      <View className="bg-[#1e1e1e] p-6 rounded-3xl border border-gray-800">
        <View className="items-center mb-6">
          <View className="w-20 h-20 bg-[#00b89422] rounded-full items-center justify-center mb-4">
            <Text className="text-[#00b894] text-3xl font-bold">{student.name ? student.name[0] : '?'}</Text>
          </View>
          <Text className="text-white text-2xl font-bold">{student.name}</Text>
          <Text className="text-gray-500">ID: {student.studentId}</Text>
        </View>

        <View className="border-t border-gray-800 pt-6">
          <Text className="text-gray-400 uppercase text-xs font-bold mb-4 tracking-widest">Voting Status</Text>
          <View className="flex-row justify-between mb-4">
            <Text className="text-gray-500">Status:</Text>
            <Text className={student.hasVoted ? "text-[#00b894] font-bold" : "text-yellow-500 font-bold"}>
              {student.hasVoted ? "COMPLETED" : "PENDING"}
            </Text>
          </View>

          {student.hasVoted && (
            <>
              <View className="flex-row justify-between mb-6">
                <Text className="text-gray-500">Timestamp:</Text>
                <Text className="text-white text-xs">
                    {student.votedAt ? new Date(student.votedAt).toLocaleString() : 'N/A'}
                </Text>
              </View>

              <Text className="text-gray-400 uppercase text-xs font-bold mb-4 tracking-widest">Ballot Record</Text>
              {Object.entries(student.ballot || {}).map(([position, candidate]: any) => (
                <View key={position} className="bg-[#121212] p-4 rounded-xl mb-2 flex-row justify-between">
                  <Text className="text-gray-500">{position}</Text>
                  <Text className="text-white font-bold">
                    {/* FIXED: Check if candidate is object and extract .name */}
                    {typeof candidate === 'object' ? candidate.name : candidate}
                  </Text>
                </View>
              ))}
            </>
          )}
        </View>
      </View>
      <View className="h-10" />
    </ScrollView>
  );
};

export default VoterProfile;