// Supabase Edge Function: Auth Hook for Custom Email Delivery via Resend
// Deploy this in Supabase Dashboard > Edge Functions
// Function name: send-otp-email
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY is not configured");
    }

    // This hook is called by Supabase Auth with a specific payload
    const body = await req.json();
    console.log("Auth Hook Payload Received:", JSON.stringify(body, null, 2));

    const { user, email_data } = body;
    const { token, email_action_type } = email_data;

    if (!token || !user?.email) {
      throw new Error("Token or Email missing from Hook payload");
    }

    // Determine the subject based on the action type
    let subject = "Verify Your Email - MobiBooks";
    if (email_action_type === 'recovery') subject = "Reset Your Password - MobiBooks";
    if (email_action_type === 'email_change') subject = "Confirm Email Change - MobiBooks";

    const userName = user.user_metadata?.full_name || "MobiBooks User";

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "MobiBooks <onboarding@resend.dev>", // Replace with your verified domain in production
        to: user.email,
        subject: subject,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              .container { font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #333; }
              .header { background: #1e3a8a; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
              .content { padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px; }
              .otp-box { background: #f0fdf4; border: 2px solid #10b981; border-radius: 12px; padding: 20px; text-align: center; margin: 25px 0; }
              .otp-code { font-size: 32px; font-weight: bold; color: #10b981; letter-spacing: 5px; margin: 0; }
              .footer { font-size: 12px; color: #999; margin-top: 20px; text-align: center; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1 style="color: white; margin: 0;">MobiBooks</h1>
              </div>
              <div class="content">
                <h2>Hello ${userName},</h2>
                <p>Welcome to MobiBooks! Please use the following verification code to complete your ${email_action_type.replace('_', ' ')}:</p>
                <div class="otp-box">
                  <p class="otp-code">${token}</p>
                </div>
                <p>This code is valid for 10 minutes. If you didn't request this, please ignore this email.</p>
                <div class="footer">
                  © 2026 MobiBooks. All rights reserved.
                </div>
              </div>
            </div>
          </body>
          </html>
        `
      }),
    });

    if (!emailResponse.ok) {
      const error = await emailResponse.text();
      console.error("Resend Error:", error);
      throw new Error(`Resend API failed: ${error}`);
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json", ...corsHeaders },
      status: 200,
    });

  } catch (error: any) {
    console.error("Hook Error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { "Content-Type": "application/json", ...corsHeaders },
      status: 400,
    });
  }
});


