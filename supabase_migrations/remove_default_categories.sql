-- ============================================================================
-- REMOVE DEFAULT CATEGORIES AND UPDATE SIGNUP TRIGGER
-- ============================================================================
-- 
-- This migration removes the default "Sales" and "Services" categories
-- and updates the signup trigger to not create any default categories.
-- Users will create their own custom categories as needed.
-- ============================================================================

-- STEP 1: Update the signup trigger to not create default categories
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger 
LANGUAGE plpgsql
SECURITY DEFINER 
SET search_path = public
AS $$
BEGIN
  -- We wrap the entire operational logic in a BEGIN...EXCEPTION block.
  -- This ensures that NO error (RLS, Unique, Null) can ever block a user from signing up.
  BEGIN
    -- Insert Profile
    INSERT INTO public.profiles (id, email, full_name, phone_number, business_type)
    VALUES (
      NEW.id, 
      NEW.email, 
      COALESCE(NEW.raw_user_meta_data->>'full_name', ''), 
      COALESCE(NEW.raw_user_meta_data->>'phone_number', ''), 
      COALESCE(NEW.raw_user_meta_data->>'business_type', 'Other')
    )
    ON CONFLICT (id) DO UPDATE SET
      email = EXCLUDED.email;
    
    -- No default categories - users will create their own
    
  EXCEPTION WHEN OTHERS THEN
    -- Log errors to Postgres Logs (visible in Supabase Dashboard)
    -- But DO NOT stop the signup process.
    RAISE WARNING 'Signup background task had an error: %', SQLERRM;
  END;

  -- MANDATORY: Always return NEW. This allows the signup to finish.
  RETURN NEW;
END;
$$;

-- STEP 2: Optionally delete existing default categories (commented out for safety)
-- Uncomment the following lines if you want to remove existing default categories
-- from all users. This is optional and should be done carefully.

-- DELETE FROM public.categories 
-- WHERE normalized_name IN ('sales', 'services')
-- AND is_deleted = 0;

-- STEP 3: Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';

-- ============================================================================
-- NOTES:
-- - New users will start with no categories and create their own
-- - Existing users keep their current categories (including defaults if they have them)
-- - To remove defaults from existing users, uncomment STEP 2
-- ============================================================================
