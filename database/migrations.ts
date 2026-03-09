import * as SQLite from 'expo-sqlite';

const CURRENT_SCHEMA_VERSION = 5;

/**
 * SAFE migration that NEVER drops tables with user data.
 * Always adds missing columns incrementally to preserve data.
 */
export async function migrateDatabase(database: SQLite.SQLiteDatabase) {
    try {
        // Check schema version
        await database.execAsync(`
      CREATE TABLE IF NOT EXISTS schema_version (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        version INTEGER NOT NULL DEFAULT 1
      );
    `);

        const versionRow = await database.getFirstAsync(
            'SELECT version FROM schema_version WHERE id = 1'
        ) as { version: number } | null;

        const currentVersion = versionRow?.version ?? 0;
        
        console.log(`[Migration] Current schema version: ${currentVersion}, Target version: ${CURRENT_SCHEMA_VERSION}`);

        if (currentVersion >= CURRENT_SCHEMA_VERSION) {
            console.log('[Migration] Database is up to date, no migration needed');
            return; // Already up to date
        }

        console.log(`[Migration] Upgrading from version ${currentVersion} to ${CURRENT_SCHEMA_VERSION}`);

        // ALWAYS use incremental migration to preserve user data
        // NEVER drop tables - this was causing data loss!
        console.log('[Migration] Adding missing columns (preserving all data)...');
        
        // Add missing columns to transactions
        await addColumnIfMissing(database, 'transactions', 'is_deleted', 'INTEGER DEFAULT 0');
        await addColumnIfMissing(database, 'transactions', 'sync_status', "TEXT DEFAULT 'pending'");
        await addColumnIfMissing(database, 'transactions', 'sync_version', 'INTEGER DEFAULT 1');
        await addColumnIfMissing(database, 'transactions', 'retry_count', 'INTEGER DEFAULT 0');

        // Add missing columns to categories
        await addColumnIfMissing(database, 'categories', 'is_deleted', 'INTEGER DEFAULT 0');
        await addColumnIfMissing(database, 'categories', 'sync_status', "TEXT DEFAULT 'pending'");
        await addColumnIfMissing(database, 'categories', 'sync_version', 'INTEGER DEFAULT 1');
        await addColumnIfMissing(database, 'categories', 'retry_count', 'INTEGER DEFAULT 0');

        // Add missing columns to debts
        await addColumnIfMissing(database, 'debts', 'is_deleted', 'INTEGER DEFAULT 0');
        await addColumnIfMissing(database, 'debts', 'sync_status', "TEXT DEFAULT 'pending'");
        await addColumnIfMissing(database, 'debts', 'sync_version', 'INTEGER DEFAULT 1');
        await addColumnIfMissing(database, 'debts', 'retry_count', 'INTEGER DEFAULT 0');

        // Add missing columns to sync_metadata
        await addColumnIfMissing(database, 'sync_metadata', 'last_sync_time', 'TEXT');
        await addColumnIfMissing(database, 'sync_metadata', 'last_push_time', 'TEXT');
        await addColumnIfMissing(database, 'sync_metadata', 'device_id', 'TEXT');

        // Add performance indexes for updated_at columns
        console.log('[Migration] Adding performance indexes...');
        await createIndexIfMissing(database, 'idx_transactions_updated_at', 'transactions', 'updated_at');
        await createIndexIfMissing(database, 'idx_categories_updated_at', 'categories', 'updated_at');
        await createIndexIfMissing(database, 'idx_debts_updated_at', 'debts', 'updated_at');

        // Update version
        await database.runAsync(
            `INSERT INTO schema_version (id, version) VALUES (1, ?)
       ON CONFLICT(id) DO UPDATE SET version = EXCLUDED.version`,
            [CURRENT_SCHEMA_VERSION]
        );

        console.log(`[Migration] Upgrade to version ${CURRENT_SCHEMA_VERSION} complete.`);
    } catch (error) {
        console.error("[Migration] Failed:", error);
        throw error;
    }
}

async function addColumnIfMissing(database: SQLite.SQLiteDatabase, table: string, column: string, type: string) {
    const tableExists = await database.getAllAsync(
        `SELECT name FROM sqlite_master WHERE type='table' AND name=?`, [table]
    );
    if (tableExists.length === 0) return; // Table doesn't exist yet, setupDatabase will create it

    const info = await database.getAllAsync(`PRAGMA table_info(${table})`) as any[];
    const exists = info.some(col => col.name === column);
    if (!exists) {
        console.log(`[Migration] Adding column ${column} to ${table}`);
        await database.execAsync(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
    }
}

async function createIndexIfMissing(database: SQLite.SQLiteDatabase, indexName: string, table: string, column: string) {
    const indexExists = await database.getAllAsync(
        `SELECT name FROM sqlite_master WHERE type='index' AND name=?`, [indexName]
    );
    if (indexExists.length === 0) {
        console.log(`[Migration] Creating index ${indexName} on ${table}(${column})`);
        await database.execAsync(`CREATE INDEX IF NOT EXISTS ${indexName} ON ${table}(${column})`);
    }
}
