export const SCHEMA = {
  TABLES: {
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
        retry_count INTEGER DEFAULT 0,
        customer_id TEXT,
        linked_sale_id TEXT
      );
    `,
    categories: `
      CREATE TABLE IF NOT EXISTS categories (
        id TEXT PRIMARY KEY NOT NULL,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        normalized_name TEXT NOT NULL,
        type TEXT DEFAULT 'expense',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        is_deleted INTEGER DEFAULT 0,
        sync_status TEXT CHECK(sync_status IN ('pending', 'syncing', 'synced', 'failed')) DEFAULT 'pending',
        retry_count INTEGER DEFAULT 0
      );
    `,
    debts: `
      CREATE TABLE IF NOT EXISTS debts (
        id TEXT PRIMARY KEY NOT NULL,
        user_id TEXT NOT NULL,
        customer_name TEXT NOT NULL,
        amount REAL NOT NULL,
        due_date TEXT,
        note TEXT,
        type TEXT DEFAULT 'receivable' CHECK(type IN ('receivable', 'payable')),
        is_settled INTEGER DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        is_deleted INTEGER DEFAULT 0,
        sync_status TEXT CHECK(sync_status IN ('pending', 'syncing', 'synced', 'failed')) DEFAULT 'pending',
        retry_count INTEGER DEFAULT 0,
        customer_phone TEXT,
        customer_id TEXT,
        linked_sale_id TEXT,
        amount_paid_at_sale REAL DEFAULT 0
      );
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
        business_logo TEXT,
        business_address TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        is_deleted INTEGER DEFAULT 0,
        sync_status TEXT CHECK(sync_status IN ('pending', 'syncing', 'synced', 'failed')) DEFAULT 'pending',
        retry_count INTEGER DEFAULT 0
      );
    `,
    customers: `
      CREATE TABLE IF NOT EXISTS customers (
        id TEXT PRIMARY KEY NOT NULL,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        phone TEXT,
        email TEXT,
        address TEXT,
        notes TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        is_deleted INTEGER DEFAULT 0,
        sync_status TEXT CHECK(sync_status IN ('pending', 'syncing', 'synced', 'failed')) DEFAULT 'pending',
        retry_count INTEGER DEFAULT 0
      );
    `,
    products: `
      CREATE TABLE IF NOT EXISTS products (
        id TEXT PRIMARY KEY NOT NULL,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        display_name TEXT NOT NULL,
        price REAL NOT NULL,
        cost_price REAL,
        category_id TEXT,
        usage_count INTEGER DEFAULT 0,
        stock_quantity REAL,
        is_deleted INTEGER DEFAULT 0,
        sync_status TEXT CHECK(sync_status IN ('pending', 'syncing', 'synced', 'failed')) DEFAULT 'pending',
        retry_count INTEGER DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(user_id, name)
      );
    `,
    sales: `
      CREATE TABLE IF NOT EXISTS sales (
        id TEXT PRIMARY KEY NOT NULL,
        user_id TEXT NOT NULL,
        total_amount REAL NOT NULL,
        is_deleted INTEGER DEFAULT 0,
        sync_status TEXT CHECK(sync_status IN ('pending', 'syncing', 'synced', 'failed')) DEFAULT 'pending',
        retry_count INTEGER DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `,
    sale_items: `
      CREATE TABLE IF NOT EXISTS sale_items (
        id TEXT PRIMARY KEY NOT NULL,
        sale_id TEXT NOT NULL,
        product_id TEXT NOT NULL,
        product_name TEXT NOT NULL,
        quantity REAL NOT NULL,
        unit_price REAL NOT NULL,
        unit_cost REAL,
        total_price REAL NOT NULL,
        is_deleted INTEGER DEFAULT 0,
        sync_status TEXT CHECK(sync_status IN ('pending', 'syncing', 'synced', 'failed')) DEFAULT 'pending',
        retry_count INTEGER DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (sale_id) REFERENCES sales(id),
        FOREIGN KEY (product_id) REFERENCES products(id)
      );
    `,
  },
  INDEXES: {
    transactions: `
      CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
      CREATE INDEX IF NOT EXISTS idx_transactions_updated_at ON transactions(updated_at);
      CREATE INDEX IF NOT EXISTS idx_transactions_sync ON transactions(sync_status);
      CREATE INDEX IF NOT EXISTS idx_transactions_user_created ON transactions(user_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_transactions_range ON transactions(user_id, is_deleted, created_at DESC);
    `,
    categories: `
      CREATE INDEX IF NOT EXISTS idx_categories_user_id ON categories(user_id);
      CREATE INDEX IF NOT EXISTS idx_categories_updated_at ON categories(updated_at);
      CREATE INDEX IF NOT EXISTS idx_categories_sync ON categories(sync_status);
    `,
    debts: `
      CREATE INDEX IF NOT EXISTS idx_debts_user_id ON debts(user_id);
      CREATE INDEX IF NOT EXISTS idx_debts_updated_at ON debts(updated_at);
      CREATE INDEX IF NOT EXISTS idx_debts_sync ON debts(sync_status);
    `,
    transaction_templates: `
      CREATE INDEX IF NOT EXISTS idx_templates_user_id ON transaction_templates(user_id);
      CREATE INDEX IF NOT EXISTS idx_templates_user_active ON transaction_templates(user_id, is_deleted);
      CREATE INDEX IF NOT EXISTS idx_templates_created_at ON transaction_templates(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_templates_sync ON transaction_templates(sync_status);
    `,
    profiles: `
      CREATE INDEX IF NOT EXISTS idx_profiles_updated_at ON profiles(updated_at);
    `,
    customers: `
      CREATE INDEX IF NOT EXISTS idx_customers_user_id ON customers(user_id);
      CREATE INDEX IF NOT EXISTS idx_customers_updated_at ON customers(updated_at);
      CREATE INDEX IF NOT EXISTS idx_customers_sync ON customers(sync_status);
    `,
    products: `
      CREATE INDEX IF NOT EXISTS idx_products_user_id ON products(user_id);
      CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);
      CREATE INDEX IF NOT EXISTS idx_products_sync ON products(sync_status);
    `,
    sales: `
      CREATE INDEX IF NOT EXISTS idx_sales_user_id ON sales(user_id);
      CREATE INDEX IF NOT EXISTS idx_sales_created_at ON sales(created_at);
      CREATE INDEX IF NOT EXISTS idx_sales_sync ON sales(sync_status);
    `,
    sale_items: `
      CREATE INDEX IF NOT EXISTS idx_sale_items_sale_id ON sale_items(sale_id);
      CREATE INDEX IF NOT EXISTS idx_sale_items_sync ON sale_items(sync_status);
    `,
  }
};
