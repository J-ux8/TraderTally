import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { supabase } from '../lib/supabase';

type NetworkCallback = (isOnline: boolean) => void;

/**
 * Monitors network status and verifies internet availability
 */
export class NetworkMonitor {
  private static isOnline: boolean = false;
  private static listeners: NetworkCallback[] = [];
  private static unsubscribe: (() => void) | null = null;
  private static heartbeatInterval: ReturnType<typeof setInterval> | null = null;

  /**
   * Start monitoring network status
   */
  static start() {
    if (this.unsubscribe) return;

    this.unsubscribe = NetInfo.addEventListener(state => {
      this.handleNetworkChange(state);
    });

    // Initial check
    NetInfo.fetch().then(state => {
      this.handleNetworkChange(state);
    });

    // Regular heartbeat to verify true internet access
    this.heartbeatInterval = setInterval(() => {
      this.verifyInternet();
    }, 30000); // Check every 30 seconds
  }

  /**
   * Stop monitoring (primarily for testing or cleanup if needed)
   */
  static stop() {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * Handle network state changes
   */
  private static async handleNetworkChange(state: NetInfoState) {
    const wasOnline = this.isOnline;
    this.isOnline = state.isConnected === true && state.isInternetReachable !== false;

    // Verify online status with a real request if it looks online
    if (this.isOnline) {
      await this.verifyInternet();
    }

    if (wasOnline !== this.isOnline) {
      this.notifyListeners();
      
      // Auto-trigger sync when coming back online
      if (this.isOnline) {
        console.log('[NetworkMonitor] Network recovered, triggering background sync...');
        const { SyncEngine } = require('./syncEngine');
        SyncEngine.syncAll().catch(() => {}); // Fire and forget
      }
    }
  }

  /**
   * Verify actual internet connection with a real HTTP probe to Supabase.
   * Uses `head: true` + `count` for minimum data transfer (no rows returned).
   * Distinguishes "server reached" (online) from "fetch failed" (offline).
   */
  static async verifyInternet(): Promise<boolean> {
    try {
      // Real HTTP request — lightweight: headers only, no rows returned
      const { error } = await supabase
        .from('profiles')
        .select('count', { count: 'exact', head: true });

      const wasOnline = this.isOnline;
      // Any server response (including 401/403) proves internet is reachable.
      // Only a network-level failure throws into the catch block.
      this.isOnline = true;

      if (wasOnline !== this.isOnline) {
        this.notifyListeners();
      }
      return true;
    } catch {
      // Network failure — definitely offline
      const wasOnline = this.isOnline;
      this.isOnline = false;

      if (wasOnline !== this.isOnline) {
        this.notifyListeners();
      }
      return false;
    }
  }

  /**
   * Get current online status
   */
  static getStatus(): boolean {
    return this.isOnline;
  }

  /**
   * Subscribe to network changes
   */
  static subscribe(callback: NetworkCallback): () => void {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback);
    };
  }

  private static notifyListeners() {
    this.listeners.forEach(callback => callback(this.isOnline));
  }
}
