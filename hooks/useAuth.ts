import { supabase } from '@/lib/supabase';
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

    // Get initial session from Supabase only
    const initAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        setUser(session?.user ?? null);
      } catch (error) {
        console.error('[useAuth] Failed to get session:', error);
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    initAuth();

    // Listen for auth changes
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
