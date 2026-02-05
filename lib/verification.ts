import { supabase } from "./supabase";

// Generate 6-digit OTP code
function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Send OTP code via email (using Supabase Edge Function or direct email)
export async function sendVerificationOTP(email: string, userId: string): Promise<string> {
  // Generate OTP
  const otpCode = generateOTP();
  const expiresAt = new Date();
  expiresAt.setMinutes(expiresAt.getMinutes() + 10); // Expires in 10 minutes

  // Store OTP in database
  // Use database function to bypass RLS (needed during registration when user might not have session)
  const { data: functionData, error: functionError } = await supabase.rpc("insert_verification_code", {
    p_user_id: userId,
    p_email: email,
    p_code: otpCode,
    p_expires_at: expiresAt.toISOString(),
  });

  if (functionError) {
    // Fallback to direct insert if function doesn't exist
    console.warn("Database function not found, trying direct insert:", functionError);
    
    const { data: insertData, error: insertError } = await supabase
      .from("verification_codes")
      .insert({
        user_id: userId,
        email: email,
        code: otpCode,
        expires_at: expiresAt.toISOString(),
        verified: false,
      })
      .select();

    if (insertError) {
      // Log the actual error for debugging
      console.error("Error inserting verification code:", {
        error: insertError,
        code: insertError.code,
        message: insertError.message,
        details: insertError.details,
        hint: insertError.hint,
        userId: userId,
      });
      
      // Provide more helpful error message
      if (insertError.code === "42501" || insertError.message?.includes("policy")) {
        throw new Error("Permission denied. Please run the SQL migration to create the insert_verification_code function.");
      } else if (insertError.code === "42P01") {
        throw new Error("verification_codes table does not exist. Please run the SQL migration.");
      } else {
        throw new Error(`Failed to generate verification code: ${insertError.message || insertError.code || "Unknown error"}`);
      }
    }
  }

  // Send email with OTP using Supabase Edge Function
  // Note: We still return the OTP even if email fails, so user can see it in UI
  try {
    // Call Edge Function to send OTP email
    const { data: functionData, error: functionError } = await supabase.functions.invoke('send-otp-email', {
      body: {
        email: email,
        otpCode: otpCode,
      },
    });

    // Log full response for debugging
    console.log("Edge Function response:", { data: functionData, error: functionError });

    // Check for error first
    if (functionError) {
      console.error("Edge Function error object:", functionError);
      // Log OTP for development/debugging
      console.log(`[DEV] OTP for ${email}: ${otpCode}`); // Remove in production!
      
      // Extract error message
      let errorMessage = "Unknown error";
      if (typeof functionError === 'string') {
        errorMessage = functionError;
      } else if (functionError?.message) {
        errorMessage = functionError.message;
      } else if (functionError?.error) {
        errorMessage = functionError.error;
      } else {
        errorMessage = JSON.stringify(functionError);
      }
      
      // Create a custom error that includes the OTP code
      const emailError: any = new Error(`Failed to send email: ${errorMessage}`);
      emailError.otpCode = otpCode; // Attach OTP to error so UI can display it
      
      // If it's a missing secret or configuration error, throw it with OTP
      if (errorMessage.includes("RESEND_API_KEY") || errorMessage.includes("not configured")) {
        emailError.message = "Email service is not configured. Please add RESEND_API_KEY secret in Supabase.";
        throw emailError;
      }
      
      // For other errors, still throw but with OTP attached
      throw emailError;
    }

    // Check if the response data contains an error
    if (functionData) {
      if (functionData.error) {
        console.error("Edge Function returned error in data:", functionData.error);
        console.log(`[DEV] OTP for ${email}: ${otpCode}`); // Remove in production!
        
        // Attach OTP to error
        const emailError: any = new Error(`Failed to send email: ${functionData.error}`);
        emailError.otpCode = otpCode;
        throw emailError;
      }
      
      if (!functionData.success && functionData.message) {
        // Some responses might not have success flag but have message
        console.log("Edge Function response:", functionData.message);
      }
    }

    // Success - email was sent
    console.log("OTP email sent successfully");
  } catch (error: any) {
    console.error("Error sending email:", error);
    // Log OTP for development/debugging
    console.log(`[DEV] OTP for ${email}: ${otpCode}`); // Remove in production!
    
    // Attach OTP to error if not already attached
    if (!error.otpCode) {
      error.otpCode = otpCode;
    }
    
    // Re-throw the error so the UI can show it and display the OTP
    throw error;
  }

  return otpCode;
}

// Verify OTP code
export async function verifyOTP(email: string, code: string, userId?: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("verification_codes")
    .select("*")
    .eq("email", email)
    .eq("code", code)
    .eq("verified", false)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (error || !data) {
    return false;
  }

  // Check if code is expired
  const expiresAt = new Date(data.expires_at);
  if (expiresAt < new Date()) {
    return false;
  }

  // Mark code as verified
  await supabase
    .from("verification_codes")
    .update({ verified: true })
    .eq("id", data.id);

  // Update user's email_confirmed_at using Edge Function (if available)
  if (userId) {
    try {
      const { error: functionError } = await supabase.functions.invoke('verify-email', {
        body: { userId },
      });
      
      if (functionError) {
        console.error("Error updating email confirmation:", functionError);
        // Continue anyway - code is verified
      }
    } catch (error) {
      console.error("Error calling verify-email function:", error);
      // Continue anyway - code is verified
    }
  }

  return true;
}

// Resend OTP
export async function resendVerificationOTP(email: string, userId: string): Promise<string> {
  // Invalidate old codes
  await supabase
    .from("verification_codes")
    .update({ verified: true }) // Mark as used
    .eq("email", email)
    .eq("verified", false);

  // Generate and send new OTP
  return await sendVerificationOTP(email, userId);
}

