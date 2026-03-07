-- TEMPORARY DEBUGGING SCRIPT: Completely remove the signup trigger
-- This will help us determine if the trigger is 100% causing the issue.

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();
