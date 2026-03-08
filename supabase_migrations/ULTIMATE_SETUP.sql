-- ============================================
-- ULTIMATE MOBIBOOKS SUPABASE SETUP
-- This single script handles EVERYTHING
-- Run this ONCE in Supabase SQL Editor
-- ============================================

-- Step 1: Create profiles table (if needed)
-- ============================================
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    business_name TEXT,
    phone TEXT,
    address TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Step 2: Create main tables with ALL columns
-- ============================================

-- Categories table
CREATE TABLE IF NOT EXISTS categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    normalized_name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    is_deleted INTEGER DEFAULT 0,
    sync_status TEXT DEFAULT 'synced',
    sync_version INTEGER DEFAULT 1,
    retry_count INTEGER DEFAULT 0
);

-- Transactions table
CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    amount DECIMAL(10, 2) NOT NULL,
    category TEXT,
    description TEXT,
    transaction_date DATE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    is_deleted INTEGER DEFAULT 0,
    sync_status TEXT DEFAULT 'synced',
    sync_version INTEGER DEFAULT 1,
    retry_count INTEGER DEFAULT 0
);

-- Debts table
CREATE TABLE IF NOT EXISTS debts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    customer_name TEXT NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    due_date DATE,
    note TEXT,
    is_settled INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    is_deleted INTEGER DEFAULT 0,
    sync_status TEXT DEFAULT 'synced',
    sync_version INTEGER DEFAULT 1,
    retry_count INTEGER DEFAULT 0
);

-- Step 3: Add missing columns (for existing tables)
-- ============================================

-- Profiles columns
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='business_name') THEN
        ALTER TABLE profiles ADD COLUMN business_name TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='phone') THEN
        ALTER TABLE profiles ADD COLUMN phone TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='profiles' AND column_name='address') THEN
        ALTER TABLE profiles ADD COLUMN address TEXT;
    END IF;
END $$;

-- Categories columns
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='categories' AND column_name='is_deleted') THEN
        ALTER TABLE categories ADD COLUMN is_deleted INTEGER DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='categories' AND column_name='sync_status') THEN
        ALTER TABLE categories ADD COLUMN sync_status TEXT DEFAULT 'synced';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='categories' AND column_name='sync_version') THEN
        ALTER TABLE categories ADD COLUMN sync_version INTEGER DEFAULT 1;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='categories' AND column_name='retry_count') THEN
        ALTER TABLE categories ADD COLUMN retry_count INTEGER DEFAULT 0;
    END IF;
END $$;

-- Transactions columns
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='transactions' AND column_name='is_deleted') THEN
        ALTER TABLE transactions ADD COLUMN is_deleted INTEGER DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='transactions' AND column_name='sync_status') THEN
        ALTER TABLE transactions ADD COLUMN sync_status TEXT DEFAULT 'synced';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='transactions' AND column_name='sync_version') THEN
        ALTER TABLE transactions ADD COLUMN sync_version INTEGER DEFAULT 1;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='transactions' AND column_name='retry_count') THEN
        ALTER TABLE transactions ADD COLUMN retry_count INTEGER DEFAULT 0;
    END IF;
END $$;

-- Debts columns
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='debts' AND column_name='is_deleted') THEN
        ALTER TABLE debts ADD COLUMN is_deleted INTEGER DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='debts' AND column_name='sync_status') THEN
        ALTER TABLE debts ADD COLUMN sync_status TEXT DEFAULT 'synced';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='debts' AND column_name='sync_version') THEN
        ALTER TABLE debts ADD COLUMN sync_version INTEGER DEFAULT 1;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='debts' AND column_name='retry_count') THEN
        ALTER TABLE debts ADD COLUMN retry_count INTEGER DEFAULT 0;
    END IF;
END $$;

-- Step 4: Create performance indexes
-- ============================================

CREATE INDEX IF NOT EXISTS idx_profiles_id ON profiles(id);

CREATE INDEX IF NOT EXISTS idx_categories_user_id ON categories(user_id);
CREATE INDEX IF NOT EXISTS idx_categories_not_deleted ON categories(user_id) WHERE is_deleted = 0;
CREATE INDEX IF NOT EXISTS idx_categories_sync_status ON categories(sync_status) WHERE sync_status = 'pending';

CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_not_deleted ON transactions(user_id) WHERE is_deleted = 0;
CREATE INDEX IF NOT EXISTS idx_transactions_sync_status ON transactions(sync_status) WHERE sync_status = 'pending';
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(transaction_date DESC);

CREATE INDEX IF NOT EXISTS idx_debts_user_id ON debts(user_id);
CREATE INDEX IF NOT EXISTS idx_debts_not_deleted ON debts(user_id) WHERE is_deleted = 0;
CREATE INDEX IF NOT EXISTS idx_debts_sync_status ON debts(sync_status) WHERE sync_status = 'pending';

-- Step 5: Enable Row Level Security
-- ============================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE debts ENABLE ROW LEVEL SECURITY;

-- Step 6: Drop ALL existing policies (clean slate)
-- ============================================

-- Profiles policies
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can delete own profile" ON profiles;

-- Categories policies
DROP POLICY IF EXISTS "Users can view own categories" ON categories;
DROP POLICY IF EXISTS "Users can insert own categories" ON categories;
DROP POLICY IF EXISTS "Users can update own categories" ON categories;
DROP POLICY IF EXISTS "Users can delete own categories" ON categories;
DROP POLICY IF EXISTS "Users can view their own categories" ON categories;
DROP POLICY IF EXISTS "Users can insert their own categories" ON categories;
DROP POLICY IF EXISTS "Users can update their own categories" ON categories;
DROP POLICY IF EXISTS "Users can delete their own categories" ON categories;

-- Transactions policies
DROP POLICY IF EXISTS "Users can view own transactions" ON transactions;
DROP POLICY IF EXISTS "Users can insert own transactions" ON transactions;
DROP POLICY IF EXISTS "Users can update own transactions" ON transactions;
DROP POLICY IF EXISTS "Users can delete own transactions" ON transactions;
DROP POLICY IF EXISTS "Users can view their own transactions" ON transactions;
DROP POLICY IF EXISTS "Users can insert their own transactions" ON transactions;
DROP POLICY IF EXISTS "Users can update their own transactions" ON transactions;
DROP POLICY IF EXISTS "Users can delete their own transactions" ON transactions;

-- Debts policies
DROP POLICY IF EXISTS "Users can view own debts" ON debts;
DROP POLICY IF EXISTS "Users can insert own debts" ON debts;
DROP POLICY IF EXISTS "Users can update own debts" ON debts;
DROP POLICY IF EXISTS "Users can delete own debts" ON debts;
DROP POLICY IF EXISTS "Users can view their own debts" ON debts;
DROP POLICY IF EXISTS "Users can insert their own debts" ON debts;
DROP POLICY IF EXISTS "Users can update their own debts" ON debts;
DROP POLICY IF EXISTS "Users can delete their own debts" ON debts;

-- Step 7: Create CORRECT RLS policies
-- ============================================

-- Profiles policies
CREATE POLICY "Users can view own profile" 
    ON profiles FOR SELECT 
    USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" 
    ON profiles FOR INSERT 
    WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile" 
    ON profiles FOR UPDATE 
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can delete own profile" 
    ON profiles FOR DELETE 
    USING (auth.uid() = id);

-- Categories policies
CREATE POLICY "Users can view own categories" 
    ON categories FOR SELECT 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own categories" 
    ON categories FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own categories" 
    ON categories FOR UPDATE 
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own categories" 
    ON categories FOR DELETE 
    USING (auth.uid() = user_id);

-- Transactions policies
CREATE POLICY "Users can view own transactions" 
    ON transactions FOR SELECT 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own transactions" 
    ON transactions FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own transactions" 
    ON transactions FOR UPDATE 
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own transactions" 
    ON transactions FOR DELETE 
    USING (auth.uid() = user_id);

-- Debts policies
CREATE POLICY "Users can view own debts" 
    ON debts FOR SELECT 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own debts" 
    ON debts FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own debts" 
    ON debts FOR UPDATE 
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own debts" 
    ON debts FOR DELETE 
    USING (auth.uid() = user_id);

-- Step 8: Create updated_at trigger
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers
DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_categories_updated_at ON categories;
CREATE TRIGGER update_categories_updated_at
    BEFORE UPDATE ON categories
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_transactions_updated_at ON transactions;
CREATE TRIGGER update_transactions_updated_at
    BEFORE UPDATE ON transactions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_debts_updated_at ON debts;
CREATE TRIGGER update_debts_updated_at
    BEFORE UPDATE ON debts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Step 9: VERIFICATION QUERIES
-- ============================================

-- Check all tables exist
SELECT 
    'TABLES' as check_type,
    table_name,
    (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count
FROM information_schema.tables t
WHERE table_name IN ('profiles', 'categories', 'transactions', 'debts')
    AND table_schema = 'public'
ORDER BY table_name;

-- Check critical columns exist
SELECT 
    'COLUMNS' as check_type,
    table_name, 
    column_name, 
    data_type
FROM information_schema.columns 
WHERE table_name IN ('categories', 'transactions', 'debts') 
    AND column_name IN ('is_deleted', 'sync_version', 'retry_count', 'sync_status')
ORDER BY table_name, column_name;

-- Check RLS is enabled
SELECT 
    'RLS_ENABLED' as check_type,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables 
WHERE tablename IN ('profiles', 'categories', 'transactions', 'debts')
ORDER BY tablename;

-- Check RLS policies exist
SELECT 
    'POLICIES' as check_type,
    tablename, 
    policyname,
    cmd as operation
FROM pg_policies 
WHERE tablename IN ('profiles', 'categories', 'transactions', 'debts')
ORDER BY tablename, policyname;

-- ============================================
-- SETUP COMPLETE! ✓
-- ============================================
-- Expected results:
-- - 4 tables (profiles, categories, transactions, debts)
-- - 12 sync columns (is_deleted, sync_version, retry_count, sync_status × 3 tables)
-- - RLS enabled on all 4 tables
-- - 16 policies (4 per table × 4 tables)
-- ============================================
