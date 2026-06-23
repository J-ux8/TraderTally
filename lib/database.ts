import * as SQLite from 'expo-sqlite';
import { SCHEMA } from '../database/schema';
import { supabase } from './supabase';
import { randomUUID } from 'expo-crypto';



let db: SQLite.SQLiteDatabase | null = null;
let initPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (db) return db;
  
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      const _db = await SQLite.openDatabaseAsync('mobibooks.db');
      await setupDatabase(_db);
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
  for (const [, tableSql] of Object.entries(SCHEMA.TABLES)) {
    await database.execAsync(tableSql);
  }

  try {
    const info = await database.getAllAsync<{ name: string }>('PRAGMA table_info(sync_metadata)');
    const columns = info.map(col => col.name);
    const needsRecreate = !columns.includes('user_id') || columns.includes('device_id');
    
    if (needsRecreate) {
      await database.execAsync('DROP TABLE IF EXISTS sync_metadata');
      await database.execAsync(SCHEMA.TABLES.sync_metadata);
    } else {
      await database.execAsync(SCHEMA.TABLES.sync_metadata);
    }
  } catch (e) {
    console.error('[Database] Sync metadata migration failed:', e);
    await database.execAsync(SCHEMA.TABLES.sync_metadata);
  }

  const tablesToSync = ['transactions', 'categories', 'debts', 'customers', 'products', 'sales', 'sale_items'];
  
  for (const table of tablesToSync) {
    try {
      const info = await database.getAllAsync<{ name: string }>(`PRAGMA table_info(${table})`);
      const columns = info.map(col => col.name);

      if (!columns.includes('user_id')) {
        await database.execAsync(`ALTER TABLE ${table} ADD COLUMN user_id TEXT`);
      }

      if (!columns.includes('is_deleted')) {
        await database.execAsync(`ALTER TABLE ${table} ADD COLUMN is_deleted INTEGER DEFAULT 0`);
      }

      if (!columns.includes('updated_at')) {
        const now = new Date().toISOString();
        await database.execAsync(`ALTER TABLE ${table} ADD COLUMN updated_at TEXT DEFAULT '${now}'`);
      }

      if (!columns.includes('sync_status')) {
        await database.execAsync(`ALTER TABLE ${table} ADD COLUMN sync_status TEXT DEFAULT 'pending'`);
      }
      
      if (!columns.includes('retry_count')) {
        await database.execAsync(`ALTER TABLE ${table} ADD COLUMN retry_count INTEGER DEFAULT 0`);
      }

      if (table === 'categories') {
        if (!columns.includes('type')) {
          await database.execAsync(`ALTER TABLE categories ADD COLUMN type TEXT DEFAULT 'expense'`);
        }
        
        await database.execAsync(`
          UPDATE categories 
          SET type = 'income' 
          WHERE type = 'expense' 
          AND normalized_name NOT IN (
            'rent', 'stall fee', 'rent / stall fee',
            'stock', 'inventory', 'stock / inventory',
            'salaries', 'helpers', 'salaries / helpers',
            'transport', 'fuel', 'transport / fuel',
            'utilities', 'electricity', 'water',
            'maintenance', 'repairs', 'maintenance / repairs',
            'supplies', 'business supplies',
            'tax', 'levy', 'market levy', 'market levy / tax',
            'other'
          )
        `);

        await database.execAsync(`UPDATE categories SET type = 'income' WHERE normalized_name = 'sale'`);
      }
      
      if (table === 'transactions') {
        if (!columns.includes('customer_id')) {
          await database.execAsync(`ALTER TABLE transactions ADD COLUMN customer_id TEXT`);
        }
        if (!columns.includes('linked_sale_id')) {
          await database.execAsync(`ALTER TABLE transactions ADD COLUMN linked_sale_id TEXT`);
        }
      }

      if (table === 'debts') {
        if (!columns.includes('customer_id')) {
          await database.execAsync(`ALTER TABLE debts ADD COLUMN customer_id TEXT`);
        }
        if (!columns.includes('customer_phone')) {
          await database.execAsync(`ALTER TABLE debts ADD COLUMN customer_phone TEXT`);
        }
        if (!columns.includes('type')) {
          await database.execAsync(`ALTER TABLE debts ADD COLUMN type TEXT DEFAULT 'receivable'`);
        }
        if (!columns.includes('linked_sale_id')) {
          await database.execAsync(`ALTER TABLE debts ADD COLUMN linked_sale_id TEXT`);
        }
        if (!columns.includes('amount_paid_at_sale')) {
          await database.execAsync(`ALTER TABLE debts ADD COLUMN amount_paid_at_sale REAL DEFAULT 0`);
        }
      }

      if (table === 'products') {
        if (!columns.includes('display_name')) {
          await database.execAsync(`ALTER TABLE products ADD COLUMN display_name TEXT`);
          await database.execAsync(`UPDATE products SET display_name = name WHERE display_name IS NULL`);
        }
        if (!columns.includes('usage_count')) {
          await database.execAsync(`ALTER TABLE products ADD COLUMN usage_count INTEGER DEFAULT 0`);
        }
        if (!columns.includes('stock_quantity')) {
          await database.execAsync(`ALTER TABLE products ADD COLUMN stock_quantity REAL`);
        }
        if (!columns.includes('cost_price')) {
          await database.execAsync(`ALTER TABLE products ADD COLUMN cost_price REAL`);
        }
      }

      if (table === 'sale_items') {
        if (!columns.includes('unit_cost')) {
          await database.execAsync(`ALTER TABLE sale_items ADD COLUMN unit_cost REAL`);
        }
      }
    } catch (e) {
      console.error(`[Database] Migration failed for ${table}:`, e);
      throw e;
    }
  }

  try {
    const examples = ['bread', 'eggs', 'drinks', 'sugar', 'airtime', 'general'];
    for (const name of examples) {
      await database.execAsync(`DELETE FROM products WHERE LOWER(name) = '${name}' AND usage_count = 0`);
      await database.execAsync(`DELETE FROM products WHERE LOWER(display_name) = '${name}' AND usage_count = 0`);
    }
  } catch (e) {
    console.warn('[Database] Scoped cleanup failed:', e);
  }

  for (const [, indexSql] of Object.entries(SCHEMA.INDEXES)) {
    await database.execAsync(indexSql);
  }
}

export async function wipeDatabase() {
  try {
    if (!db) {
      db = await SQLite.openDatabaseAsync('mobibooks.db');
    }
    
    for (const tableName of Object.keys(SCHEMA.TABLES)) {
      await db.execAsync(`DROP TABLE IF EXISTS ${tableName};`);
    }
    await db.execAsync(`DROP TABLE IF EXISTS schema_version;`);
    
    await db.closeAsync();
    db = null;
  } catch (error: any) {
    console.error('[Database] Error wiping database:', error);
    db = null;
  }
}
