import * as SQLite from 'expo-sqlite';

const CURRENT_SCHEMA_VERSION = 3;

/**
 * Robust migration that ensures all tables have the required columns.
 * If a table is too far behind, it drops and recreates it.
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

        if (currentVersion >= CURRENT_SCHEMA_VERSION) {
            return; // Already up to date
        }

        console.log(`[Migration] Upgrading from version ${currentVersion} to ${CURRENT_SCHEMA_VERSION}`);

        // For a major schema change (v0 -> v3), it's safest to drop & recreate
        if (currentVersion < 2) {
            console.log('[Migration] Major schema upgrade - recreating tables...');
            await database.execAsync('DROP TABLE IF EXISTS transactions;');
            await database.execAsync('DROP TABLE IF EXISTS categories;');
            await database.execAsync('DROP TABLE IF EXISTS debts;');
            await database.execAsync('DROP TABLE IF EXISTS sync_metadata;');
            await database.execAsync('DROP TABLE IF EXISTS sync_logs;');
            // Don't drop security_settings - user preferences should persist
        } else {
            // Incremental migration: add missing columns
            await addColumnIfMissing(database, 'transactions', 'is_deleted', 'INTEGER DEFAULT 0');
            await addColumnIfMissing(database, 'transactions', 'sync_status', "TEXT DEFAULT 'pending'");
            await addColumnIfMissing(database, 'transactions', 'sync_version', 'INTEGER DEFAULT 1');
            await addColumnIfMissing(database, 'transactions', 'retry_count', 'INTEGER DEFAULT 0');

            await addColumnIfMissing(database, 'categories', 'is_deleted', 'INTEGER DEFAULT 0');
            await addColumnIfMissing(database, 'categories', 'sync_status', "TEXT DEFAULT 'pending'");
            await addColumnIfMissing(database, 'categories', 'sync_version', 'INTEGER DEFAULT 1');
            await addColumnIfMissing(database, 'categories', 'retry_count', 'INTEGER DEFAULT 0');

            await addColumnIfMissing(database, 'debts', 'is_deleted', 'INTEGER DEFAULT 0');
            await addColumnIfMissing(database, 'debts', 'sync_status', "TEXT DEFAULT 'pending'");
            await addColumnIfMissing(database, 'debts', 'sync_version', 'INTEGER DEFAULT 1');
            await addColumnIfMissing(database, 'debts', 'retry_count', 'INTEGER DEFAULT 0');

            await addColumnIfMissing(database, 'sync_metadata', 'last_sync_time', 'TEXT');
            await addColumnIfMissing(database, 'sync_metadata', 'last_push_time', 'TEXT');
        }

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
