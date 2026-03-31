import { supabase } from "./supabase";
import { NetworkMonitor } from "../sync/NetworkMonitor";

export async function signIn(email: string, password: string) {
  if (!NetworkMonitor.getStatus()) {
    throw new Error("You are offline. Please check your internet connection.");
  }

  const { data, error } = await supabase.auth.signInWithPassword({
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
  if (!NetworkMonitor.getStatus()) {
    throw new Error("You are offline. Please check your internet connection.");
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName.trim(),
        phone_number: phoneNumber.trim(),
        business_type: businessType,
      },
    },
  });

  if (error) {
    throw error;
  }

  if (!data.user) {
    throw new Error("Failed to create user account");
  }

  return {
    user: data.user,
    profileData: {
      fullName,
      phoneNumber,
      businessType,
    },
  };
}

export async function signOut() {
  try {
    // Attempt to notify the server (may fail if offline)
    await supabase.auth.signOut();
  } catch (error) {
    console.warn('[Auth] Sign out server call failed (probably offline), proceeding with local logout:', error);
    // Even if it fails, the local session is usually cleared by the supabase client
  }
}

/**
 * Initiates password reset process.
 */
export async function forgotPassword(email: string) {
  if (!NetworkMonitor.getStatus()) {
    throw new Error("You are offline. Please check your internet connection.");
  }

  const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: undefined,
  });

  if (error) {
    throw error;
  }

  return data;
}

/**
 * Updates the password for the current session user.
 */
export async function updatePassword(newPassword: string) {
  if (!NetworkMonitor.getStatus()) {
    throw new Error("You are offline. Please check your internet connection.");
  }

  const { data, error } = await supabase.auth.updateUser({
    password: newPassword,
  });

  if (error) {
    throw error;
  }

  return data;
}