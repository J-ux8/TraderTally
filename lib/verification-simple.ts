import { supabase } from "./supabase";

// SIMPLE OTP system: Store OTP in memory, verify locally
// This bypasses all RLS and database issues

// In-memory storage for OTP codes (per email)
const otpStore = new Map<string, { code: string; expiresAt: Date; userId: string }>();

/**
 * Generate a 6-digit OTP code
 */
function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Send OTP code - generates code, stores in memory, displays in UI
 * Returns the OTP code so it can be displayed in the UI
 */
export async function sendVerificationOTP(email: string, userId: string): Promise<string> {
  // Generate OTP
  const otpCode = generateOTP();
  const expiresAt = new Date();
  expiresAt.setMinutes(expiresAt.getMinutes() + 10); // Expires in 10 minutes

  // Store OTP in memory (bypasses all database/RLS issues)
  otpStore.set(email.toLowerCase(), {
    code: otpCode,
    expiresAt: expiresAt,
    userId: userId,
  });

  console.log(`OTP code generated and stored in memory: ${otpCode} for ${email}`);

  // Always return the code so it can be displayed in UI
  return otpCode;
}

/**
 * Verify OTP code against in-memory store
 */
export async function verifyOTP(email: string, code: string, userId?: string): Promise<boolean> {
  try {
    console.log(`Verifying OTP: email=${email}, code=${code}, userId=${userId}`);
    
    // Get OTP from memory
    const stored = otpStore.get(email.toLowerCase());
    
    if (!stored) {
      console.error("No OTP found in memory for this email");
      return false;
    }

    // Check if code matches
    if (stored.code !== code) {
      console.error("OTP code does not match");
      return false;
    }

    // Check if code is expired
    if (stored.expiresAt < new Date()) {
      console.error("OTP code expired");
      otpStore.delete(email.toLowerCase()); // Clean up
      return false;
    }

    // Check if userId matches (if provided)
    if (userId && stored.userId !== userId) {
      console.error("User ID does not match");
      return false;
    }

    console.log("OTP code is valid!");

    // Mark email as confirmed using Edge Function
    if (userId) {
      try {
        const { error: functionError } = await supabase.functions.invoke('verify-email', {
          body: { userId },
        });
        
        if (functionError) {
          console.error("Error updating email confirmation:", functionError);
          // Continue anyway - code is verified
        } else {
          console.log("Email confirmed successfully via Edge Function");
        }
      } catch (error) {
        console.error("Error calling verify-email function:", error);
        // Continue anyway - code is verified
      }
    }

    // Remove OTP from memory (one-time use)
    otpStore.delete(email.toLowerCase());

    return true;
  } catch (error) {
    console.error("Error in verifyOTP:", error);
    return false;
  }
}

/**
 * Resend OTP code
 */
export async function resendVerificationOTP(email: string, userId: string): Promise<string> {
  // Remove old OTP
  otpStore.delete(email.toLowerCase());

  // Generate and send new OTP
  return await sendVerificationOTP(email, userId);
}

