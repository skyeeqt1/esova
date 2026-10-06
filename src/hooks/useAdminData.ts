import { useState, useEffect } from 'react';
import { Platform, Alert } from 'react-native';
import { supabase } from '../config/supabase';

export const DEFAULT_AVATAR = 'https://via.placeholder.com/150';
export const POSITIONS = ['President', 'VP', 'Secretary', 'Treasurer'];

interface Voter {
  id: string;
  name: string;
  email: string;
  student_id: string;
  role: 'voter';
  has_voted: boolean;
  ballot?: string | null;
  voted_at?: string | null;
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
  target_name: string;
  target_id: string;
  reason: string;
  timestamp: string;
  admin_email?: string;
}

export const useAdminData = (adminEmail: string = '') => {
  const [voters, setVoters] = useState<Voter[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [logs, setLogs] = useState<AdminLog[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [currentAdminEmail] = useState(adminEmail);

  const fetchVoters = async () => {
    try {
      const { data, error } = await supabase.from('users').select('*').eq('role', 'voter');

      if (error) throw error;
      setVoters(data || []);
    } catch (error: any) {
      console.error('Error fetching voters:', error);
    }
  };

  const fetchCandidates = async () => {
    try {
      const { data, error } = await supabase.from('candidates').select('*');

      if (error) throw error;
      setCandidates(data || []);
      setIsLoading(false);
    } catch (error: any) {
      console.error('Error fetching candidates:', error);
      setIsLoading(false);
    }
  };

  const fetchLogs = async () => {
    try {
      const { data, error } = await supabase
        .from('admin_logs')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(50);

      if (error) throw error;
      setLogs(data || []);
    } catch (error: any) {
      console.error('Error fetching logs:', error);
    }
  };

  useEffect(() => {
    // Async fetchers: state updates land after the network response resolves,
    // never synchronously in the effect body
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchVoters();

    // Fetch candidates
    fetchCandidates();

    // Fetch admin logs
    fetchLogs();

    // Set up real-time subscriptions
    const votersChannel = supabase
      .channel('voters-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, () => {
        fetchVoters();
      })
      .subscribe();

    const candidatesChannel = supabase
      .channel('candidates-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'candidates' }, () => {
        fetchCandidates();
      })
      .subscribe();

    const logsChannel = supabase
      .channel('logs-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'admin_logs' }, () => {
        fetchLogs();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(votersChannel);
      supabase.removeChannel(candidatesChannel);
      supabase.removeChannel(logsChannel);
    };
  }, []);

  // Helper function to add admin log
  const addAdminLog = async (
    action: string,
    targetName: string,
    targetId: string,
    reason: string
  ) => {
    await supabase.from('admin_logs').insert({
      action,
      target_name: targetName,
      target_id: targetId,
      reason,
      admin_email: currentAdminEmail,
      timestamp: new Date().toISOString(),
    });
  };

  const handleDeleteItem = async (
    collectionName: string,
    id: string,
    extraData?: { name: string; studentId: string; reason: string }
  ) => {
    const performDelete = async () => {
      setIsProcessing(true);
      try {
        // Get candidate info before deletion for logging
        let targetName = '';
        let targetId = '';

        if (collectionName === 'candidates') {
          const { data: candidateData } = await supabase
            .from('candidates')
            .select('name, position')
            .eq('id', id)
            .single();
          if (candidateData) {
            targetName = candidateData.name;
            targetId = candidateData.position;
          }
        }

        // Log based on collection type (only log candidates here, voters are logged in VoterSection)
        if (collectionName === 'candidates') {
          await addAdminLog('DELETE_CANDIDATE', targetName, targetId, 'Candidate removed by admin');
        }

        const { error } = await supabase.from(collectionName).delete().eq('id', id);

        if (error) throw error;

        const msg = 'Record deleted successfully';
        if (Platform.OS === 'web') {
          alert(msg);
        } else {
          Alert.alert('Success', msg);
        }
      } catch (e: any) {
        handleActionError(e, 'Delete');
      } finally {
        setIsProcessing(false);
      }
    };

    if (!extraData) {
      if (Platform.OS === 'web') {
        if (window.confirm('Delete record? This cannot be undone.')) await performDelete();
      } else {
        Alert.alert('Confirm', 'Delete record? This cannot be undone.', [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Delete', onPress: performDelete, style: 'destructive' },
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
        // Reset all candidates' votes
        for (const candidate of candidates) {
          const { error } = await supabase
            .from('candidates')
            .update({ votes: 0 })
            .eq('id', candidate.id);
          if (error) throw error;
        }

        // Reset all voters' voted status
        for (const voter of voters) {
          const { error } = await supabase
            .from('users')
            .update({ has_voted: false, ballot: null, voted_at: null })
            .eq('id', voter.id);
          if (error) throw error;
        }

        // Log the reset action
        await supabase.from('admin_logs').insert({
          action: 'RESET_ELECTION',
          target_name: 'All Data',
          target_id: 'SYSTEM',
          reason: 'Admin initiated total reset',
          admin_email: currentAdminEmail,
          timestamp: new Date().toISOString(),
        });

        const msg = 'Election reset successfully';
        if (Platform.OS === 'web') {
          alert(msg);
        } else {
          Alert.alert('Success', msg);
        }
      } catch (e: any) {
        handleActionError(e, 'Reset');
      } finally {
        setIsProcessing(false);
      }
    };

    const resetMsg = 'Reset election? This will reset all votes and voter status.';
    if (Platform.OS === 'web') {
      if (window.confirm(resetMsg)) await performReset();
    } else {
      Alert.alert('Reset Election', resetMsg, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Reset', onPress: performReset, style: 'destructive' },
      ]);
    }
  };

  const handleActionError = (e: any, type: string) => {
    console.error(`${type} error:`, e);
    const errorMsg = e.message || `Error during ${type.toLowerCase()}`;
    if (Platform.OS === 'web') {
      alert(errorMsg);
    } else {
      Alert.alert('Error', errorMsg);
    }
  };

  // Refresh function to manually refresh all data
  const refreshData = async () => {
    await Promise.all([fetchVoters(), fetchCandidates(), fetchLogs()]);
  };

  return {
    voters,
    candidates,
    logs,
    isProcessing,
    setIsProcessing,
    isLoading,
    handleDeleteItem,
    handleResetElection,
    refreshData,
    currentAdminEmail,
  };
};
