# Diagnostic Steps - Categories Not Showing

## Issue
- Records screen glitching with loading state
- Categories you saved are not showing up

## Root Cause Analysis

The problem is likely one of these:

### 1. Categories Not in Supabase Database
**Check**: Do you have categories in your Supabase `categories` table?

**How to check**:
1. Go to Supabase Dashboard
2. Navigate to Table Editor
3. Open `categories` table
4. Check if your categories are there with your `user_id`

**If empty**: Categories were never uploaded to Supabase (sync failed)

### 2. Sync Not Completing During Login
**Check**: Is sync actually running and completing?

**How to check**:
Look at your console logs after login. You should see:
```
[Auth] Starting initial sync after login (blocking)...
[SyncEngine] Starting sync for user: <your-user-id>
[SyncEngine] Starting upload phase
[SyncEngine] Starting download phase
[SyncEngine] Sync completed: { uploaded: X, downloaded: Y, ... }
[Auth] Downloaded Y items from server
```

**If you see errors**: Sync is failing (network, RLS policies, etc.)

### 3. RLS Policies Not Set Up
**Check**: Are your Supabase RLS policies configured?

**How to check**:
1. Go to Supabase Dashboard
2. Navigate to Authentication > Policies
3. Check if you have policies for `categories`, `transactions`, `debts` tables

**Required policies**:
- SELECT: Users can read their own data
- INSERT: Users can insert their own data
- UPDATE: Users can update their own data
- DELETE: Users can delete their own data

**Example policy for categories**:
```sql
-- SELECT policy
CREATE POLICY "Users can view their own categories"
ON categories FOR SELECT
USING (auth.uid() = user_id);

-- INSERT policy
CREATE POLICY "Users can insert their own categories"
ON categories FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- UPDATE policy
CREATE POLICY "Users can update their own categories"
ON categories FOR UPDATE
USING (auth.uid() = user_id);

-- DELETE policy
CREATE POLICY "Users can delete their own categories"
ON categories FOR DELETE
USING (auth.uid() = user_id);
```

### 4. Local Database Not Persisting
**Check**: Is the local SQLite database being wiped on app restart?

**How to check**:
1. Create a category
2. Close the app completely
3. Reopen the app
4. Check if category is still there

**If gone**: Database is being wiped (shouldn't happen unless you logout)

## Quick Fix Steps

### Step 1: Check Console Logs
Open your app and check the console for these logs:
- `[Auth] Starting initial sync after login (blocking)...`
- `[SyncEngine] Sync completed: ...`
- `[Categories] Loaded X categories`

**Share these logs with me** so I can see what's happening.

### Step 2: Check Supabase Database
1. Go to Supabase Dashboard
2. Check `categories` table
3. Do you see your categories there?
4. Check the `user_id` column - does it match your user ID?

### Step 3: Check RLS Policies
1. Go to Supabase Dashboard
2. Check if RLS is enabled on `categories` table
3. Check if you have SELECT, INSERT, UPDATE, DELETE policies

### Step 4: Test Category Creation
1. Create a new category in the app
2. Check console logs for:
   - `[Categories] Loaded X categories`
   - `[SyncEngine] Starting sync...`
   - `[SyncEngine] Sync completed: { uploaded: 1, ... }`
3. Check Supabase database - is the category there?

## Most Likely Issues

### Issue A: RLS Policies Missing (90% probability)
**Symptom**: Categories save locally but don't sync to Supabase
**Console logs**: You'll see RLS policy errors
**Fix**: Set up RLS policies in Supabase (see above)

### Issue B: Network Issues (5% probability)
**Symptom**: Sync fails with network errors
**Console logs**: You'll see network timeout errors
**Fix**: Check internet connection

### Issue C: Categories in Wrong User Account (5% probability)
**Symptom**: Categories exist in Supabase but for different user_id
**Console logs**: Sync completes but downloads 0 items
**Fix**: Check user_id in Supabase matches your current user

## What I Need From You

To help you fix this, please provide:

1. **Console logs** from app startup and login
2. **Screenshot** of your Supabase `categories` table
3. **Screenshot** of your RLS policies for `categories` table
4. **Your user ID** (from console logs or Supabase auth.users table)

With this information, I can tell you exactly what's wrong and how to fix it.

## Temporary Workaround

If you need the app to work NOW while we debug:

1. **Use local-only mode**: Categories will work locally even if sync fails
2. **Check offline indicator**: If it shows "offline" or "pending", sync hasn't completed
3. **Pull to refresh**: Try pulling down on records screen to force a refresh

## Next Steps

1. Check your console logs
2. Check your Supabase database
3. Share the information above with me
4. I'll provide the exact fix based on what you find
