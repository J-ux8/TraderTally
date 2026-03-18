import { supabase } from "./supabase";
import { LocalDB, LocalBaseModel } from "../database/localDb";
import { SyncEngine } from "../sync/syncEngine";

export interface UserProfile extends LocalBaseModel {
  full_name: string;
  email: string;
  phone_number: string;
  business_type: string;
}

export async function getUserProfile(): Promise<UserProfile | null> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id;
    if (!userId) return null;

    // Fetch from local db first
    const localProfile = await LocalDB.getById<UserProfile>('profiles', userId);
    return localProfile;
  } catch (error) {
    console.error('[Profile] Error loading profile:', error);
    return null;
  }
}

/**
 * Create a new user profile locally
 */
export async function createUserProfile(
  id: string,
  email: string,
  fullName: string,
  phoneNumber: string,
  businessType: string
): Promise<UserProfile> {
  // Check if session is already active
  const existingProfile = await LocalDB.getById<UserProfile>('profiles', id);
  if (existingProfile) return existingProfile;

  // Create new profile locally
  const record = await LocalDB.create<UserProfile>('profiles', {
    id: id,
    full_name: fullName.trim(),
    email: email.trim(),
    phone_number: phoneNumber.trim(),
    business_type: businessType
  } as any);

  SyncEngine.syncAll().catch(console.error);
  return record;
}

/**
 * Update user profile
 */
export async function updateUserProfile(
  fullName: string,
  phoneNumber: string,
  businessType: string
): Promise<UserProfile> {
  const { data: { session } } = await supabase.auth.getSession();
  const userId = session?.user?.id;
  if (!userId) throw new Error("User not authenticated");

  const existingProfile = await getUserProfile();
  
  if (!existingProfile) {
    // Create new profile locally
    const record = await LocalDB.create<UserProfile>('profiles', {
      id: userId, // Ensure we use auth user id
      full_name: fullName.trim(),
      email: session.user.email || '',
      phone_number: phoneNumber.trim(),
      business_type: businessType
    } as any);

    SyncEngine.syncAll().catch(console.error);
    return record;
  }

  // Update existing profile locally
  await LocalDB.update('profiles', userId, {
    full_name: fullName.trim(),
    phone_number: phoneNumber.trim(),
    business_type: businessType
  });

  const updated = await getUserProfile();
  SyncEngine.syncAll().catch(console.error);
  return updated!;
}

/**
 * Update password (still requires online for security verification)
 */
export async function updatePassword(
  currentPassword: string,
  newPassword: string
): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !user.email) throw new Error("User not authenticated");

  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: currentPassword,
  });

  if (signInError) throw new Error("Current password is incorrect");

  const { error: updateError } = await supabase.auth.updateUser({
    password: newPassword,
  });

  if (updateError) throw updateError;
}

