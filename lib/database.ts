import * as SQLite from 'expo-sqlite';
import { SCHEMA } from '../database/schema';
import { migrateDatabase } from '../database/migrations';

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
  if (!db) db = await SQLite.openDatabaseAsync('mobibooks.db');
  await db.execAsync('DROP TABLE IF EXISTS transactions;');
  await db.execAsync('DROP TABLE IF EXISTS categories;');
  await db.execAsync('DROP TABLE IF EXISTS debts;');
  await db.execAsync('DROP TABLE IF EXISTS sync_metadata;');
  await db.execAsync('DROP TABLE IF EXISTS sync_logs;');
  await db.execAsync('DROP TABLE IF EXISTS security_settings;');
  await db.execAsync('DROP TABLE IF EXISTS schema_version;');
  await migrateDatabase(db);
  await setupDatabase(db);
}
