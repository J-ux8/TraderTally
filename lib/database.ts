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
  await database.execAsync(SCHEMA.transactions);
  await database.execAsync(SCHEMA.categories);
  await database.execAsync(SCHEMA.debts);
  await database.execAsync(SCHEMA.security_settings);
}

export async function wipeDatabase() {
  try {
    console.log('[Database] Starting database wipe...');
    
    if (!db) {
      console.log('[Database] Opening database for wipe');
      db = await SQLite.openDatabaseAsync('mobibooks.db');
    }
    
    // Drop all tables in a single transaction for safety
    console.log('[Database] Dropping all tables...');
    await db.execAsync(`
      DROP TABLE IF EXISTS transactions;
      DROP TABLE IF EXISTS categories;
      DROP TABLE IF EXISTS debts;
      DROP TABLE IF EXISTS security_settings;
      DROP TABLE IF EXISTS schema_version;
    `);
    
    console.log('[Database] Tables dropped successfully');
    
    // Close the database connection
    await db.closeAsync();
    db = null;
    
    console.log('[Database] Database wiped successfully');
  } catch (error: any) {
    console.error('[Database] Error wiping database:', error);
    
    // If wipe fails, force close and reset
    try {
      if (db) {
        await db.closeAsync();
      }
    } catch (closeError) {
      // Ignore close errors
    }
    db = null;
    
    console.log('[Database] Database connection closed despite errors');
  }
}
