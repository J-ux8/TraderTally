-- ============================================
-- CLEAN MOBIBOOKS SUPABASE SETUP
-- Supabase-Only Architecture (No Sync Logic)
-- Run this ONCE in Supabase SQL Editor
-- ============================================

-- Step 1: Create tables
-- ============================================

CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    full_name TEXT,
    phone_number TEXT,
    business_type TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    normalized_name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    is_deleted INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    amount DECIMAL(10, 2) NOT NULL,
    category TEXT,
    description TEXT,
    transaction_date DATE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    is_deleted INTEGER DEFAULT 0
);

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
    is_deleted INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS verification_codes (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    email TEXT NOT NULL,
    code TEXT NOT NULL,
    verified BOOLEAN DEFAULT false NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Step 2: Create indexes
-- ============================================

CREATE INDEX IF NOT EXISTS idx_categories_user_id ON categories(user_id);
CREATE INDEX IF NOT EXISTS idx_categories_not_deleted ON categories(user_id) WHERE is_deleted = 0;

CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_not_deleted ON transactions(user_id) WHERE is_deleted = 0;
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(transaction_date DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_user_deleted ON transactions(user_id, is_deleted);
CREATE INDEX IF NOT EXISTS idx_transactions_user_date ON transactions(user_id, transaction_date DESC);

CREATE INDEX IF NOT EXISTS idx_debts_user_id ON debts(user_id);
CREATE INDEX IF NOT EXISTS idx_debts_not_deleted ON debts(user_id) WHERE is_deleted = 0;
CREATE INDEX IF NOT EXISTS idx_debts_user_deleted ON debts(user_id, is_deleted);
CREATE INDEX IF NOT EXISTS idx_debts_user_settled ON debts(user_id, is_settled);
CREATE INDEX IF NOT EXISTS idx_debts_user_deleted_settled ON debts(user_id, is_deleted, is_settled);

CREATE INDEX IF NOT EXISTS idx_verification_codes_user_id ON verification_codes(user_id);
CREATE INDEX IF NOT EXISTS idx_verification_codes_email ON verification_codes(email);
CREATE INDEX IF NOT EXISTS idx_verification_codes_code ON verification_codes(code);
CREATE INDEX IF NOT EXISTS idx_verification_codes_expires ON verification_codes(expires_at);

-- Step 3: Enable RLS
-- ============================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE debts ENABLE ROW LEVEL SECURITY;
ALTER TABLE verification_codes ENABLE ROW LEVEL SECURITY;

-- Step 4: Drop old policies (clean slate)
-- ============================================

DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can delete own profile" ON profiles;

DROP POLICY IF EXISTS "Users can view own categories" ON categories;
DROP POLICY IF EXISTS "Users can insert own categories" ON categories;
DROP POLICY IF EXISTS "Users can update own categories" ON categories;
DROP POLICY IF EXISTS "Users can delete own categories" ON categories;
DROP POLICY IF EXISTS "Users can view their own categories" ON categories;
DROP POLICY IF EXISTS "Users can insert their own categories" ON categories;
DROP POLICY IF EXISTS "Users can update their own categories" ON categories;
DROP POLICY IF EXISTS "Users can delete their own categories" ON categories;

DROP POLICY IF EXISTS "Users can view own transactions" ON transactions;
DROP POLICY IF EXISTS "Users can insert own transactions" ON transactions;
DROP POLICY IF EXISTS "Users can update own transactions" ON transactions;
DROP POLICY IF EXISTS "Users can delete own transactions" ON transactions;
DROP POLICY IF EXISTS "Users can view their own transactions" ON transactions;
DROP POLICY IF EXISTS "Users can insert their own transactions" ON transactions;
DROP POLICY IF EXISTS "Users can update their own transactions" ON transactions;
DROP POLICY IF EXISTS "Users can delete their own transactions" ON transactions;

DROP POLICY IF EXISTS "Users can view own debts" ON debts;
DROP POLICY IF EXISTS "Users can insert own debts" ON debts;
DROP POLICY IF EXISTS "Users can update own debts" ON debts;
DROP POLICY IF EXISTS "Users can delete own debts" ON debts;
DROP POLICY IF EXISTS "Users can view their own debts" ON debts;
DROP POLICY IF EXISTS "Users can insert their own debts" ON debts;
DROP POLICY IF EXISTS "Users can update their own debts" ON debts;
DROP POLICY IF EXISTS "Users can delete their own debts" ON debts;

DROP POLICY IF EXISTS "Users can view own verification codes" ON verification_codes;
DROP POLICY IF EXISTS "Users can insert own verification codes" ON verification_codes;
DROP POLICY IF EXISTS "Users can update own verification codes" ON verification_codes;

-- Step 5: Create RLS policies
-- ============================================

-- Profiles
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

-- Categories
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

-- Transactions
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

-- Debts
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

-- Verification Codes
CREATE POLICY "Users can view own verification codes"
    ON verification_codes FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own verification codes"
    ON verification_codes FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own verification codes"
    ON verification_codes FOR UPDATE
    USING (auth.uid() = user_id);

-- Step 6: Create updated_at trigger
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

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

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- Check all tables exist
SELECT 
    'TABLES' as check_type,
    table_name,
    (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count
FROM information_schema.tables t
WHERE table_name IN ('profiles', 'categories', 'transactions', 'debts', 'verification_codes')
    AND table_schema = 'public'
ORDER BY table_name;

-- Check RLS is enabled
SELECT 
    'RLS_ENABLED' as check_type,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables 
WHERE tablename IN ('profiles', 'categories', 'transactions', 'debts', 'verification_codes')
ORDER BY tablename;

-- Check RLS policies exist
SELECT 
    'POLICIES' as check_type,
    tablename, 
    policyname,
    cmd as operation
FROM pg_policies 
WHERE tablename IN ('profiles', 'categories', 'transactions', 'debts', 'verification_codes')
ORDER BY tablename, policyname;

-- ============================================
-- SETUP COMPLETE! ✓
-- ============================================
