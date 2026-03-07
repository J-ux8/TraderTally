-- ============================================================================
-- ADD SYNC_VERSION COLUMNS TO SUPABASE TABLES
-- ============================================================================
-- 
-- Run this migration in your Supabase SQL Editor to add the sync_version
-- column to all tables. This fixes the "Could not find the 'sync_version' 
-- column in the schema cache" error.
--
-- After running this, you may need to reload the PostgREST schema cache:
-- NOTIFY pgrst, 'reload schema';
-- ============================================================================

-- Add sync_version to transactions table
ALTER TABLE public.transactions 
ADD COLUMN IF NOT EXISTS sync_version INTEGER DEFAULT 1;

-- Add sync_version to debts table
ALTER TABLE public.debts 
ADD COLUMN IF NOT EXISTS sync_version INTEGER DEFAULT 1;

-- Add sync_version to categories table
ALTER TABLE public.categories 
ADD COLUMN IF NOT EXISTS sync_version INTEGER DEFAULT 1;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';

-- Verify columns were added
SELECT 
    'transactions' as table_name,
    column_name,
    data_type,
    column_default
FROM information_schema.columns 
WHERE table_name = 'transactions' AND column_name = 'sync_version'
UNION ALL
SELECT 
    'debts' as table_name,
    column_name,
    data_type,
    column_default
FROM information_schema.columns 
WHERE table_name = 'debts' AND column_name = 'sync_version'
UNION ALL
SELECT 
    'categories' as table_name,
    column_name,
    data_type,
    column_default
FROM information_schema.columns 
WHERE table_name = 'categories' AND column_name = 'sync_version';
