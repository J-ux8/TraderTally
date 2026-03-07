# Supabase Setup - Quick Fix for Sync Errors

## Error You're Seeing
```
Could not find the 'is_deleted' column of 'categories' in the schema cache
```

## What This Means
Your Supabase (cloud) database is missing the `is_deleted` column that your local app uses.

## Quick Fix (5 minutes)

### Step 1: Open Supabase Dashboard
1. Go to https://supabase.com/dashboard
2. Log in to your account
3. Select your MobiBooks project

### Step 2: Run the Migration
1. Click **"SQL Editor"** in the left sidebar
2. Click **"New Query"**
3. Copy this SQL:

```sql
-- Add is_deleted column to all tables
ALTER TABLE categories ADD COLUMN IF NOT EXISTS is_deleted INTEGER DEFAULT 0;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS is_deleted INTEGER DEFAULT 0;
ALTER TABLE debts ADD COLUMN IF NOT EXISTS is_deleted INTEGER DEFAULT 0;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_categories_not_deleted ON categories(user_id) WHERE is_deleted = 0;
CREATE INDEX IF NOT EXISTS idx_transactions_not_deleted ON transactions(user_id) WHERE is_deleted = 0;
CREATE INDEX IF NOT EXISTS idx_debts_not_deleted ON debts(user_id) WHERE is_deleted = 0;
```

4. Click **"Run"** (or press Ctrl+Enter)
5. You should see "Success. No rows returned"

### Step 3: Verify
Run this query to verify:
```sql
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name IN ('categories', 'transactions', 'debts') 
  AND column_name = 'is_deleted';
```

You should see 3 rows (one for each table).

### Step 4: Restart Your App
1. Close the app completely
2. Reopen it
3. Sync should now work!

## Alternative: Use Offline Mode Only

If you don't want to set up Supabase right now:
- Your app works perfectly offline
- All data is saved locally
- Just ignore the sync errors
- You can set up Supabase later when you want cloud backup

## Other Migrations You Might Need

If you see other column errors, you may need to run these migrations too:

### Add sync_version columns:
```sql
ALTER TABLE categories ADD COLUMN IF NOT EXISTS sync_version INTEGER DEFAULT 1;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS sync_version INTEGER DEFAULT 1;
ALTER TABLE debts ADD COLUMN IF NOT EXISTS sync_version INTEGER DEFAULT 1;
```

### Add retry_count columns:
```sql
ALTER TABLE categories ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0;
ALTER TABLE debts ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0;
```

## Need Help?

Check these files for more details:
- `SETUP_INSTRUCTIONS.md` - Full setup guide
- `supabase_migrations/` folder - All migration files
- `COMPREHENSIVE_APP_ANALYSIS.md` - App status

## Remember

✅ Your app works perfectly without Supabase (offline mode)  
✅ Migrations are only needed if you want cloud sync  
✅ Your local data is always safe  
✅ You can run migrations anytime  
