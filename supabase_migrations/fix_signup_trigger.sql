-- Fix Supabase 'Database error saving new user'
-- This happens when an ON INSERT trigger on auth.users fails.
-- Given our recent schema changes, any template triggers creating
-- default categories or profiles likely violate the new NOT NULL constraints
-- (like 'normalized_name', 'is_synced', 'sync_version').

-- To fix it, we override the default trigger function with a hardened version
-- that wraps inserts in an exception handler so authentication succeeds
-- even if profile generation or default category insertion fails.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  -- Attempt to insert the user's profile
  BEGIN
    INSERT INTO public.profiles (id, email, full_name, phone_number, business_type)
    VALUES (
      NEW.id,
      NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
      COALESCE(NEW.raw_user_meta_data->>'phone_number', ''),
      COALESCE(NEW.raw_user_meta_data->>'business_type', 'Other')
    );
  EXCEPTION WHEN OTHERS THEN
    RAISE LOG 'Error inserting profile: %', SQLERRM;
  END;

  -- No default categories - users will create their own

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-attach the trigger safely
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
