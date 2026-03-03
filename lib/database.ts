import * as SQLite from 'expo-sqlite';

let db: SQLite.SQLiteDatabase | null = null;

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (db) return db;
  db = await SQLite.openDatabaseAsync('mobibooks.db');
  await setupDatabase(db);
  return db;
}

async function setupDatabase(database: SQLite.SQLiteDatabase) {
  // Transactions table
  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL,
      amount REAL NOT NULL,
      category TEXT,
      description TEXT,
      transaction_date TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted INTEGER DEFAULT 0,
      sync_status TEXT DEFAULT 'pending'
    );
  `);

  // Categories table
  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY NOT NULL,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      deleted INTEGER DEFAULT 0,
      sync_status TEXT DEFAULT 'pending'
    );
  `);

  // Debts table
  await database.execAsync(`
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
      deleted INTEGER DEFAULT 0,
      sync_status TEXT DEFAULT 'pending'
    );
  `);

  // App Lock settings
  await database.execAsync(`
    CREATE TABLE IF NOT EXISTS security_settings (
      user_id TEXT PRIMARY KEY NOT NULL,
      app_lock_enabled INTEGER DEFAULT 0,
      pin_hash TEXT,
      biometric_enabled INTEGER DEFAULT 0
    );
  `);
}

export async function wipeDatabase() {
  if (!db) db = await SQLite.openDatabaseAsync('mobibooks.db');
  await db.execAsync('DROP TABLE IF EXISTS transactions;');
  await db.execAsync('DROP TABLE IF EXISTS categories;');
  await db.execAsync('DROP TABLE IF EXISTS security_settings;');
  await setupDatabase(db);
}
