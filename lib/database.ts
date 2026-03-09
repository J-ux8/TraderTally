import * as SQLite from 'expo-sqlite';
import { SCHEMA } from '../database/schema';
import { migrateDatabase } from '../database/migrations';
import { validateSyncSchema } from '../database/schema-validator';

let db: SQLite.SQLiteDatabase | null = null;

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (db) {
    // Connection already exists, reusing it (this is good!)
    return db;
  }
  console.log('[Database] Opening database: mobibooks.db');
  db = await SQLite.openDatabaseAsync('mobibooks.db');
  console.log('[Database] Running migrations...');
  await migrateDatabase(db);
  console.log('[Database] Setting up tables...');
  await setupDatabase(db);
  console.log('[Database] Validating schema...');
  await validateSyncSchema(db);
  console.log('[Database] Database ready');
  return db;
}

async function setupDatabase(database: SQLite.SQLiteDatabase) {
  await database.execAsync(SCHEMA.transactions);
  await database.execAsync(SCHEMA.categories);
  await database.execAsync(SCHEMA.debts);
  await database.execAsync(SCHEMA.sync_metadata);
  await database.execAsync(SCHEMA.sync_logs);
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
      DROP TABLE IF EXISTS sync_metadata;
      DROP TABLE IF EXISTS sync_logs;
      DROP TABLE IF EXISTS security_settings;
      DROP TABLE IF EXISTS schema_version;
    `);
    
    console.log('[Database] Tables dropped, recreating schema...');
    
    // Recreate tables with fresh schema
    await migrateDatabase(db);
    await setupDatabase(db);
    
    console.log('[Database] Database wiped and recreated successfully');
  } catch (error: any) {
    console.error('[Database] Error wiping database:', error);
    console.error('[Database] Error details:', {
      message: error?.message,
      code: error?.code,
      cause: error?.cause
    });
    
    // If wipe fails, close and reopen database to reset state
    try {
      console.log('[Database] Attempting to reset database after error...');
      if (db) {
        await db.closeAsync();
        db = null;
      }
      // Reopen and setup fresh
      db = await SQLite.openDatabaseAsync('mobibooks.db');
      await migrateDatabase(db);
      await setupDatabase(db);
      console.log('[Database] Database reset after error');
    } catch (resetError: any) {
      console.error('[Database] Failed to reset database:', resetError);
      console.error('[Database] Reset error details:', {
        message: resetError?.message,
        code: resetError?.code,
        cause: resetError?.cause
      });
      // Don't throw - allow logout to continue even if database wipe fails
      console.log('[Database] Continuing despite database wipe failure');
    }
  }
}
