import React from 'react';
import { View, Text, TouchableOpacity, Modal, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type LogoutModalProps = {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  description?: string;
  confirmLabel?: string;
  loading?: boolean;
};

/**
 * Branded logout confirmation modal.
 * Matches the app's midnight + rose design system and replaces the plain
 * native Alert used previously.
 */
const LogoutModal = ({
  visible,
  onClose,
  onConfirm,
  title = 'Log out?',
  description = 'You will need to sign in again to access your account.',
  confirmLabel = 'Logout',
  loading = false,
}: LogoutModalProps) => (
  <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
    <View className="flex-1 items-center justify-center bg-black/80 p-6">
      <View className="card w-full max-w-sm items-center !rounded-3xl border-white/[0.1] p-6">
        {/* Icon in a rose-tinted tile */}
        <View className="mb-4 h-16 w-16 items-center justify-center rounded-2xl border border-rose-500/25 bg-rose-500/10">
          <Ionicons name="log-out-outline" size={28} color="#fb7185" />
        </View>

        <Text className="text-xl font-bold tracking-tight text-white">{title}</Text>
        <Text className="mb-6 mt-1.5 text-center text-sm leading-5 text-slate-400">
          {description}
        </Text>

        <View className="w-full flex-row gap-3">
          <TouchableOpacity onPress={onClose} disabled={loading} className="btn btn-ghost flex-1">
            <Text className="text-sm font-semibold text-slate-200">Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={onConfirm}
            disabled={loading}
            className="btn flex-1 border border-rose-500/40 bg-rose-500/90 active:bg-rose-600">
            {loading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Ionicons name="log-out-outline" size={16} color="#fff" />
                <Text className="ml-1.5 text-sm font-semibold text-white">{confirmLabel}</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </View>
  </Modal>
);

export default LogoutModal;
