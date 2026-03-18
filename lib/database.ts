import * as SQLite from 'expo-sqlite';
import { SCHEMA } from '../database/schema';

console.log('>>> [DB] MODULE LOADED - STACK VERSION: 5.0 <<<');

let db: SQLite.SQLiteDatabase | null = null;
let initPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (db) return db;
  
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      console.log('[Database] Opening database: mobibooks.db');
      const _db = await SQLite.openDatabaseAsync('mobibooks.db');
      console.log('[Database] Setting up tables...');
      await setupDatabase(_db);
      console.log('[Database] Database ready');
      db = _db;
      return db;
    } catch (error) {
      initPromise = null;
      throw error;
    }
  })();

  return initPromise;
}

async function setupDatabase(database: SQLite.SQLiteDatabase) {
  // 1. Create all tables first
  console.log('[Database] Phase 1: Creating tables...');
  for (const [tableName, tableSql] of Object.entries(SCHEMA.TABLES)) {
    console.log(`[Database] Ensuring table exists: ${tableName}`);
    await database.execAsync(tableSql);
  }

  // 2. Migration: Add missing sync columns to existing tables
  console.log('[Database] Phase 2: Running migrations...');

  // Migration for sync_metadata to handle old schemas with device_id constraints
  try {
    const info = await database.getAllAsync<{ name: string }>('PRAGMA table_info(sync_metadata)');
    const hasDeviceId = info.some(col => col.name === 'device_id');
    
    if (hasDeviceId) {
      console.log('[Database] Migrating sync_metadata: removing obsolete device_id');
      await database.execAsync('DROP TABLE IF EXISTS sync_metadata');
      await database.execAsync(SCHEMA.TABLES.sync_metadata);
    } else {
      await database.execAsync(SCHEMA.TABLES.sync_metadata);
    }
  } catch (e) {
    console.error('[Database] Sync metadata migration failed:', e);
    // Ensure it exists at least
    await database.execAsync(SCHEMA.TABLES.sync_metadata);
  }

  const tablesToSync = ['transactions', 'categories', 'debts', 'transaction_templates'];
  
  for (const table of tablesToSync) {
    try {
      const info = await database.getAllAsync<{ name: string }>(`PRAGMA table_info(${table})`);
      const columns = info.map(col => col.name);
      console.log(`[Database] Columns for ${table}:`, columns.join(', '));

      if (!columns.includes('user_id')) {
        console.log(`[Database] Migrating ${table}: adding user_id column`);
        await database.execAsync(`ALTER TABLE ${table} ADD COLUMN user_id TEXT`);
      }

      if (!columns.includes('is_deleted')) {
        console.log(`[Database] Migrating ${table}: adding is_deleted column`);
        await database.execAsync(`ALTER TABLE ${table} ADD COLUMN is_deleted INTEGER DEFAULT 0`);
      }

      if (!columns.includes('updated_at')) {
        console.log(`[Database] Migrating ${table}: adding updated_at column`);
        const now = new Date().toISOString();
        await database.execAsync(`ALTER TABLE ${table} ADD COLUMN updated_at TEXT DEFAULT '${now}'`);
      }

      if (!columns.includes('sync_status')) {
        console.log(`[Database] Migrating ${table}: adding sync_status column`);
        await database.execAsync(`ALTER TABLE ${table} ADD COLUMN sync_status TEXT DEFAULT 'pending'`);
      }
      
      if (!columns.includes('retry_count')) {
        console.log(`[Database] Migrating ${table}: adding retry_count column`);
        await database.execAsync(`ALTER TABLE ${table} ADD COLUMN retry_count INTEGER DEFAULT 0`);
      }
    } catch (e) {
      console.error(`[Database] Migration failed for ${table}:`, e);
      throw e; // Re-throw to prevent index creation on broken state
    }
  }

  // 3. Create all indexes AFTER tables exist and columns are migrated
  console.log('[Database] Phase 3: Creating indexes...');
  for (const [name, indexSql] of Object.entries(SCHEMA.INDEXES)) {
    console.log(`[Database] Ensuring indexes exist for: ${name}`);
    await database.execAsync(indexSql);
  }
}

export async function wipeDatabase() {
  try {
    console.log('[Database] Starting database wipe...');
    
    if (!db) {
      db = await SQLite.openDatabaseAsync('mobibooks.db');
    }
    
    // Drop all tables
    for (const tableName of Object.keys(SCHEMA.TABLES)) {
      await db.execAsync(`DROP TABLE IF EXISTS ${tableName};`);
    }
    await db.execAsync(`DROP TABLE IF EXISTS schema_version;`);
    
    await db.closeAsync();
    db = null;
    console.log('[Database] Database wiped successfully');
  } catch (error: any) {
    console.error('[Database] Error wiping database:', error);
    db = null;
  }
}
