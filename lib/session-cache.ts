import AsyncStorage from '@react-native-async-storage/async-storage';

const SESSION_CACHE_KEY = '@mobibooks_session_cache';

interface CachedSession {
  userId: string;
  email: string;
  sessionToken: string;
  cachedAt: string;
}

export async function cacheSession(userId: string, email: string, sessionToken: string) {
  const session: CachedSession = {
    userId,
    email,
    sessionToken,
    cachedAt: new Date().toISOString()
  };
  await AsyncStorage.setItem(SESSION_CACHE_KEY, JSON.stringify(session));
}

export async function getCachedSession(): Promise<CachedSession | null> {
  const cached = await AsyncStorage.getItem(SESSION_CACHE_KEY);
  return cached ? JSON.parse(cached) : null;
}

export async function clearSessionCache() {
  await AsyncStorage.removeItem(SESSION_CACHE_KEY);
}
