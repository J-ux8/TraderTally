import NetInfo, { NetInfoState, NetInfoStateType } from '@react-native-community/netinfo';

/**
 * NetworkMonitor - Monitors network connectivity using React Native NetInfo
 * 
 * Provides real-time network connectivity status for the sync engine.
 * Detects connectivity changes and network type (wifi/cellular/none).
 * 
 * Requirements: 3.1, 3.5, 20.3
 */

export type NetworkType = 'wifi' | 'cellular' | 'none' | 'unknown';

export interface NetworkMonitor {
  /**
   * Check current connectivity status
   * @returns Promise resolving to true if online, false otherwise
   */
  isOnline(): Promise<boolean>;

  /**
   * Subscribe to connectivity changes
   * @param callback Function called when connectivity changes
   * @returns Unsubscribe function
   */
  subscribe(callback: (isOnline: boolean) => void): () => void;

  /**
   * Get current network type
   * @returns Promise resolving to network type
   */
  getNetworkType(): Promise<NetworkType>;
}

class NetworkMonitorImpl implements NetworkMonitor {
  /**
   * Check if device is currently online
   * Requirements: 3.1, 20.3
   */
  async isOnline(): Promise<boolean> {
    const state = await NetInfo.fetch();
    return state.isConnected === true && state.isInternetReachable !== false;
  }

  /**
   * Subscribe to network connectivity changes
   * Requirements: 3.5
   */
  subscribe(callback: (isOnline: boolean) => void): () => void {
    const unsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
      const isOnline = state.isConnected === true && state.isInternetReachable !== false;
      callback(isOnline);
    });

    return unsubscribe;
  }

  /**
   * Get current network connection type
   * Requirements: 3.1
   */
  async getNetworkType(): Promise<NetworkType> {
    const state = await NetInfo.fetch();
    
    if (!state.isConnected) {
      return 'none';
    }

    return this.mapNetInfoType(state.type);
  }

  /**
   * Map NetInfo type to our NetworkType
   */
  private mapNetInfoType(type: NetInfoStateType): NetworkType {
    switch (type) {
      case 'wifi':
        return 'wifi';
      case 'cellular':
        return 'cellular';
      case 'none':
        return 'none';
      default:
        return 'unknown';
    }
  }
}

// Export singleton instance
export const networkMonitor = new NetworkMonitorImpl();
