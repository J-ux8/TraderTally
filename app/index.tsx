import { supabase } from "@/lib/supabase";
import { getCachedSession } from "@/lib/session-cache";
import { Redirect } from "expo-router";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";

export default function Index() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initSession = async () => {
      try {
        // Try Supabase first
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        if (currentSession) {
          setSession(currentSession);
          setLoading(false);
          return;
        }
      } catch (error) {
        console.log('[Index] Supabase auth failed, checking cache');
      }

      // Fallback to cached session for offline mode
      try {
        const cached = await getCachedSession();
        if (cached) {
          setSession({ user: { id: cached.userId, email: cached.email } });
          console.log('[Index] Using cached session for offline mode');
        }
      } catch (error) {
        console.error('[Index] Failed to get cached session:', error);
      }

      setLoading(false);
    };

    initSession();

    // Listen for changes (only works when online)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#1e3a8a', justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color="#ffffff" />
      </View>
    );
  }

  // If we have a session (online or cached), go straight to the dashboard
  if (session) {
    return <Redirect href="/(tabs)" />;
  }

  // Otherwise, show the welcome/onboarding screen
  return <Redirect href="/welcome" />;
}
