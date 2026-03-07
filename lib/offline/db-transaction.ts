import * as SQLite from 'expo-sqlite';

/**
 * Crash-safe transaction wrapper for all offline mutations.
 * Enforces atomic local updates preventing partial data states on crash.
 */
export async function withTransaction<T>(
    db: SQLite.SQLiteDatabase,
    operation: () => Promise<T>
): Promise<T> {
    let result: T;
    try {
        await db.withTransactionAsync(async () => {
            result = await operation();
        });
        return result!;
    } catch (error) {
        console.error('[DB Transaction Error]', error);
        throw new Error('Database transaction failed. Changes rolled back securely.');
    }
}
