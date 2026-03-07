-- Add is_deleted column to all tables in Supabase
-- Run this in your Supabase SQL Editor

-- Add to categories table
ALTER TABLE categories 
ADD COLUMN IF NOT EXISTS is_deleted INTEGER DEFAULT 0;

-- Add to transactions table
ALTER TABLE transactions 
ADD COLUMN IF NOT EXISTS is_deleted INTEGER DEFAULT 0;

-- Add to debts table
ALTER TABLE debts 
ADD COLUMN IF NOT EXISTS is_deleted INTEGER DEFAULT 0;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_categories_not_deleted ON categories(user_id) WHERE is_deleted = 0;
CREATE INDEX IF NOT EXISTS idx_transactions_not_deleted ON transactions(user_id) WHERE is_deleted = 0;
CREATE INDEX IF NOT EXISTS idx_debts_not_deleted ON debts(user_id) WHERE is_deleted = 0;

-- Verify the columns were added
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name IN ('categories', 'transactions', 'debts') 
  AND column_name = 'is_deleted';
