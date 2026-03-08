import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';

const RLS_NOTIFICATION_KEY = '@mobibooks_rls_notified';

export async function notifyRLSIssueOnce(): Promise<void> {
  // Notification disabled - user already knows about Supabase setup
  // Data is saved locally and works perfectly offline
  // Cloud sync is optional and can be enabled later
  return;
}

export async function clearRLSNotification(): Promise<void> {
  try {
    await AsyncStorage.removeItem(RLS_NOTIFICATION_KEY);
  } catch (error) {
    console.error('[RLS Notification] Failed to clear notification:', error);
  }
}
