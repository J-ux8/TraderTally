import { DarkTheme, DefaultTheme, ThemeProvider as NavigationThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { ThemeProvider, useTheme } from '@/contexts/ThemeContext';
import { TransactionsProvider } from '@/contexts/TransactionsContext';
import { CategoriesProvider } from '@/contexts/CategoriesContext';
import { ToastProvider } from '@/contexts/ToastContext';
import { TemplatesProvider } from '@/contexts/TemplatesContext';
import { useNavigationGuard } from '@/hooks/useNavigationGuard';
import React from 'react';

export const unstable_settings = {
  initialRouteName: 'index',
};

import { getSecuritySettings } from '@/lib/security';
import { supabase } from '@/lib/supabase';
import { router, usePathname } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { AppState, AppStateStatus } from 'react-native';

function RootLayoutContent() {
  const { theme } = useTheme();
  const appState = useRef(AppState.currentState);
  const [lastBackgroundTime, setLastBackgroundTime] = useState<number | null>(null);
  const pathname = usePathname();

  // Add navigation guard
  useNavigationGuard();

  useEffect(() => {
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, [pathname, lastBackgroundTime]);

  const handleAppStateChange = async (nextAppState: AppStateStatus) => {
    if (
      appState.current.match(/inactive|background/) &&
      nextAppState === 'active'
    ) {
      // App has come to foreground
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const settings = await getSecuritySettings(user.id);
      if (settings.appLockEnabled) {
        const now = Date.now();
        const inactiveTime = lastBackgroundTime ? now - lastBackgroundTime : 0;

        // Lock if background for more than 5 minutes (300000ms)
        if (inactiveTime > 300000 && pathname !== '/unlock' && pathname !== '/welcome' && !pathname.includes('Authentication')) {
          router.replace('/unlock');
        }
      }
    }

    if (nextAppState.match(/inactive|background/)) {
      setLastBackgroundTime(Date.now());
    }

    appState.current = nextAppState;
  };

  return (
    <NavigationThemeProvider value={theme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack screenOptions={{ 
        gestureEnabled: true, 
        gestureDirection: 'horizontal',
        headerShown: false 
      }}>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen 
          name="welcome" 
          options={{ 
            headerShown: false, 
            animation: 'fade',
            gestureEnabled: false
          }} 
        />
        <Stack.Screen 
          name="unlock" 
          options={{ 
            headerShown: false, 
            animation: 'fade',
            gestureEnabled: false // Prevent swipe back from unlock
          }} 
        />
        <Stack.Screen 
          name="(tabs)" 
          options={{ 
            headerShown: false,
            gestureEnabled: false
          }} 
        />
        <Stack.Screen 
          name="Authentication/login" 
          options={{ 
            title: 'Login', 
            headerShown: false,
            gestureEnabled: false // Prevent swipe back from login
          }} 
        />
        <Stack.Screen 
          name="Authentication/register" 
          options={{ 
            title: 'Register', 
            headerShown: false,
            gestureEnabled: false // Prevent swipe back from register
          }} 
        />
        <Stack.Screen 
          name="Authentication/verify-email" 
          options={{ 
            headerShown: false,
            gestureEnabled: false // Prevent swipe back from verify
          }} 
        />
        <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
        <Stack.Screen 
          name="modals/record-sale" 
          options={{ 
            headerShown: false, 
            animation: 'slide_from_right'
          }} 
        />
        <Stack.Screen 
          name="modals/record-expense" 
          options={{ 
            headerShown: false, 
            animation: 'slide_from_right'
          }} 
        />
        <Stack.Screen 
          name="modals/add-debt" 
          options={{ 
            headerShown: false, 
            animation: 'slide_from_right'
          }} 
        />
        <Stack.Screen 
          name="modals/create-template" 
          options={{ 
            headerShown: false, 
            animation: 'slide_from_right'
          }} 
        />
        <Stack.Screen 
          name="modals/edit-template" 
          options={{ 
            headerShown: false, 
            animation: 'slide_from_right'
          }} 
        />
        <Stack.Screen 
          name="modals/transaction-group-detail" 
          options={{ 
            headerShown: false, 
            animation: 'slide_from_right'
          }} 
        />
      </Stack>
      <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
    </NavigationThemeProvider>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <TransactionsProvider>
        <CategoriesProvider>
          <TemplatesProvider>
            <ToastProvider>
              <RootLayoutContent />
            </ToastProvider>
          </TemplatesProvider>
        </CategoriesProvider>
      </TransactionsProvider>
    </ThemeProvider>
  );
}
