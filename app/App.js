import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import * as Notifications from 'expo-notifications';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider, useAuth } from './src/AuthContext';
import { colors } from './src/theme';

import LoginScreen from './src/screens/LoginScreen';
import SignupScreen from './src/screens/SignupScreen';
import TodoScreen from './src/screens/TodoScreen';
import VaultScreen from './src/screens/VaultScreen';
import PasswordVaultScreen from './src/screens/PasswordVaultScreen';
import RecycleBinScreen from './src/screens/RecycleBinScreen';
import BackupScreen from './src/screens/BackupScreen';

const Stack = createNativeStackNavigator();
const Tabs = createBottomTabNavigator();

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowAlert: true, shouldPlaySound: true, shouldSetBadge: false }),
});

function MainTabs() {
  return (
    <Tabs.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.bgDark },
        headerTitleStyle: { color: colors.text },
        tabBarStyle: { backgroundColor: colors.bgDark, borderTopColor: colors.border },
        tabBarActiveTintColor: colors.gold,
        tabBarInactiveTintColor: colors.textMuted,
      }}
    >
      <Tabs.Screen name="To-do" component={TodoScreen} />
      <Tabs.Screen name="Vault" component={VaultScreen} />
      <Tabs.Screen name="Passwords" component={PasswordVaultScreen} />
      <Tabs.Screen name="Recycle bin" component={RecycleBinScreen} />
      <Tabs.Screen name="Backup" component={BackupScreen} />
    </Tabs.Navigator>
  );
}

function RootNavigator() {
  const { token, loading } = useAuth();
  if (loading) return null;

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {token ? (
          <Stack.Screen name="Main" component={MainTabs} />
        ) : (
          <>
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Signup" component={SignupScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  useEffect(() => {
    Notifications.requestPermissionsAsync().catch(() => {});
  }, []);

  return (
    <AuthProvider>
      <StatusBar style="light" />
      <RootNavigator />
    </AuthProvider>
  );
}
