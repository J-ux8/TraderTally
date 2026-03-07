import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';

const RLS_NOTIFICATION_KEY = '@mobibooks_rls_notified';

export async function notifyRLSIssueOnce(): Promise<void> {
  try {
    const hasNotified = await AsyncStorage.getItem(RLS_NOTIFICATION_KEY);
    
    if (!hasNotified) {
      Alert.alert(
        'Setup Required',
        'Your data is saved locally and working offline. To enable cloud sync, please run the RLS migration in your Supabase dashboard. See SETUP_INSTRUCTIONS.md for details.',
        [
          {
            text: 'OK',
            onPress: async () => {
              await AsyncStorage.setItem(RLS_NOTIFICATION_KEY, 'true');
            }
          }
        ]
      );
    }
  } catch (error) {
    console.error('[RLS Notification] Failed to check/set notification:', error);
  }
}

export async function clearRLSNotification(): Promise<void> {
  try {
    await AsyncStorage.removeItem(RLS_NOTIFICATION_KEY);
  } catch (error) {
    console.error('[RLS Notification] Failed to clear notification:', error);
  }
}
