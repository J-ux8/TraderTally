-- ============================================
-- Create RPC function to allow authenticated users to delete their own account
-- Run this in Supabase SQL Editor
-- ============================================

CREATE OR REPLACE FUNCTION delete_user()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Delete the user from auth.users. The ON DELETE CASCADE constraints
  -- on public.profiles, categories, transactions, debts, etc., will 
  -- automatically clean up the user's data in the public schema.
  DELETE FROM auth.users WHERE id = auth.uid();
END;
$$;

-- Ensure the user must be authenticated to execute this function
GRANT EXECUTE ON FUNCTION public.delete_user() TO authenticated;
