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

export async function registerWithProfile(
  email: string,
  password: string,
  fullName: string,
  phoneNumber: string,
  businessType: string
) {
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
  const { error } = await supabase.auth.signOut();

  if (error) {
    throw error;
  }
}

/**
 * Initiates password reset process.
 */
export async function forgotPassword(email: string) {
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
  const { data, error } = await supabase.auth.updateUser({
    password: newPassword,
  });

  if (error) {
    throw error;
  }

  return data;
}