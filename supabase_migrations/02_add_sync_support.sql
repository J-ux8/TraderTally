-- ============================================
-- ADD SYNC SUPPORT TO SUPABASE TABLES
-- Run this in Supabase SQL Editor to support the SyncEngine
-- ============================================

-- 1. Create transaction_templates table (missing on server)
CREATE TABLE IF NOT EXISTS transaction_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('sale', 'expense')),
    default_amount DECIMAL(10, 2) NOT NULL,
    category TEXT,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    is_deleted INTEGER DEFAULT 0,
    sync_status TEXT DEFAULT 'synced',
    retry_count INTEGER DEFAULT 0
);

-- 2. Add sync columns to existing tables
-- ============================================

-- profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_deleted INTEGER DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS sync_status TEXT DEFAULT 'synced';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0;

-- categories
ALTER TABLE categories ADD COLUMN IF NOT EXISTS sync_status TEXT DEFAULT 'synced';
ALTER TABLE categories ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0;

-- transactions
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS sync_status TEXT DEFAULT 'synced';
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0;

-- debts
ALTER TABLE debts ADD COLUMN IF NOT EXISTS sync_status TEXT DEFAULT 'synced';
ALTER TABLE debts ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0;

-- Step 3: Enable RLS and Policies for transaction_templates
-- ============================================

ALTER TABLE transaction_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own templates" ON transaction_templates;
CREATE POLICY "Users can view own templates" ON transaction_templates
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own templates" ON transaction_templates;
CREATE POLICY "Users can insert own templates" ON transaction_templates
    FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own templates" ON transaction_templates;
CREATE POLICY "Users can update own templates" ON transaction_templates
    FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own templates" ON transaction_templates;
CREATE POLICY "Users can delete own templates" ON transaction_templates
    FOR DELETE USING (auth.uid() = user_id);

-- Step 4: Add updated_at trigger for templates
-- ============================================

DROP TRIGGER IF EXISTS update_templates_updated_at ON transaction_templates;
CREATE TRIGGER update_templates_updated_at
    BEFORE UPDATE ON transaction_templates
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
