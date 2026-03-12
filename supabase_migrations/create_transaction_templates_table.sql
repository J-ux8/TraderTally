-- Create transaction_templates table for storing user-defined transaction templates
CREATE TABLE IF NOT EXISTS transaction_templates (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('sale', 'expense')),
  default_amount REAL NOT NULL CHECK (default_amount > 0),
  category TEXT,
  description TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  is_deleted INTEGER DEFAULT 0
);

-- Index on user_id for fast user-scoped queries
CREATE INDEX IF NOT EXISTS idx_templates_user_id 
  ON transaction_templates(user_id);

-- Composite index on (user_id, is_deleted) for efficient filtering of active templates
CREATE INDEX IF NOT EXISTS idx_templates_user_active 
  ON transaction_templates(user_id, is_deleted);

-- Index on created_at for sorting by creation date
CREATE INDEX IF NOT EXISTS idx_templates_created_at 
  ON transaction_templates(created_at DESC);
