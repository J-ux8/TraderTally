import { supabase } from '@/lib/supabase';
import { getCachedSession } from '@/lib/session-cache';
import NetInfo from '@react-native-community/netinfo';
import { useEffect, useState } from 'react';

export function useAuth() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    // Monitor network status
    const unsubscribeNetwork = NetInfo.addEventListener((state) => {
      setIsOnline(state.isConnected ?? false);
    });

    // Get initial session - try Supabase first, fallback to cache
    const initAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          setUser(session.user);
          setLoading(false);
          return;
        }
      } catch (error) {
        console.log('[useAuth] Supabase auth failed, checking cache');
      }

      // Fallback to cached session
      try {
        const cached = await getCachedSession();
        if (cached) {
          setUser({ id: cached.userId, email: cached.email });
          console.log('[useAuth] Using cached session for offline mode');
        }
      } catch (error) {
        console.error('[useAuth] Failed to get cached session:', error);
      }
      
      setLoading(false);
    };

    initAuth();

    // Listen for auth changes (only works when online)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => {
      subscription.unsubscribe();
      unsubscribeNetwork();
    };
  }, []);

  return { user, loading, isOnline };
}
