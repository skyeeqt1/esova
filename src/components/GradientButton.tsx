import React from 'react';
import { Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

type GradientButtonProps = {
  onPress: () => void;
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  loading?: boolean;
  disabled?: boolean;
  colors?: [string, string];
  className?: string;
  textClassName?: string;
};

/**
 * Premium gradient CTA used for the hero actions across the app
 * (Sign In, Review Ballot, Start Session...). Soft press-scale
 * feedback is applied via `active:scale-[0.97]` (transform — safe).
 */
const GradientButton = ({
  onPress,
  label,
  icon,
  iconColor = '#fff',
  loading = false,
  disabled = false,
  colors = ['#7c3aed', '#a78bfa'],
  className = '',
  textClassName = '',
}: GradientButtonProps) => (
  <TouchableOpacity
    onPress={onPress}
    disabled={disabled || loading}
    delayPressIn={0}
    activeOpacity={0.82}
    accessibilityRole="button"
    accessibilityState={{ disabled: disabled || loading, busy: loading }}
    accessibilityLabel={label}
    className={`overflow-hidden rounded-2xl active:scale-[0.97] ${disabled ? 'opacity-60' : ''} ${className}`}>
    <LinearGradient
      colors={colors}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      className="w-full flex-row items-center justify-center px-6 py-4">
      {loading ? (
        <ActivityIndicator color="#fff" size="small" />
      ) : (
        <>
          {icon && <Ionicons name={icon} size={18} color={iconColor} />}
          <Text className={`ml-2 text-[15px] font-bold text-white ${textClassName}`}>{label}</Text>
        </>
      )}
    </LinearGradient>
  </TouchableOpacity>
);

export default GradientButton;
