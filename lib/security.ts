import * as Crypto from 'expo-crypto';
import * as LocalAuthentication from 'expo-local-authentication';
import { getDatabase } from './database';

export interface SecuritySettings {
    appLockEnabled: boolean;
    biometricEnabled: boolean;
    hasPin: boolean;
}

export async function getSecuritySettings(userId: string): Promise<SecuritySettings> {
    const db = await getDatabase();
    const row = await db.getFirstAsync(`
    SELECT * FROM security_settings WHERE user_id = ?
  `, [userId]) as any;

    if (!row) {
        return { appLockEnabled: false, biometricEnabled: false, hasPin: false };
    }

    return {
        appLockEnabled: row.app_lock_enabled === 1,
        biometricEnabled: row.biometric_enabled === 1,
        hasPin: !!row.pin_hash,
    };
}

export async function setPin(userId: string, pin: string) {
    const db = await getDatabase();
    const hash = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        pin
    );

    await db.runAsync(`
    INSERT OR REPLACE INTO security_settings (user_id, app_lock_enabled, pin_hash)
    VALUES (?, 1, ?)
  `, [userId, hash]);
}

export async function verifyPin(userId: string, pin: string): Promise<boolean> {
    const db = await getDatabase();
    const hash = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        pin
    );

    const row = await db.getFirstAsync(`
    SELECT pin_hash FROM security_settings WHERE user_id = ?
  `, [userId]) as any;

    return row?.pin_hash === hash;
}

export async function toggleBiometric(userId: string, enabled: boolean) {
    const db = await getDatabase();
    await db.runAsync(`
    UPDATE security_settings SET biometric_enabled = ? WHERE user_id = ?
  `, [enabled ? 1 : 0, userId]);
}

export async function authenticateBiometric(): Promise<boolean> {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const isEnrolled = await LocalAuthentication.isEnrolledAsync();

    if (!hasHardware || !isEnrolled) return false;

    const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Unlock MobiBooks',
        fallbackLabel: 'Use PIN',
    });

    return result.success;
}

export async function disableAppLock(userId: string) {
    const db = await getDatabase();
    await db.runAsync(`
    UPDATE security_settings SET app_lock_enabled = 0 WHERE user_id = ?
  `, [userId]);
}
