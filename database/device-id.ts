import * as SQLite from 'expo-sqlite';
import * as Crypto from 'expo-crypto';

/**
 * Device ID management for sync system.
 * Generates and persists a unique device identifier on first launch.
 */

let cachedDeviceId: string | null = null;

/**
 * Get or generate device ID for this device.
 * Device ID is stored in sync_metadata table and cached in memory.
 * 
 * @param database - SQLite database instance
 * @param userId - User ID to associate with device
 * @returns Unique device identifier (UUID v4)
 */
export async function getOrCreateDeviceId(
  database: SQLite.SQLiteDatabase,
  userId: string
): Promise<string> {
  // Return cached value if available
  if (cachedDeviceId) {
    return cachedDeviceId;
  }

  try {
    // Try to get existing device_id from sync_metadata
    const result = await database.getFirstAsync(
      'SELECT device_id FROM sync_metadata WHERE user_id = ?',
      [userId]
    ) as { device_id: string } | null;

    if (result?.device_id) {
      cachedDeviceId = result.device_id;
      console.log('[DeviceID] Retrieved existing device ID');
      return cachedDeviceId;
    }

    // Generate new device ID
    const newDeviceId = Crypto.randomUUID();
    console.log('[DeviceID] Generated new device ID');

    // Store in sync_metadata
    await database.runAsync(
      `INSERT INTO sync_metadata (user_id, device_id) 
       VALUES (?, ?)
       ON CONFLICT(user_id) DO UPDATE SET device_id = EXCLUDED.device_id`,
      [userId, newDeviceId]
    );

    cachedDeviceId = newDeviceId;
    return cachedDeviceId;
  } catch (error) {
    console.error('[DeviceID] Error getting/creating device ID:', error);
    throw error;
  }
}

/**
 * Clear cached device ID (useful for testing or logout)
 */
export function clearDeviceIdCache(): void {
  cachedDeviceId = null;
}

/**
 * Validate that device_id exists for a user
 * 
 * @param database - SQLite database instance
 * @param userId - User ID to check
 * @returns true if device_id exists, false otherwise
 */
export async function hasDeviceId(
  database: SQLite.SQLiteDatabase,
  userId: string
): Promise<boolean> {
  try {
    const result = await database.getFirstAsync(
      'SELECT device_id FROM sync_metadata WHERE user_id = ? AND device_id IS NOT NULL',
      [userId]
    ) as { device_id: string } | null;

    return !!result?.device_id;
  } catch (error) {
    console.error('[DeviceID] Error checking device ID:', error);
    return false;
  }
}
