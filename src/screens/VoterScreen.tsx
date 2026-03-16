import React, { useState, useEffect } from 'react';
import { 
  View, Text, TouchableOpacity, ScrollView, Image, 
  Alert, ActivityIndicator, Modal 
} from 'react-native';
import { db, auth } from '../config/firebase';
import { collection, onSnapshot, doc, getDoc, writeBatch, increment } from 'firebase/firestore';

const POSITIONS = ["President", "VP", "Secretary", "Treasurer"];
const DEFAULT_AVATAR = "https://via.placeholder.com/150";

const VoterScreen = ({ navigation }: any) => {
  const [candidates, setCandidates] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState("President");
  const [selectedVotes, setSelectedVotes] = useState<any>({});
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState<any>(null);
  const [viewingCandidate, setViewingCandidate] = useState<any>(null);
  const [showReceiptOverride, setShowReceiptOverride] = useState(false);
  const [electionSettings, setElectionSettings] = useState<any>(null);
  const [timeLeft, setTimeLeft] = useState("");
  const [showTermsModal, setShowTermsModal] = useState(true);

  useEffect(() => {
    const userId = auth.currentUser?.uid;
    if (!userId) return;

    const unsubSettings = onSnapshot(doc(db, "settings", "election_control"), (snap) => {
      if (snap.exists()) setElectionSettings(snap.data());
    });

    const loadVoterProfile = async () => {
      try {
        const userDoc = await getDoc(doc(db, "users", userId));
        if (userDoc.exists()) {
          const data = userDoc.data();
          setUserData(data);
          if (data.hasVoted) {
            setStep(3);
            if (data.ballot) setSelectedVotes(data.ballot);
          }
        }
      } finally { setLoading(false); }
    };

    const unsubCand = onSnapshot(collection(db, "candidates"), (snap) => {
      setCandidates(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    loadVoterProfile();
    return () => { unsubSettings(); unsubCand(); };
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      if (electionSettings?.endTime) {
        const diff = electionSettings.endTime - Date.now();
        if (diff > 0) {
          const m = Math.floor(diff / 60000);
          const s = Math.floor((diff % 60000) / 1000);
          setTimeLeft(`${m}m ${s}s`);
        } else {
          setTimeLeft("CLOSED");
        }
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [electionSettings]);

  const isStarted = electionSettings?.status === 'started';
  const isEnded = electionSettings?.endTime < Date.now();

  const handleLogout = () => {
    Alert.alert("Logout Session", "Are you sure you want to exit?", [
      { text: "Cancel" },
      { text: "Logout", style: "destructive", onPress: async () => {
          await auth.signOut();
          navigation.replace('Login');
      }}
    ]);
  };

  const handleVoteSubmit = async () => {
    // Check if session ended exactly when they clicked submit
    if (isEnded) {
      Alert.alert("Time Expired", "The voting session has closed. Your vote could not be recorded.");
      return;
    }

    setLoading(true);
    try {
      const batch = writeBatch(db);
      for (const pos of POSITIONS) {
        const cand = selectedVotes[pos];
        batch.update(doc(db, "candidates", cand.id), { votes: increment(1) });
      }
      batch.update(doc(db, "users", auth.currentUser?.uid!), {
        hasVoted: true,
        votedAt: new Date().toLocaleString(),
        ballot: selectedVotes
      });
      await batch.commit();
      setStep(3);
      Alert.alert("Success", "Vote recorded.");
    } catch (e) { Alert.alert("Error", "Failed to cast vote."); }
    setLoading(false);
  };

  if (loading) return (
    <View className="flex-1 bg-[#1a1a1a] justify-center items-center">
      <ActivityIndicator size="large" color="#f1c40f" />
    </View>
  );

  // TERMS AND CONDITIONS / INSTRUCTIONS SCREEN (Shown before voting)
  if (showTermsModal && !isEnded && !userData?.hasVoted) {
    return (
      <View className="flex-1 bg-[#1a1a1a]">
        <View className="flex-1 bg-black/80  justify-center items-center">
          <View className="bg-[#1e1e1e] rounded-3xl border border-[#f1c40f] p-6 w-full max-w-md">
            <View className="items-center mb-4">
              <View className="bg-white rounded-full border-2 border-[#f1c40f] mb-4">
                <Image
                  source={require("../img/escrlogo.png")}
                  className="w-24 h-24"
                  resizeMode="contain"
                />
              </View>
              <Text className="text-[#f1c40f] text-2xl font-black italic">WELCOME, VOTER!</Text>
              <Text className="text-white text-sm font-bold mt-2">Hello, {userData?.name}!</Text>
              <Text className="text-gray-500 text-xs">ID: {userData?.studentId}</Text>
            </View>

            <View className="border-t border-b border-gray-800 py-4 mb-4">
              <Text className="text-[#f1c40f] text-lg font-black italic mb-3">VOTING INSTRUCTIONS</Text>
              <View className="space-y-2">
                <View className="flex-row items-start">
                  <Text className="text-[#f1c40f] font-bold mr-2">1.</Text>
                  <Text className="text-gray-300 text-sm">Review all candidates for each position carefully.</Text>
                </View>
                <View className="flex-row items-start">
                  <Text className="text-[#f1c40f] font-bold mr-2">2.</Text>
                  <Text className="text-gray-300 text-sm">Tap on a candidate to select your vote for each position.</Text>
                </View>
                <View className="flex-row items-start">
                  <Text className="text-[#f1c40f] font-bold mr-2">3.</Text>
                  <Text className="text-gray-300 text-sm">You must select a candidate for ALL positions to proceed.</Text>
                </View>
                <View className="flex-row items-start">
                  <Text className="text-[#f1c40f] font-bold mr-2">4.</Text>
                  <Text className="text-gray-300 text-sm">Review your ballot before submitting.</Text>
                </View>
                <View className="flex-row items-start">
                  <Text className="text-[#f1c40f] font-bold mr-2">5.</Text>
                  <Text className="text-gray-300 text-sm">Once submitted, your vote cannot be changed.</Text>
                </View>
              </View>
            </View>

            <View className="bg-black/50 rounded-xl p-4 mb-6">
              <Text className="text-[#f1c40f] text-sm font-black italic mb-2">TERMS AND CONDITIONS</Text>
              <ScrollView style={{maxHeight: 150}}>
                <Text className="text-gray-400 text-xs leading-4">
                  • By proceeding with this vote, you acknowledge that your selection is final and cannot be modified after submission.{"\n"}
                  • You certify that you are an eligible voter and have the right to participate in this election.{"\n"}
                  • All votes are confidential and will be counted anonymously.{"\n"}
                  • Any attempt to manipulate or disrupt the voting process is strictly prohibited.{"\n"}
                  • The election administrators reserve the right to invalidate any vote suspected of being fraudulent.{"\n"}
                  • By casting your vote, you agree to abide by all election rules and regulations.
                </Text>
              </ScrollView>
            </View>

            <TouchableOpacity 
              onPress={() => setShowTermsModal(false)}
              className="bg-[#f1c40f] p-4 rounded-xl border-b-4 border-yellow-700"
            >
              <Text className="text-black text-center font-black text-lg uppercase italic">I Accept - Proceed to Vote</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              onPress={handleLogout}
              className="mt-4 p-4 rounded-xl border border-gray-800"
            >
              <Text className="text-red-500 text-center font-bold text-sm">Decline & Logout</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  if (!isStarted) return (
    <View className="flex-1 bg-black justify-center items-center p-10">
     <View className="items-center mb-10">
              <View className="bg-white rounded-full border-2 border-[#f1c40f] mb-4">
                 <Image
                    source={require("../img/escrlogo.png")}
                    className="w-40 h-40"
                    resizeMode="contain"
                  />
              </View>
              <Text className="text-gray-400 text-[30px] font-bold tracking-[3px] uppercase mt-1 pb-2">
                ESOVA
              </Text>
              <Text className="text-[#f1c40f] text-4xl font-black italic tracking-tighter">
                VOTING<Text className="text-white">PORTAL</Text>
              </Text>
            </View>
      <Text className="text-[#f1c40f] text-xl font-black italic">NO VOTING SESSION YET</Text>
      <TouchableOpacity onPress={handleLogout} className="mt-8 border border-gray-800 px-8 py-3 rounded-full">
        <Text className="text-red-500 font-bold">LOGOUT</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View className="flex-1 bg-[#1a1a1a]">
        <View className="flex-1">
        
        {/* HEADER BAR */}
        <View className="bg-black pt-12 pb-4 px-6 border-b-2 border-[#f1c40f] flex-row justify-between items-center">
          <View>
            <Text className="text-[#f1c40f] font-black text-xl italic tracking-tighter">E-SOVA</Text>
            <Text className="text-white text-[10px] tracking-[1px] uppercase opacity-60">
              {isEnded ? "SESSION" : `TIME LEFT`}
            </Text>
            <Text className="text-[#e74c3c] font-bold"> {timeLeft}</Text>
          </View>
          <View className="bg-white rounded-full border-2 border-[#f1c40f] items-center justify-center">
            <Image source={require("../img/escrlogo.png")} className="w-20 h-20" resizeMode="contain" />
          </View>
          <TouchableOpacity onPress={handleLogout} className="bg-[#1a1a1a] border border-gray-800 px-4 py-2 rounded-full">
            <Text className="text-red-500 font-black text-[10px] tracking-widest">LOGOUT</Text>
          </TouchableOpacity>
        </View>

        <ScrollView className="flex-1 px-4 pt-4">
          
          {/* LOGIC: IF ELECTION ENDED AND USER IS NOT VIEWING RECEIPT */}
          {isEnded && !showReceiptOverride ? (
            <View>
              {electionSettings?.resultsPublished ? (
                /* OFFICIAL RESULTS PANEL */
                <View className="bg-[#1e1e1e] p-6 rounded-3xl border border-[#f1c40f]">
                   <Text className="text-[#f1c40f] text-2xl font-black italic text-center mb-6">OFFICIAL RESULTS</Text>
                   {POSITIONS.map(pos => {
                      const sorted = candidates.filter(c => c.position === pos).sort((a,b) => b.votes - a.votes);
                      const winner = sorted[0];
                      return (
                        <View key={pos} className="bg-black/50 p-4 rounded-xl mb-3 flex-row justify-between items-center">
                          <View>
                            <Text className="text-gray-500 font-bold text-[8px] uppercase">{pos} Winner</Text>
                            <Text className="text-white font-bold">{winner?.name || "N/A"}</Text>
                          </View>
                          <Text className="text-[#ffff00] font-black text-lg">{winner?.votes || 0}</Text>
                        </View>
                      );
                   })}
                   <TouchableOpacity onPress={() => setShowReceiptOverride(true)} className="mt-4 bg-gray-800 p-4 rounded-xl items-center">
                     <Text className="text-[#f1c40f] font-bold uppercase text-[10px]">View My Ballot Receipt</Text>
                   </TouchableOpacity>
                </View>
              ) : (
                /* POLLS CLOSED STATE (Hides candidate list even if user hasn't voted) */
                <View className="bg-[#1e1e1e] p-10 rounded-3xl items-center border border-gray-800">
                  <Text className="text-white font-black text-lg">The election has ended</Text>
                  <Text className="text-gray-500 text-center mt-2 text-xs">Please wait for the administrator to flash the official results.</Text>
                  {userData?.hasVoted && (
                    <TouchableOpacity onPress={() => setShowReceiptOverride(true)} className="mt-8 border border-gray-700 px-8 py-3 rounded-full">
                      <Text className="text-[#f1c40f] font-bold text-[10px]">VIEW BALLOT RECEIPT</Text>
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
                  <View className="bg-[#1e1e1e] p-4 rounded-xl mb-4 border-l-4 border-[#f1c40f]">
                    <Text className="text-white font-bold text-lg">Hello, {userData?.name}!</Text>
                    <Text className="text-gray-400 text-xs font-bold uppercase">ID: {userData?.studentId}</Text>
                  </View>
                  
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-6 flex-row bg-black p-1 rounded-full border border-gray-800">
                    {POSITIONS.map(pos => (
                      <TouchableOpacity key={pos} onPress={() => setActiveTab(pos)} className={`px-6 py-2 rounded-full ${activeTab === pos ? 'bg-[#f1c40f]' : ''}`}>
                        <Text className={`font-black text-[10px] ${activeTab === pos ? 'text-black' : 'text-gray-500'}`}>{pos}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>

                  {candidates.filter(c => c.position === activeTab).map(candidate => (
                    <TouchableOpacity key={candidate.id} onPress={() => setSelectedVotes({...selectedVotes, [activeTab]: candidate})}
                      className={`flex-row items-center p-4 mb-3 rounded-2xl border-2 ${selectedVotes[activeTab]?.id === candidate.id ? 'border-[#f1c40f] bg-[#2a2a2a]' : 'border-gray-800 bg-[#1e1e1e]'}`}>
                      <Image source={{ uri: candidate.image || DEFAULT_AVATAR }} className="w-16 h-16 rounded-xl mr-4 bg-black border border-gray-700" />
                      <View className="flex-1">
                        <Text className={`font-black text-lg ${selectedVotes[activeTab]?.id === candidate.id ? 'text-[#f1c40f]' : 'text-white'}`}>{candidate.name}</Text>
                        <Text className="text-gray-400 text-[10px] uppercase">{candidate.course} • Year {candidate.year}</Text>
                        <TouchableOpacity onPress={() => setViewingCandidate(candidate)} className="mt-1">
                          <Text className="text-[#f1c40f] text-[10px] font-bold underline">VIEW PROFILE</Text>
                        </TouchableOpacity>
                      </View>
                      {selectedVotes[activeTab]?.id === candidate.id && (
                        <View className="bg-[#f1c40f] rounded-full px-2 py-1"><Text className="text-black font-bold text-[8px]">SELECTED</Text></View>
                      )}
                    </TouchableOpacity>
                  ))}
                  {POSITIONS.every(p => selectedVotes[p]) && (
                    <TouchableOpacity onPress={() => setStep(2)} className="bg-[#f1c40f] p-4 rounded-xl mt-6 mb-10"><Text className="text-black text-center font-black">REVIEW BALLOT</Text></TouchableOpacity>
                  )}
                </View>
              )}

              {step === 2 && !isEnded && (
                <View className="bg-[#1e1e1e] p-6 rounded-3xl border border-gray-800">
                  <Text className="text-[#f1c40f] text-2xl font-black mb-6 italic">REVIEW BALLOT</Text>
                  {POSITIONS.map(pos => (
                    <View key={pos} className="bg-black p-4 rounded-xl mb-3 flex-row justify-between items-center border border-gray-900">
                      <View><Text className="text-gray-500 text-[8px] uppercase">{pos}</Text><Text className="text-white font-bold">{selectedVotes[pos]?.name}</Text></View>
                      <TouchableOpacity onPress={() => {setStep(1); setActiveTab(pos);}}><Text className="text-[#f1c40f] text-xs">EDIT</Text></TouchableOpacity>
                    </View>
                  ))}
                  <TouchableOpacity onPress={handleVoteSubmit} className="bg-[#e74c3c] p-5 rounded-2xl mt-8"><Text className="text-white text-center font-black text-xl uppercase italic">Cast Vote Now</Text></TouchableOpacity>
                </View>
              )}

              {/* PERSISTENT RECEIPT VIEW (Accessible via Step 3 or Override) */}
              {(step === 3 || showReceiptOverride) && (
                <View>
                  <View className="bg-white p-6 rounded-lg mb-4 mt-4 border-t-8 border-[#f1c40f]">
                    <Text className="text-black font-black text-2xl italic text-center">OFFICIAL RECEIPT</Text>
                    <View className="w-full h-[1px] bg-gray-200 my-4 border-dashed border" />
                    <View className="mb-4">
                      <Text className="text-gray-500 text-[10px] uppercase font-bold">Voter: {userData?.name}</Text>
                      <Text className="text-gray-500 text-[10px] uppercase font-bold">ID: {userData?.studentId}</Text>
                      <Text className="text-gray-500 text-[10px] uppercase font-bold">Time Cast: {userData?.votedAt}</Text>
                    </View>
                    <View className="bg-gray-100 p-4 rounded-lg">
                      {POSITIONS.map(pos => (
                        <View key={pos} className="flex-row justify-between py-2 border-b border-gray-200">
                          <Text className="text-gray-500 text-[10px] font-bold">{pos}:</Text>
                          <Text className="text-black font-black text-[10px]">{selectedVotes[pos]?.name.toUpperCase()}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                  {isEnded && (
                    <TouchableOpacity onPress={() => setShowReceiptOverride(false)} className="bg-black/50 border border-gray-700 p-4 rounded-xl items-center mb-20">
                      <Text className="text-white font-bold text-[10px] uppercase">Back to Election Result</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </>
          )}
        </ScrollView>
      </View>
      
      {/* Profile Modal */}
      <Modal visible={!!viewingCandidate} animationType="slide" transparent={true}>
        <View className="flex-1 justify-center items-center bg-black/90 p-6">
          <View className="bg-[#1e1e1e] w-full rounded-3xl border border-gray-800 p-8">
            <Image source={{ uri: viewingCandidate?.image || DEFAULT_AVATAR }} className="w-32 h-32 rounded-3xl border-2 border-[#f1c40f] mx-auto bg-black" />
            <Text className="text-white text-2xl font-bold mt-4 text-center">{viewingCandidate?.name}</Text>
            <Text className="text-[#f1c40f] text-center font-bold mb-1 text-xs uppercase tracking-widest">{viewingCandidate?.position}</Text>
            <Text className="text-gray-400 text-[10px] uppercase text-center mb-4">{viewingCandidate?.course} • Year {viewingCandidate?.year}</Text>
            <Text className="text-gray-500 text-[10px] italic text-center mb-2">Background & Achievements</Text>
            <Text className="text-gray-300 text-sm leading-5">{viewingCandidate?.background || "No platform information provided."}</Text>
            <TouchableOpacity onPress={() => setViewingCandidate(null)} className="mt-8 bg-[#f1c40f] p-4 rounded-xl items-center">
              <Text className="text-black font-black">CLOSE</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default VoterScreen;