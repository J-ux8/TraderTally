import { supabase } from "./supabase";
import { cacheProfile, getCachedProfile } from "./profile-cache";
import NetInfo from '@react-native-community/netinfo';

export interface UserProfile {
  id: string;
  full_name: string;
  email: string;
  phone_number: string;
  business_type: string;
  created_at: string;
  updated_at: string;
}

// Get user profile with offline support
export async function getUserProfile(): Promise<UserProfile | null> {
  try {
    // Check network status
    const netState = await NetInfo.fetch();
    const isOnline = netState.isConnected ?? false;

    if (!isOnline) {
      // Return cached profile when offline
      console.log('[Profile] Offline - using cached profile');
      const cached = await getCachedProfile();
      if (cached) {
        return {
          ...cached,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
      }
      return null;
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      // Try cached profile as fallback
      const cached = await getCachedProfile();
      if (cached) {
        return {
          ...cached,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
      }
      return null;
    }

    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    if (error) {
      // If profile doesn't exist, try to create a default one
      if (error.code === 'PGRST116') {
        try {
          const defaultProfile = await createDefaultProfile(user.id, user.email || '');
          if (defaultProfile) {
            // Cache the profile
            await cacheProfile({
              id: defaultProfile.id,
              full_name: defaultProfile.full_name,
              email: defaultProfile.email,
              phone_number: defaultProfile.phone_number,
              business_type: defaultProfile.business_type,
            });
          }
          return defaultProfile;
        } catch (createError) {
          // Return cached profile as fallback
          const cached = await getCachedProfile();
          if (cached) {
            return {
              ...cached,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            };
          }
          return null;
        }
      }
      // Return cached profile as fallback
      const cached = await getCachedProfile();
      if (cached) {
        return {
          ...cached,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
      }
      return null;
    }

    // Cache the profile for offline use
    if (data) {
      await cacheProfile({
        id: data.id,
        full_name: data.full_name,
        email: data.email,
        phone_number: data.phone_number,
        business_type: data.business_type,
      });
    }

    return data;
  } catch (error) {
    console.log('[Profile] Error loading profile, using cache');
    // Return cached profile as fallback
    const cached = await getCachedProfile();
    if (cached) {
      return {
        ...cached,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    }
    return null;
  }
}

// Create profile for new user (called after email verification)
export async function createUserProfile(
  userId: string,
  email: string,
  fullName: string,
  phoneNumber: string,
  businessType: string
): Promise<UserProfile | null> {
  try {
    // First check if profile already exists
    const { data: existing } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    if (existing) {
      // Profile already exists, return it
      return existing;
    }

    // Try using database function first (bypasses RLS)
    const { data: functionData, error: functionError } = await supabase.rpc("insert_user_profile", {
      p_user_id: userId,
      p_email: email,
      p_full_name: fullName.trim(),
      p_phone_number: phoneNumber.trim(),
      p_business_type: businessType,
    });

    if (!functionError) {
      // Function succeeded (returns UUID), fetch the profile
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();

      if (!error && data) {
        console.log("Profile created successfully using function");
        return data;
      } else {
        console.error("Error fetching profile after function call:", error);
      }
    } else {
      console.error("Error calling insert_user_profile function:", functionError);
      // Continue to fallback
    }

    // Fallback to direct insert (only if function failed)
    // This will likely fail due to RLS, but we try anyway
    const { data, error } = await supabase
      .from("profiles")
      .insert({
        id: userId,
        full_name: fullName.trim(),
        email: email,
        phone_number: phoneNumber.trim(),
        business_type: businessType,
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating profile (fallback):", error);
      // If RLS error, suggest running the SQL migration
      if (error.code === "42501") {
        throw new Error("Profile creation failed due to RLS. Please run the SQL migration: fix_profiles_rls.sql");
      }
      throw error;
    }

    return data;
  } catch (error) {
    console.error("Error creating profile:", error);
    throw error;
  }
}

// Create default profile for user
async function createDefaultProfile(userId: string, userEmail: string): Promise<UserProfile | null> {
  try {
    // First try using the database function (bypasses RLS)
    const { data: functionData, error: functionError } = await supabase.rpc("insert_user_profile", {
      p_user_id: userId,
      p_email: userEmail,
      p_full_name: '',
      p_phone_number: '',
      p_business_type: 'Other',
    });

    if (!functionError && functionData) {
      // Function succeeded, fetch the profile
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();

      if (!error && data) {
        return data;
      }
    }

    // Fallback to direct insert if function doesn't exist
    const { data, error } = await supabase
      .from("profiles")
      .insert({
        id: userId,
        full_name: '',
        email: userEmail,
        phone_number: '',
        business_type: 'Other',
      })
      .select()
      .single();

    if (error) {
      // Don't log RLS errors as errors - they're expected if user isn't fully authenticated
      if (error.code !== "42501") {
        console.error("Error creating default profile:", error);
      }
      return null;
    }

    return data;
  } catch (error) {
    // Don't log RLS errors as errors
    if (error && typeof error === 'object' && 'code' in error && error.code !== "42501") {
      console.error("Error creating default profile:", error);
    }
    return null;
  }
}

// Update user profile
export async function updateUserProfile(
  fullName: string,
  phoneNumber: string,
  businessType: string
): Promise<UserProfile> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("User not authenticated");

  // First check if profile exists
  const existingProfile = await getUserProfile();
  
  if (!existingProfile) {
    // Create new profile if it doesn't exist
    const { data, error } = await supabase
      .from("profiles")
      .insert({
        id: user.id,
        full_name: fullName.trim(),
        email: user.email || '',
        phone_number: phoneNumber.trim(),
        business_type: businessType,
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    // Cache the new profile
    await cacheProfile({
      id: data.id,
      full_name: data.full_name,
      email: data.email,
      phone_number: data.phone_number,
      business_type: data.business_type,
    });

    return data;
  }

  // Update existing profile
  const { data, error } = await supabase
    .from("profiles")
    .update({
      full_name: fullName.trim(),
      phone_number: phoneNumber.trim(),
      business_type: businessType,
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id)
    .select()
    .single();

  if (error) {
    throw error;
  }

  // Cache the updated profile
  await cacheProfile({
    id: data.id,
    full_name: data.full_name,
    email: data.email,
    phone_number: data.phone_number,
    business_type: data.business_type,
  });

  return data;
}

// Update password
export async function updatePassword(
  currentPassword: string,
  newPassword: string
): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !user.email) throw new Error("User not authenticated");

  // First verify current password by attempting to sign in
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: currentPassword,
  });

  if (signInError) {
    throw new Error("Current password is incorrect");
  }

  // Update password
  const { error: updateError } = await supabase.auth.updateUser({
    password: newPassword,
  });

  if (updateError) {
    throw updateError;
  }
}

