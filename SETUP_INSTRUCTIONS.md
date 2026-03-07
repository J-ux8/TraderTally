# MobiBooks - Setup Instructions

## ⚠️ CRITICAL: Run These Migrations First

Before using the app, you MUST run these SQL migrations in your Supabase dashboard to fix RLS (Row Level Security) policies:

### Step 1: Fix RLS Policies (REQUIRED)

Go to your Supabase Dashboard → SQL Editor and run this migration:

**File: `supabase_migrations/fix_all_rls_policies.sql`**

This fixes the error: `new row violates row-level security policy for table "transactions"`

### Step 2: Add Sync Columns (if not already done)

**File: `supabase_migrations/add_sync_version_columns.sql`**

This adds the sync_version columns needed for offline sync.

### Step 3: Remove Default Categories (optional)

**File: `supabase_migrations/remove_default_categories.sql`**

This removes default category creation on signup (users create their own).

## ✅ App Features (All Working)

### Offline Mode (Bulletproof)
- ✅ Record sales offline
- ✅ Record expenses offline
- ✅ Add debts offline
- ✅ View all data offline
- ✅ Automatic sync when back online
- ✅ No network errors
- ✅ No login redirects

### Performance (Instant Loading)
- ✅ All screens load instantly
- ✅ Profile cached for offline access
- ✅ Session cached for offline auth
- ✅ No blocking loading screens
- ✅ Background data loading

### Features
- ✅ Sales tracking
- ✅ Expense tracking
- ✅ Debt/Credit book
- ✅ Custom categories
- ✅ Reports & analytics
- ✅ Profile management
- ✅ Dark/Light theme
- ✅ Automatic sync

## 🚀 How to Test

1. **Run the migrations** (see above)
2. **Start the app**: `npx expo start`
3. **Test offline mode**:
   - Turn off WiFi/data
   - Record transactions
   - Navigate between screens
   - Everything works instantly
4. **Test sync**:
   - Turn WiFi back on
   - Data syncs automatically
   - Check Supabase dashboard to verify

## 📝 Common Issues

### Issue: "new row violates row-level security policy"
**Solution**: Run `fix_all_rls_policies.sql` in Supabase SQL Editor

### Issue: "Could not find the 'sync_version' column"
**Solution**: Run `add_sync_version_columns.sql` in Supabase SQL Editor

### Issue: Screens loading slowly
**Solution**: Already fixed! Screens now load instantly with caching

### Issue: Redirects to login when offline
**Solution**: Already fixed! Cached sessions prevent this

## 🎯 Production Ready

The app is now production-ready with:
- Bulletproof offline mode
- Instant loading
- Proper RLS policies
- Comprehensive error handling
- Automatic sync
- Profile caching
- Session caching

Just run the migrations and you're good to go!
