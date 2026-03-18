export const SCHEMA = {
  transactions: `
    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL,
      amount REAL NOT NULL,
      category TEXT,
      description TEXT,
      transaction_date TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      is_deleted INTEGER DEFAULT 0,
      sync_status TEXT CHECK(sync_status IN ('pending', 'syncing', 'synced', 'failed')) DEFAULT 'pending',
      retry_count INTEGER DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
    CREATE INDEX IF NOT EXISTS idx_transactions_updated_at ON transactions(updated_at);
    CREATE INDEX IF NOT EXISTS idx_transactions_sync ON transactions(sync_status);
  `,
  categories: `
    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      normalized_name TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      is_deleted INTEGER DEFAULT 0,
      sync_status TEXT CHECK(sync_status IN ('pending', 'syncing', 'synced', 'failed')) DEFAULT 'pending',
      retry_count INTEGER DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_categories_user_id ON categories(user_id);
    CREATE INDEX IF NOT EXISTS idx_categories_updated_at ON categories(updated_at);
    CREATE INDEX IF NOT EXISTS idx_categories_sync ON categories(sync_status);
  `,
  debts: `
    CREATE TABLE IF NOT EXISTS debts (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL,
      customer_name TEXT NOT NULL,
      amount REAL NOT NULL,
      due_date TEXT,
      note TEXT,
      is_settled INTEGER DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      is_deleted INTEGER DEFAULT 0,
      sync_status TEXT CHECK(sync_status IN ('pending', 'syncing', 'synced', 'failed')) DEFAULT 'pending',
      retry_count INTEGER DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_debts_user_id ON debts(user_id);
    CREATE INDEX IF NOT EXISTS idx_debts_updated_at ON debts(updated_at);
    CREATE INDEX IF NOT EXISTS idx_debts_sync ON debts(sync_status);
  `,
  security_settings: `
    CREATE TABLE IF NOT EXISTS security_settings (
      user_id TEXT PRIMARY KEY NOT NULL,
      app_lock_enabled INTEGER DEFAULT 0,
      pin_hash TEXT,
      biometric_enabled INTEGER DEFAULT 0
    );
  `,
  transaction_templates: `
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
      is_deleted INTEGER DEFAULT 0,
      sync_status TEXT CHECK(sync_status IN ('pending', 'syncing', 'synced', 'failed')) DEFAULT 'pending',
      retry_count INTEGER DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_templates_user_id ON transaction_templates(user_id);
    CREATE INDEX IF NOT EXISTS idx_templates_user_active ON transaction_templates(user_id, is_deleted);
    CREATE INDEX IF NOT EXISTS idx_templates_created_at ON transaction_templates(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_templates_sync ON transaction_templates(sync_status);
  `,
  sync_metadata: `
    CREATE TABLE IF NOT EXISTS sync_metadata (
      user_id TEXT PRIMARY KEY NOT NULL,
      last_sync_time TEXT
    );
  `,
  profiles: `
    CREATE TABLE IF NOT EXISTS profiles (
      id TEXT PRIMARY KEY NOT NULL,
      full_name TEXT,
      email TEXT,
      phone_number TEXT,
      business_type TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      is_deleted INTEGER DEFAULT 0,
      sync_status TEXT CHECK(sync_status IN ('pending', 'syncing', 'synced', 'failed')) DEFAULT 'pending',
      retry_count INTEGER DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_profiles_updated_at ON profiles(updated_at);
  `
};
