-- Create transaction_templates table for storing user-defined transaction templates
CREATE TABLE IF NOT EXISTS transaction_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('sale', 'expense')),
  default_amount DECIMAL(10, 2) NOT NULL CHECK (default_amount > 0),
  category TEXT,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
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

-- Enable RLS for transaction_templates
ALTER TABLE transaction_templates ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own templates" ON transaction_templates;
DROP POLICY IF EXISTS "Users can insert own templates" ON transaction_templates;
DROP POLICY IF EXISTS "Users can update own templates" ON transaction_templates;
DROP POLICY IF EXISTS "Users can delete own templates" ON transaction_templates;

-- Create RLS policies for transaction_templates
CREATE POLICY "Users can view own templates" 
    ON transaction_templates FOR SELECT 
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own templates" 
    ON transaction_templates FOR INSERT 
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own templates" 
    ON transaction_templates FOR UPDATE 
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own templates" 
    ON transaction_templates FOR DELETE 
    USING (auth.uid() = user_id);

-- Create updated_at trigger for transaction_templates
DROP TRIGGER IF EXISTS update_transaction_templates_updated_at ON transaction_templates;
CREATE TRIGGER update_transaction_templates_updated_at
    BEFORE UPDATE ON transaction_templates
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Verification query
SELECT 
    'TRANSACTION_TEMPLATES_SETUP' as check_type,
    'Table created with RLS policies' as status,
    (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'transaction_templates') as column_count,
    (SELECT rowsecurity FROM pg_tables WHERE tablename = 'transaction_templates') as rls_enabled,
    (SELECT COUNT(*) FROM pg_policies WHERE tablename = 'transaction_templates') as policy_count;
