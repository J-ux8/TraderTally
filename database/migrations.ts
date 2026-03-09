import * as SQLite from 'expo-sqlite';

const CURRENT_SCHEMA_VERSION = 7;

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

        // Add missing columns to sync_logs (version 6)
        // For sync_logs, we need to ensure all required columns exist
        // Since this is a new feature, it's safe to recreate the table if needed
        const syncLogsInfo = await database.getAllAsync(`PRAGMA table_info(sync_logs)`) as any[];
        const hasOperation = syncLogsInfo.some(col => col.name === 'operation');
        
        if (syncLogsInfo.length > 0 && !hasOperation) {
            // Table exists but missing operation column - recreate it
            console.log('[Migration] Recreating sync_logs table with correct schema...');
            await database.execAsync('DROP TABLE IF EXISTS sync_logs');
            // Table will be recreated by setupDatabase
        } else if (syncLogsInfo.length > 0) {
            // Add columns if table exists and has operation column
            await addColumnIfMissing(database, 'sync_logs', 'operation', 'TEXT NOT NULL DEFAULT ""');
            await addColumnIfMissing(database, 'sync_logs', 'status', 'TEXT NOT NULL DEFAULT ""');
            await addColumnIfMissing(database, 'sync_logs', 'device_id', 'TEXT NOT NULL DEFAULT ""');
        }

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
    } catch (error: any) {
        console.error("[Migration] Failed:", error);
        console.error("[Migration] Error details:", {
            message: error?.message,
            code: error?.code,
            cause: error?.cause
        });
        throw error;
    }
}

async function addColumnIfMissing(database: SQLite.SQLiteDatabase, table: string, column: string, type: string) {
    try {
        const tableExists = await database.getAllAsync(
            `SELECT name FROM sqlite_master WHERE type='table' AND name=?`, [table]
        );
        if (tableExists.length === 0) {
            console.log(`[Migration] Table ${table} doesn't exist yet, skipping column ${column}`);
            return; // Table doesn't exist yet, setupDatabase will create it
        }

        const info = await database.getAllAsync(`PRAGMA table_info(${table})`) as any[];
        const exists = info.some(col => col.name === column);
        if (!exists) {
            console.log(`[Migration] Adding column ${column} to ${table}`);
            await database.execAsync(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
        }
    } catch (error: any) {
        console.error(`[Migration] Error adding column ${column} to ${table}:`, error?.message);
        // Don't throw - continue with other migrations
    }
}

async function createIndexIfMissing(database: SQLite.SQLiteDatabase, indexName: string, table: string, column: string) {
    try {
        // Check if table exists first
        const tableExists = await database.getAllAsync(
            `SELECT name FROM sqlite_master WHERE type='table' AND name=?`, [table]
        );
        if (tableExists.length === 0) {
            console.log(`[Migration] Table ${table} doesn't exist yet, skipping index ${indexName}`);
            return; // Table doesn't exist yet, setupDatabase will create it
        }

        const indexExists = await database.getAllAsync(
            `SELECT name FROM sqlite_master WHERE type='index' AND name=?`, [indexName]
        );
        if (indexExists.length === 0) {
            console.log(`[Migration] Creating index ${indexName} on ${table}(${column})`);
            await database.execAsync(`CREATE INDEX IF NOT EXISTS ${indexName} ON ${table}(${column})`);
        }
    } catch (error: any) {
        console.error(`[Migration] Error creating index ${indexName}:`, error?.message);
        // Don't throw - continue with other migrations
    }
}
