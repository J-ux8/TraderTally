import AsyncStorage from '@react-native-async-storage/async-storage';

const PROFILE_CACHE_KEY = '@mobibooks_profile_cache';

export interface CachedProfile {
  id: string;
  full_name: string;
  email: string;
  phone_number: string;
  business_type: string;
}

export async function cacheProfile(profile: CachedProfile): Promise<void> {
  try {
    await AsyncStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(profile));
    console.log('[ProfileCache] Profile cached successfully');
  } catch (error) {
    console.error('[ProfileCache] Failed to cache profile:', error);
  }
}

export async function getCachedProfile(): Promise<CachedProfile | null> {
  try {
    const cached = await AsyncStorage.getItem(PROFILE_CACHE_KEY);
    if (cached) {
      return JSON.parse(cached);
    }
    return null;
  } catch (error) {
    console.error('[ProfileCache] Failed to get cached profile:', error);
    return null;
  }
}

export async function clearProfileCache(): Promise<void> {
  try {
    await AsyncStorage.removeItem(PROFILE_CACHE_KEY);
    console.log('[ProfileCache] Profile cache cleared');
  } catch (error) {
    console.error('[ProfileCache] Failed to clear profile cache:', error);
  }
}
