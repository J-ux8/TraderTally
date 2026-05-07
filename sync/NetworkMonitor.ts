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
   * Verify actual internet connection by pinging Supabase
   */
  static async verifyInternet(): Promise<boolean> {
    try {
      // Lightweight request - just get user info from cache/local or tiny check
      const { error } = await supabase.auth.getSession();
      
      const wasOnline = this.isOnline;
      this.isOnline = !error; // Error usually means network issues or auth issues

      if (wasOnline !== this.isOnline) {
        this.notifyListeners();
      }
      return this.isOnline;
    } catch (e) {
      this.isOnline = false;
      this.notifyListeners();
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
