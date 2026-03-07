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
      sync_status TEXT DEFAULT 'pending',
      sync_version INTEGER DEFAULT 1,
      retry_count INTEGER DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
    CREATE INDEX IF NOT EXISTS idx_transactions_sync_status ON transactions(sync_status) WHERE sync_status = 'pending';
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
      sync_status TEXT DEFAULT 'pending',
      sync_version INTEGER DEFAULT 1,
      retry_count INTEGER DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_categories_user_id ON categories(user_id);
    CREATE INDEX IF NOT EXISTS idx_categories_sync_status ON categories(sync_status) WHERE sync_status = 'pending';
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
      sync_status TEXT DEFAULT 'pending',
      sync_version INTEGER DEFAULT 1,
      retry_count INTEGER DEFAULT 0
    );
    CREATE INDEX IF NOT EXISTS idx_debts_user_id ON debts(user_id);
    CREATE INDEX IF NOT EXISTS idx_debts_sync_status ON debts(sync_status) WHERE sync_status = 'pending';
  `,
    sync_metadata: `
    CREATE TABLE IF NOT EXISTS sync_metadata (
      user_id TEXT PRIMARY KEY NOT NULL,
      last_sync_time TEXT,
      last_push_time TEXT
    );
  `,
    sync_logs: `
    CREATE TABLE IF NOT EXISTS sync_logs (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL,
      table_name TEXT NOT NULL,
      error_message TEXT NOT NULL,
      timestamp TEXT NOT NULL
    );
  `,
    security_settings: `
    CREATE TABLE IF NOT EXISTS security_settings (
      user_id TEXT PRIMARY KEY NOT NULL,
      app_lock_enabled INTEGER DEFAULT 0,
      pin_hash TEXT,
      biometric_enabled INTEGER DEFAULT 0
    );
  `
};
