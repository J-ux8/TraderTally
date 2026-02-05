import { supabase } from "@/lib/supabase";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";

export default function Index() {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuthAndRedirect();
  }, []);

  async function checkAuthAndRedirect() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        // Check if user has a profile - if not, they need to complete registration
        const { data: profile } = await supabase
          .from("profiles")
          .select("id")
          .eq("id", session.user.id)
          .single();
        
        if (!profile) {
          // User exists but no profile - might be in middle of registration
          // Don't redirect - let them complete OTP verification
          // If they're already on verify-email screen, stay there
          router.replace("/Authentication/login");
          return;
        }
        
        // User is logged in and has profile, go to home
        router.replace("/(tabs)");
      } else {
        // User is not logged in, go to login
        router.replace("/Authentication/login");
      }
    } catch (error) {
      console.error("Error checking auth:", error);
      router.replace("/Authentication/login");
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#10b981" />
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f5f5f5",
  },
});

