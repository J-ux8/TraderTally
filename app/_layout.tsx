import { DarkTheme, DefaultTheme, ThemeProvider as NavigationThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { ThemeProvider, useTheme } from '@/contexts/ThemeContext';
import { TransactionsProvider } from '@/contexts/TransactionsContext';
import { registerBackgroundSync } from '@/lib/backgroundSync';
import React from 'react';

export const unstable_settings = {
  anchor: '(tabs)',
};

function RootLayoutContent() {
  const { theme } = useTheme();

  React.useEffect(() => {
    registerBackgroundSync().catch(err => console.error('Failed to register background sync', err));
  }, []);

  return (
    <NavigationThemeProvider value={theme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="Authentication/login" options={{ title: 'Login', headerShown: false }} />
        <Stack.Screen name="Authentication/register" options={{ title: 'Register', headerShown: false }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
      </Stack>
      <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
    </NavigationThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <TransactionsProvider>
        <RootLayoutContent />
      </TransactionsProvider>
    </ThemeProvider>
  );
}
