import { supabase } from "./supabase";

// Use Supabase's built-in OTP system instead of custom implementation
// This is more reliable and doesn't require Edge Functions

/**
 * Send OTP code using Supabase's built-in OTP system
 * This automatically sends a 6-digit code to the user's email
 */
export async function sendVerificationOTP(email: string): Promise<{ waitTime?: number }> {
  const { data, error } = await supabase.auth.signInWithOtp({
    email: email,
    options: {
      shouldCreateUser: false, // Don't create user if they don't exist
    },
  });

  if (error) {
    console.error("Error sending OTP:", error);
    
    // Check if it's a rate limit error
    const errorMessage = error.message || "";
    const rateLimitMatch = errorMessage.match(/(\d+)\s*seconds?/i);
    
    if (rateLimitMatch) {
      const waitTime = parseInt(rateLimitMatch[1], 10);
      const customError: any = new Error(`Please wait ${waitTime} seconds before requesting a new code.`);
      customError.waitTime = waitTime;
      customError.isRateLimit = true;
      throw customError;
    }
    
    throw new Error(`Failed to send verification code: ${error.message}`);
  }

  // Success - Supabase will send the OTP email automatically
  console.log("OTP sent successfully via Supabase");
  return {};
}

/**
 * Verify OTP code using Supabase's built-in verification
 */
export async function verifyOTP(email: string, token: string): Promise<boolean> {
  try {
    const { data, error } = await supabase.auth.verifyOtp({
      email: email,
      token: token,
      type: 'email',
    });

    if (error) {
      console.error("Error verifying OTP:", error);
      return false;
    }

    if (data?.user) {
      // OTP verified successfully
      return true;
    }

    return false;
  } catch (error) {
    console.error("Error in verifyOTP:", error);
    return false;
  }
}

/**
 * Resend OTP code
 */
export async function resendVerificationOTP(email: string): Promise<{ waitTime?: number }> {
  return await sendVerificationOTP(email);
}

