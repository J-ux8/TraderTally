import { supabase } from "./supabase";

export interface UserProfile {
  id: string;
  full_name: string;
  email: string;
  phone_number: string;
  business_type: string;
  created_at: string;
  updated_at: string;
}

export async function getUserProfile(): Promise<UserProfile | null> {
  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
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
          return await createDefaultProfile(user.id, user.email || '');
        } catch (createError) {
          return null;
        }
      }
      return null;
    }

    return data;
  } catch (error) {
    console.error('[Profile] Error loading profile:', error);
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
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();

      if (!error && data) {
        return data;
      }
    }

    // Fallback to direct insert
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
    // Try using the database function (bypasses RLS)
    const { data: functionData, error: functionError } = await supabase.rpc("insert_user_profile", {
      p_user_id: userId,
      p_email: userEmail,
      p_full_name: '',
      p_phone_number: '',
      p_business_type: 'Other',
    });

    if (!functionError && functionData) {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();

      if (!error && data) {
        return data;
      }
    }

    // Fallback to direct insert
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
      return null;
    }

    return data;
  } catch (error) {
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

