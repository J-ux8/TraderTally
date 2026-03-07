import { supabase } from "./supabase";

// Use Supabase's built-in OTP system instead of custom implementation
// This is more reliable and doesn't require Edge Functions

/**
 * Resend OTP code using Supabase's built-in resend mechanism
 */
export async function resendVerificationOTP(email: string, type: 'signup' | 'email_change' = 'signup'): Promise<void> {
  const { error } = await supabase.auth.resend({
    type: type,
    email: email,
    options: {
      emailRedirectTo: undefined,
    }
  });

  if (error) {
    console.error("Error resending OTP:", error);

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

    throw error;
  }
}

/**
 * Verify OTP code using Supabase's built-in verification
 */
export async function verifyOTP(email: string, token: string, type: 'signup' | 'email' | 'recovery' | 'invite' = 'signup'): Promise<boolean> {
  try {
    const { data, error } = await supabase.auth.verifyOtp({
      email: email,
      token: token,
      type: type,
    });

    if (error) {
      console.error("Error verifying OTP:", error);
      throw error;
    }

    return !!(data?.session || data?.user);
  } catch (error) {
    console.error("Error in verifyOTP:", error);
    throw error;
  }
}

