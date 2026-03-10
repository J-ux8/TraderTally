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
 * Verify OTP code using Supabase's built-in verification with retry logic
 */
export async function verifyOTP(email: string, token: string, type: 'signup' | 'email' | 'recovery' | 'invite' = 'signup'): Promise<boolean> {
  const maxRetries = 3;
  let lastError: any = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email: email,
        token: token,
        type: type,
      });

      if (error) {
        console.error(`Attempt ${attempt + 1}: Error verifying OTP:`, error);
        lastError = error;
        
        // If it's an invalid/expired code error, don't retry
        const errorMsg = error.message || "";
        if (errorMsg.includes("invalid") || errorMsg.includes("expired")) {
          throw error;
        }
        
        // For other errors, wait before retrying
        if (attempt < maxRetries - 1) {
          const waitTime = Math.pow(2, attempt) * 500; // 500ms, 1s, 2s
          await new Promise(resolve => setTimeout(resolve, waitTime));
          continue;
        }
      }

      if (data?.session || data?.user) {
        console.log("OTP verification successful");
        return true;
      }

      // If we get here without session/user, it might be a transient issue
      if (attempt < maxRetries - 1) {
        const waitTime = Math.pow(2, attempt) * 500;
        await new Promise(resolve => setTimeout(resolve, waitTime));
        continue;
      }

      throw new Error("Verification succeeded but no session established");
    } catch (error) {
      lastError = error;
      
      // Don't retry on invalid/expired errors
      const errorMsg = (error as any)?.message || "";
      if (errorMsg.includes("invalid") || errorMsg.includes("expired")) {
        throw error;
      }

      if (attempt < maxRetries - 1) {
        const waitTime = Math.pow(2, attempt) * 500;
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
  }

  console.error("OTP verification failed after retries:", lastError);
  throw lastError || new Error("Failed to verify OTP after multiple attempts");
}

