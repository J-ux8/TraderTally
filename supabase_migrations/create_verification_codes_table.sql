-- =====================================================
-- Create verification_codes table for OTP email verification
-- =====================================================
-- This table stores OTP codes for email verification
-- Run this in Supabase Dashboard > SQL Editor

-- Create the table
CREATE TABLE IF NOT EXISTS public.verification_codes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  email TEXT NOT NULL,
  code TEXT NOT NULL,
  verified BOOLEAN DEFAULT false NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_verification_codes_user_id 
ON public.verification_codes(user_id);

CREATE INDEX IF NOT EXISTS idx_verification_codes_email 
ON public.verification_codes(email);

CREATE INDEX IF NOT EXISTS idx_verification_codes_code 
ON public.verification_codes(code);

CREATE INDEX IF NOT EXISTS idx_verification_codes_expires 
ON public.verification_codes(expires_at);

-- Enable Row Level Security (RLS)
ALTER TABLE public.verification_codes ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Users can view own verification codes" ON public.verification_codes;
DROP POLICY IF EXISTS "Users can insert own verification codes" ON public.verification_codes;
DROP POLICY IF EXISTS "Users can update own verification codes" ON public.verification_codes;

-- Create policy: Users can view their own verification codes
CREATE POLICY "Users can view own verification codes"
ON public.verification_codes
FOR SELECT
USING (auth.uid() = user_id);

-- Create policy: Users can insert their own verification codes
CREATE POLICY "Users can insert own verification codes"
ON public.verification_codes
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Create policy: Users can update their own verification codes
CREATE POLICY "Users can update own verification codes"
ON public.verification_codes
FOR UPDATE
USING (auth.uid() = user_id);

-- Function to insert verification code (bypasses RLS for registration)
CREATE OR REPLACE FUNCTION insert_verification_code(
  p_user_id UUID,
  p_email TEXT,
  p_code TEXT,
  p_expires_at TIMESTAMPTZ
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO public.verification_codes (
    user_id,
    email,
    code,
    expires_at,
    verified
  ) VALUES (
    p_user_id,
    p_email,
    p_code,
    p_expires_at,
    false
  )
  RETURNING id INTO v_id;
  
  RETURN v_id;
END;
$$;

-- Function to clean up expired codes (optional - runs periodically)
CREATE OR REPLACE FUNCTION cleanup_expired_codes()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  DELETE FROM public.verification_codes
  WHERE expires_at < NOW() - INTERVAL '1 day';
END;
$$;

-- =====================================================
-- Done! The verification_codes table is now ready.
-- =====================================================
