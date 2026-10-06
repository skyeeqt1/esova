import { LinearGradient } from 'expo-linear-gradient';
import { cssInterop } from 'nativewind';

/**
 * NativeWind only auto-registers React Native core components (plus
 * react-native-safe-area-context) for `className` support. Third-party
 * components must be registered manually — otherwise their `className`
 * props are silently ignored on native: layouts look correct on web
 * (real CSS classes) but break on device.
 *
 * Keep this module imported first in App.tsx so registration runs
 * before any screen renders.
 */
cssInterop(LinearGradient, { className: 'style' });
