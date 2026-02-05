-- Fix RLS for verification_codes table
-- Create SECURITY DEFINER functions to bypass RLS for reading codes

-- Function to get verification code (bypasses RLS)
CREATE OR REPLACE FUNCTION get_verification_code(
  p_email TEXT,
  p_code TEXT
)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  email TEXT,
  code TEXT,
  verified BOOLEAN,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    vc.id,
    vc.user_id,
    vc.email,
    vc.code,
    vc.verified,
    vc.expires_at,
    vc.created_at
  FROM public.verification_codes vc
  WHERE vc.email = p_email
    AND vc.code = p_code
    AND vc.verified = false
  ORDER BY vc.created_at DESC
  LIMIT 1;
END;
$$;

-- Function to mark verification code as verified (bypasses RLS)
CREATE OR REPLACE FUNCTION mark_code_verified(
  p_code_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.verification_codes
  SET verified = true
  WHERE id = p_code_id;
END;
$$;

-- Ensure the insert function exists (from previous migration)
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
  -- Check if code already exists for this email
  SELECT id INTO v_id 
  FROM public.verification_codes 
  WHERE email = p_email 
    AND code = p_code 
    AND verified = false
    AND expires_at > NOW()
  LIMIT 1;
  
  IF v_id IS NOT NULL THEN
    -- Code already exists, return existing ID
    RETURN v_id;
  END IF;
  
  -- Insert new code
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

