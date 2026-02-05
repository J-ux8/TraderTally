-- Fix RLS Policy for Profiles Table
-- This allows users to create their own profile even if RLS is enabled

-- Create function to insert profile (bypasses RLS)
CREATE OR REPLACE FUNCTION insert_user_profile(
  p_user_id UUID,
  p_email TEXT,
  p_full_name TEXT DEFAULT '',
  p_phone_number TEXT DEFAULT '',
  p_business_type TEXT DEFAULT 'Other'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  -- Check if profile already exists
  SELECT id INTO v_id FROM public.profiles WHERE id = p_user_id;
  
  IF v_id IS NOT NULL THEN
    -- Profile exists, return existing ID
    RETURN v_id;
  END IF;
  
  -- Insert new profile
  INSERT INTO public.profiles (
    id,
    email,
    full_name,
    phone_number,
    business_type
  ) VALUES (
    p_user_id,
    p_email,
    COALESCE(p_full_name, ''),
    COALESCE(p_phone_number, ''),
    COALESCE(p_business_type, 'Other')
  )
  RETURNING id INTO v_id;
  
  RETURN v_id;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION insert_user_profile TO authenticated;
GRANT EXECUTE ON FUNCTION insert_user_profile TO anon;

-- Ensure RLS policies allow users to insert their own profile
-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

-- Create RLS policies
CREATE POLICY "Users can view own profile"
ON public.profiles FOR SELECT
USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
ON public.profiles FOR INSERT
WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
ON public.profiles FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

