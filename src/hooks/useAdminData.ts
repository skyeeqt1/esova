import { useState, useEffect } from 'react';
import { Platform, Alert } from 'react-native';
import { db } from '../config/firebase';
import { 
  collection, onSnapshot, query, where, doc, 
  deleteDoc, writeBatch, orderBy, limit, addDoc, serverTimestamp 
} from 'firebase/firestore';

export const DEFAULT_AVATAR = "https://via.placeholder.com/150";
export const POSITIONS = ["President", "VP", "Secretary", "Treasurer"];

interface Voter {
  id: string;
  name: string;
  email: string;
  studentId: string;
  role: 'voter';
  hasVoted: boolean;
  ballot?: string | null;
  votedAt?: string | null;
}

interface Candidate {
  id: string;
  name: string;
  position: string;
  votes: number;
  image?: string;
}

interface AdminLog {
  id: string;
  action: string;
  targetName: string;
  targetId: string;
  reason: string;
  timestamp: any;
}

export const useAdminData = () => {
  const [voters, setVoters] = useState<Voter[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [logs, setLogs] = useState<AdminLog[]>([]); // New state for logs
  const [isProcessing, setIsProcessing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(true);
    
    // 1. Voters Listener
    const unsubVoters = onSnapshot(
      query(collection(db, "users"), where("role", "==", "voter")),
      (snap) => {
        setVoters(snap.docs.map(d => ({ id: d.id, ...d.data() } as Voter)));
      },
      (error) => handleListenerError(error, "voters")
    );

    // 2. Candidates Listener
    const unsubCandidates = onSnapshot(
      collection(db, "candidates"),
      (snap) => {
        setCandidates(snap.docs.map(d => ({ id: d.id, ...d.data() } as Candidate)));
        setIsLoading(false);
      },
      (error) => handleListenerError(error, "candidates")
    );

    // 3. Admin Logs Listener (New)
    const unsubLogs = onSnapshot(
      query(collection(db, "admin_logs"), orderBy("timestamp", "desc"), limit(50)),
      (snap) => {
        setLogs(snap.docs.map(d => ({ id: d.id, ...d.data() } as AdminLog)));
      },
      (error) => console.error("Logs listener error:", error)
    );

    return () => { 
      unsubVoters(); 
      unsubCandidates(); 
      unsubLogs();
    };
  }, []);

  const handleListenerError = (error: any, type: string) => {
    console.error(`${type} listener error:`, error);
    const msg = error.message || `Permission denied for ${type}`;
    Platform.OS === 'web' ? alert(msg) : Alert.alert("Error", msg);
    setIsLoading(false);
  };

  // Updated to include reason for Audit Logs
  const handleDeleteItem = async (collectionName: string, id: string, extraData?: { name: string, studentId: string, reason: string }) => {
    const performDelete = async () => {
      setIsProcessing(true);
      try {
        // If it's a voter deletion, log the reason first
        if (collectionName === "users" && extraData) {
          await addDoc(collection(db, "admin_logs"), {
            action: "DELETE_VOTER",
            targetName: extraData.name,
            targetId: extraData.studentId,
            reason: extraData.reason,
            timestamp: serverTimestamp(),
          });
        }

        await deleteDoc(doc(db, collectionName, id));
        const msg = "Record deleted successfully";
        Platform.OS === 'web' ? alert(msg) : Alert.alert("Success", msg);
      } catch (e: any) {
        handleActionError(e, "Delete");
      } finally { 
        setIsProcessing(false); 
      }
    };

    // Note: Confirmation UI is now handled inside VoterSection modal for reason input, 
    // but we keep this for Candidate deletions or simple removals.
    if (!extraData) {
        if (Platform.OS === 'web') {
            if (window.confirm("Delete record? This cannot be undone.")) await performDelete();
        } else {
            Alert.alert('Confirm', 'Delete record? This cannot be undone.', [
                { text: 'Cancel', style: 'cancel' }, 
                { text: 'Delete', onPress: performDelete, style: 'destructive' }
            ]);
        }
    } else {
        await performDelete();
    }
  };

  const handleResetElection = async () => {
    const performReset = async () => {
      setIsProcessing(true);
      try {
        const batch = writeBatch(db);
        candidates.forEach(c => batch.update(doc(db, "candidates", c.id), { votes: 0 }));
        voters.forEach(v => batch.update(doc(db, "users", v.id), { hasVoted: false, ballot: null, votedAt: null }));
        
        await batch.commit();
        
        // Log the reset action
        await addDoc(collection(db, "admin_logs"), {
            action: "RESET_ELECTION",
            targetName: "All Data",
            targetId: "SYSTEM",
            reason: "Admin initiated total reset",
            timestamp: serverTimestamp(),
        });

        const msg = "Election reset successfully";
        Platform.OS === 'web' ? alert(msg) : Alert.alert("Success", msg);
      } catch (e: any) {
        handleActionError(e, "Reset");
      } finally { 
        setIsProcessing(false); 
      }
    };

    const resetMsg = "Reset election? This will reset all votes and voter status.";
    if (Platform.OS === 'web') {
      if (window.confirm(resetMsg)) await performReset();
    } else {
      Alert.alert('Reset Election', resetMsg, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Reset', onPress: performReset, style: 'destructive' }
      ]);
    }
  };

  const handleActionError = (e: any, type: string) => {
    console.error(`${type} error:`, e);
    const errorMsg = e.code === 'permission-denied' ? `No permission to ${type.toLowerCase()}` : e.message;
    Platform.OS === 'web' ? alert(errorMsg) : Alert.alert("Error", errorMsg);
  };

  return { 
    voters, 
    candidates, 
    logs, // Return logs to the UI
    isProcessing, 
    setIsProcessing, 
    isLoading,
    handleDeleteItem, 
    handleResetElection 
  };
};