import * as SQLite from 'expo-sqlite';
import { SCHEMA } from '../database/schema';

let db: SQLite.SQLiteDatabase | null = null;

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (db) {
    // Connection already exists, reusing it (this is good!)
    return db;
  }
  console.log('[Database] Opening database: mobibooks.db');
  db = await SQLite.openDatabaseAsync('mobibooks.db');
  console.log('[Database] Setting up tables...');
  await setupDatabase(db);
  console.log('[Database] Database ready');
  return db;
}

async function setupDatabase(database: SQLite.SQLiteDatabase) {
  // Execute all schema definitions
  await database.execAsync(SCHEMA.transactions);
  await database.execAsync(SCHEMA.categories);
  await database.execAsync(SCHEMA.debts);
  await database.execAsync(SCHEMA.security_settings);
  await database.execAsync(SCHEMA.transaction_templates);
  await database.execAsync(SCHEMA.sync_metadata);
  await database.execAsync(SCHEMA.profiles);
}

export async function wipeDatabase() {
  try {
    console.log('[Database] Starting database wipe...');
    
    if (!db) {
      db = await SQLite.openDatabaseAsync('mobibooks.db');
    }
    
    // Drop all tables
    await db.execAsync(`
      DROP TABLE IF EXISTS transactions;
      DROP TABLE IF EXISTS categories;
      DROP TABLE IF EXISTS debts;
      DROP TABLE IF EXISTS security_settings;
      DROP TABLE IF EXISTS transaction_templates;
      DROP TABLE IF EXISTS sync_metadata;
      DROP TABLE IF EXISTS profiles;
      DROP TABLE IF EXISTS schema_version;
    `);
    
    await db.closeAsync();
    db = null;
    console.log('[Database] Database wiped successfully');
  } catch (error: any) {
    console.error('[Database] Error wiping database:', error);
    db = null;
  }
}
