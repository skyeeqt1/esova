import React, { useEffect } from 'react';
import { BackHandler, Alert, StatusBar } from 'react-native';
import { NavigationContainer, DefaultTheme, useNavigation } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import LoginScreen from './src/screens/LoginScreen';
import AdminDashboard from './src/screens/AdminDashboard';
import VoterScreen from './src/screens/VoterScreen';
import ChangePasswordScreen from './src/screens/ChangePasswordScreen';
import './global.css';

const Stack = createNativeStackNavigator();

const navTheme = {
  ...DefaultTheme,
  dark: true,
  colors: {
    ...DefaultTheme.colors,
    primary: '#a78bfa',
    background: '#06090f',
    card: '#06090f',
    text: '#ffffff',
    border: 'rgba(255,255,255,0.08)',
    notification: '#8b5cf6',
  },
};

function BackButtonHandler() {
  const navigation = useNavigation();

  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (navigation.canGoBack()) {
        navigation.goBack();
        return true; // Prevent default back button behavior
      }
      // If we can't go back, exit the app
      Alert.alert(
        'Exit App',
        'Are you sure you want to exit?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Exit', onPress: () => BackHandler.exitApp() },
        ],
        { cancelable: false }
      );
      return true;
    });

    return () => backHandler.remove();
  }, [navigation]);

  return null;
}

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" backgroundColor="#06090f" />
      <NavigationContainer theme={navTheme}>
        <BackButtonHandler />
        <Stack.Navigator
          screenOptions={{
            headerShown: false,
            animation: 'slide_from_right',
          }}>
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="AdminDashboard" component={AdminDashboard} />
          <Stack.Screen name="VoterScreen" component={VoterScreen} />
          <Stack.Screen name="ChangePassword" component={ChangePasswordScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
