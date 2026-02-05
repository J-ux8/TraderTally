// Supabase Edge Function: Send OTP Email
// Deploy this in Supabase Dashboard > Edge Functions
// Function name: send-otp-email

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// CORS headers for allowing requests from the app
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    
    if (!RESEND_API_KEY) {
      return new Response(
        JSON.stringify({ error: "RESEND_API_KEY secret is not configured" }),
        { 
          status: 500, 
          headers: { 
            "Content-Type": "application/json",
            ...corsHeaders
          } 
        }
      );
    }

    const { email, otpCode, userName } = await req.json();

    if (!email || !otpCode) {
      return new Response(
        JSON.stringify({ error: "Email and OTP code are required" }),
        { 
          status: 400, 
          headers: { 
            "Content-Type": "application/json",
            ...corsHeaders
          } 
        }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return new Response(
        JSON.stringify({ error: "Invalid email format" }),
        { 
          status: 400, 
          headers: { 
            "Content-Type": "application/json",
            ...corsHeaders
          } 
        }
      );
    }

    // Send email using Resend API
    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "onboarding@resend.dev", // Resend test domain (for testing) - Update with your verified domain for production
        to: email,
        subject: "Verify Your Email - MobiBooks",
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 40px; text-align: center; border-radius: 12px 12px 0 0;">
              <h1 style="color: #ffffff; margin: 0; font-size: 28px;">MobiBooks</h1>
              <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0 0;">Email Verification</p>
            </div>
            <div style="background: #ffffff; padding: 40px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
              <h2 style="color: #333; margin-top: 0;">Hello${userName ? ` ${userName}` : ''}!</h2>
              <p style="color: #666; font-size: 16px;">Thank you for creating an account with MobiBooks. Please enter the verification code below in the app to verify your email address:</p>
              <div style="background: #f0fdf4; border: 2px solid #10b981; border-radius: 12px; padding: 24px; text-align: center; margin: 32px 0;">
                <p style="color: #666; margin: 0 0 8px 0; font-size: 14px; text-transform: uppercase; letter-spacing: 1px;">Your Verification Code</p>
                <p style="color: #10b981; font-size: 36px; font-weight: 700; letter-spacing: 8px; margin: 0; font-family: 'Courier New', monospace;">${otpCode}</p>
              </div>
              <p style="color: #666; font-size: 14px; margin-top: 24px;">This code will expire in 10 minutes.</p>
              <p style="color: #999; font-size: 12px; margin-top: 32px; padding-top: 24px; border-top: 1px solid #e5e7eb;">If you didn't create an account with MobiBooks, please ignore this email.</p>
            </div>
          </body>
          </html>
        `,
        text: `
          MobiBooks - Email Verification
          
          Hello${userName ? ` ${userName}` : ''}!
          
          Thank you for creating an account with MobiBooks. Please enter the verification code below in the app to verify your email address:
          
          Your Verification Code: ${otpCode}
          
          This code will expire in 10 minutes.
          
          If you didn't create an account with MobiBooks, please ignore this email.
        `,
      }),
    });

    if (!emailResponse.ok) {
      const errorText = await emailResponse.text();
      let errorMessage = `Failed to send email: ${errorText}`;
      
      // Try to parse error if it's JSON
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.message || errorText;
      } catch {
        // Not JSON, use as-is
      }
      
      console.error("Resend API error:", errorMessage);
      return new Response(
        JSON.stringify({ error: errorMessage }),
        { 
          status: emailResponse.status, 
          headers: { 
            "Content-Type": "application/json",
            ...corsHeaders
          } 
        }
      );
    }

    const responseData = await emailResponse.json();

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "OTP email sent successfully",
        id: responseData.id 
      }),
      { 
        status: 200, 
        headers: { 
          "Content-Type": "application/json",
          ...corsHeaders
        } 
      }
    );
  } catch (error: any) {
    console.error("Edge Function error:", error);
    return new Response(
      JSON.stringify({ 
        error: error.message || "Internal server error",
        details: error.stack 
      }),
      { 
        status: 500, 
        headers: { 
          "Content-Type": "application/json",
          ...corsHeaders
        } 
      }
    );
  }
});

