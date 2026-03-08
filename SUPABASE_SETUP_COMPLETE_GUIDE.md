# Complete Supabase Setup Guide

## Current Status: ❌ Cloud Backup NOT Active

Your app is working perfectly **offline**, but data is NOT backing up to Supabase cloud yet.

### Why?
You haven't run the required SQL migrations in your Supabase database.

### What's Happening Now:
- ✅ Data saves locally (instant, always works)
- ❌ Sync to Supabase fails (missing columns/policies)
- ✅ App shows sync errors in logs
- ✅ App continues working offline

---

## Quick Setup (15 minutes)

### Step 1: Open Supabase Dashboard
1. Go to https://supabase.com/dashboard
2. Log in to your account
3. Select your MobiBooks project

### Step 2: Open SQL Editor
1. Click **"SQL Editor"** in the left sidebar
2. Click **"New Query"**

### Step 3: Run Migration #1 - Add Columns
Copy and paste this SQL, then click **Run**:

```sql
-- Add is_deleted column to all tables
ALTER TABLE categories ADD COLUMN IF NOT EXISTS is_deleted INTEGER DEFAULT 0;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS is_deleted INTEGER DEFAULT 0;
ALTER TABLE debts ADD COLUMN IF NOT EXISTS is_deleted INTEGER DEFAULT 0;

-- Add sync_version column to all tables
ALTER TABLE categories ADD COLUMN IF NOT EXISTS sync_version INTEGER DEFAULT 1;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS sync_version INTEGER DEFAULT 1;
ALTER TABLE debts ADD COLUMN IF NOT EXISTS sync_version INTEGER DEFAULT 1;

-- Add retry_count column to all tables
ALTER TABLE categories ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0;
ALTER TABLE debts ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0;

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_categories_not_deleted ON categories(user_id) WHERE is_deleted = 0;
CREATE INDEX IF NOT EXISTS idx_transactions_not_deleted ON transactions(user_id) WHERE is_deleted = 0;
CREATE INDEX IF NOT EXISTS idx_debts_not_deleted ON debts(user_id) WHERE is_deleted = 0;

-- Verify columns were added
SELECT 
    table_name, 
    column_name, 
    data_type, 
    column_default 
FROM information_schema.columns 
WHERE table_name IN ('categories', 'transactions', 'debts') 
  AND column_name IN ('is_deleted', 'sync_version', 'retry_count')
ORDER BY table_name, column_name;
```

**Expected Result**: Should see 9 rows (3 columns × 3 tables)

### Step 4: Run Migration #2 - Fix RLS Policies
Copy and paste this SQL, then click **Run**:

```sql
-- Enable RLS on all tables
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE debts ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Users can view own categories" ON categories;
DROP POLICY IF EXISTS "Users can insert own categories" ON categories;
DROP POLICY IF EXISTS "Users can update own categories" ON categories;
DROP POLICY IF EXISTS "Users can delete own categories" ON categories;

DROP POLICY IF EXISTS "Users can view own transactions" ON transactions;
DROP POLICY IF EXISTS "Users can insert own transactions" ON transactions;
DROP POLICY IF EXISTS "Users can update own transactions" ON transactions;
DROP POLICY IF EXISTS "Users can delete own transactions" ON transactions;

DROP POLICY IF EXISTS "Users can view own debts" ON debts;
DROP POLICY IF EXISTS "Users can insert own debts" ON debts;
DROP POLICY IF EXISTS "Users can update own debts" ON debts;
DROP POLICY IF EXISTS "Users can delete own debts" ON debts;

-- Categories policies
CREATE POLICY "Users can view own categories" ON categories
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own categories" ON categories
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own categories" ON categories
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own categories" ON categories
    FOR DELETE USING (auth.uid() = user_id);

-- Transactions policies
CREATE POLICY "Users can view own transactions" ON transactions
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own transactions" ON transactions
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own transactions" ON transactions
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own transactions" ON transactions
    FOR DELETE USING (auth.uid() = user_id);

-- Debts policies
CREATE POLICY "Users can view own debts" ON debts
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own debts" ON debts
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own debts" ON debts
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own debts" ON debts
    FOR DELETE USING (auth.uid() = user_id);

-- Verify policies were created
SELECT schemaname, tablename, policyname 
FROM pg_policies 
WHERE tablename IN ('categories', 'transactions', 'debts')
ORDER BY tablename, policyname;
```

**Expected Result**: Should see 12 policies (4 policies × 3 tables)

### Step 5: Restart Your App
1. Close the app completely
2. Reopen it
3. Record a transaction
4. Watch for the sync toast!

---

## How to Verify It's Working

### Method 1: Check the Toast
- Record a transaction
- Wait 10-20 seconds
- You should see: **"✓ 1 item synced to cloud"**

### Method 2: Check Supabase Dashboard
1. Go to Supabase Dashboard
2. Click **"Table Editor"**
3. Select **"transactions"** table
4. You should see your data!

### Method 3: Check the Indicator
- Look at top right of screen
- Should show green **"Synced"** badge
- Not orange "Pending" or red "Offline"

### Method 4: Check Logs
- Look at app console
- Should NOT see RLS errors
- Should see: `[SyncEngine] Sync completed successfully`

---

## Troubleshooting

### Still Seeing RLS Errors?
**Problem**: `new row violates row-level security policy`

**Solution**: 
1. Make sure you ran Migration #2 (RLS policies)
2. Make sure you're logged in to the app
3. Try logging out and back in

### Still Seeing Column Errors?
**Problem**: `Could not find the 'is_deleted' column`

**Solution**:
1. Make sure you ran Migration #1 (Add columns)
2. Check the verification query showed 9 rows
3. Try running the migration again

### Sync Still Not Working?
**Check these**:
1. ✅ Are you online? (Check WiFi/data)
2. ✅ Are you logged in? (Check if you see user email)
3. ✅ Did migrations run successfully?
4. ✅ Is Supabase project active? (Check dashboard)

---

## What Happens After Setup

### Automatic Cloud Backup
- ✅ Every transaction syncs to cloud
- ✅ Background sync every 2 minutes
- ✅ Sync on app focus
- ✅ Toast notification on sync

### Multi-Device Support
- ✅ Access data from any device
- ✅ Data syncs across devices
- ✅ Conflict resolution built-in

### Data Safety
- ✅ Cloud backup of all data
- ✅ Can recover if phone lost
- ✅ Can export data anytime

---

## Alternative: Use Offline Mode Only

Don't want to set up Supabase right now? **That's fine!**

Your app works perfectly without it:
- ✅ All features work offline
- ✅ Data saved locally
- ✅ Fast and responsive
- ✅ No sync errors (just ignore them)

You can set up Supabase later when you want cloud backup.

---

## Migration Files Location

All SQL migrations are in: `supabase_migrations/`

Key files:
- `add_is_deleted_column.sql` - Adds missing columns
- `fix_all_rls_policies.sql` - Sets up security policies
- `add_sync_version_columns.sql` - Adds sync tracking

---

## Need Help?

### Common Issues

**Q: I see "Syncing" but no toast appears**
A: Sync might be failing. Check logs for errors.

**Q: Toast says "0 items synced"**
A: No pending items to sync. Record a transaction first.

**Q: Indicator stuck on "Pending"**
A: Sync is failing. Run the migrations.

**Q: Can I use the app without Supabase?**
A: Yes! App works perfectly offline.

---

## Summary

### To Enable Cloud Backup:
1. Run Migration #1 (Add columns) ← 5 minutes
2. Run Migration #2 (RLS policies) ← 5 minutes
3. Restart app ← 1 minute
4. Test by recording transaction ← 1 minute

### Total Time: ~15 minutes

### Result:
- ✅ Data backs up to cloud automatically
- ✅ Access from any device
- ✅ Never lose data
- ✅ Professional cloud-backed app

---

## Ready to Set Up?

Follow the steps above, and your data will start backing up to Supabase cloud!

If you prefer to stay offline-only for now, that's perfectly fine too. Your app works great either way! 🎉
