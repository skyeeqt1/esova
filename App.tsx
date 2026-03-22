import React, { useEffect } from 'react';
import { BackHandler, Alert } from 'react-native';
import { NavigationContainer, useNavigation } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import LoginScreen from './src/screens/LoginScreen';
import AdminDashboard from './src/screens/AdminDashboard';
import VoterScreen from './src/screens/VoterScreen';
import VoterProfile from './src/screens/VoterProfile';
import "./global.css";

const Stack = createNativeStackNavigator();

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
    <NavigationContainer>
      <BackButtonHandler />
      <Stack.Navigator 
        screenOptions={{ 
          headerShown: false,
          animation: 'slide_from_right' 
        }}
      >
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="AdminDashboard" component={AdminDashboard} />
        <Stack.Screen name="VoterScreen" component={VoterScreen} />
        <Stack.Screen name="VoterProfile" component={VoterProfile} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}