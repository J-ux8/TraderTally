import { supabase } from "./supabase";

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    throw error;
  }

  return data;
}

export async function signUp(email: string, password: string) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  });

  if (error) {
    throw error;
  }

  return data;
}

export async function registerWithProfile(
  email: string,
  password: string,
  fullName: string,
  phoneNumber: string,
  businessType: string
) {
  // Step 1: Create auth account
  // Note: Supabase may send a confirmation email by default
  // We'll use our own OTP system, but handle if user verifies via email link
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      // Don't set emailRedirectTo - this prevents magic link emails
      // But Supabase may still send confirmation email based on project settings
      emailRedirectTo: undefined,
      data: {
        full_name: fullName,
        phone_number: phoneNumber,
        business_type: businessType,
        profile_pending: true,
      },
    },
  });

  if (authError) {
    throw authError;
  }

  if (!authData.user) {
    throw new Error("Failed to create user account");
  }

  // Always require OTP verification, even if email is already confirmed
  // This ensures users go through our custom OTP flow
  // Note: If user clicked magic link, we'll still require OTP for consistency
  const isAlreadyVerified = authData.user.email_confirmed_at !== null;

  return {
    user: authData.user,
    requiresVerification: true, // Always require OTP verification
    isAlreadyVerified: false, // Always treat as unverified to force OTP flow
    profileData: {
      fullName,
      phoneNumber,
      businessType,
    },
  };
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();

  if (error) {
    throw error;
  }
}