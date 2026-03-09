import NetInfo from '@react-native-community/netinfo';
import { networkMonitor } from '../NetworkMonitor';

/**
 * Integration tests for NetworkMonitor
 * 
 * These tests verify the NetworkMonitor works correctly with NetInfo
 * in realistic scenarios including connectivity changes and network type detection.
 * 
 * Requirements: 3.1, 3.5, 20.3
 */

describe('NetworkMonitor Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Connectivity state transitions', () => {
    it('should detect transition from offline to online', async () => {
      // Start offline
      (NetInfo.fetch as jest.Mock).mockResolvedValueOnce({
        isConnected: false,
        isInternetReachable: false,
      });

      let isOnline = await networkMonitor.isOnline();
      expect(isOnline).toBe(false);

      // Transition to online
      (NetInfo.fetch as jest.Mock).mockResolvedValueOnce({
        isConnected: true,
        isInternetReachable: true,
      });

      isOnline = await networkMonitor.isOnline();
      expect(isOnline).toBe(true);
    });

    it('should detect transition from online to offline', async () => {
      // Start online
      (NetInfo.fetch as jest.Mock).mockResolvedValueOnce({
        isConnected: true,
        isInternetReachable: true,
      });

      let isOnline = await networkMonitor.isOnline();
      expect(isOnline).toBe(true);

      // Transition to offline
      (NetInfo.fetch as jest.Mock).mockResolvedValueOnce({
        isConnected: false,
        isInternetReachable: false,
      });

      isOnline = await networkMonitor.isOnline();
      expect(isOnline).toBe(false);
    });

    it('should handle connectivity listener receiving multiple state changes', (done) => {
      const states: boolean[] = [];
      const mockUnsubscribe = jest.fn();
      
      let listener: ((state: any) => void) = jest.fn();
      (NetInfo.addEventListener as jest.Mock).mockImplementation((cb) => {
        listener = cb;
        return mockUnsubscribe;
      });

      const unsubscribe = networkMonitor.subscribe((isOnline) => {
        states.push(isOnline);
        
        if (states.length === 3) {
          expect(states).toEqual([true, false, true]);
          unsubscribe();
          done();
        }
      });

      // Simulate state changes
      listener({ isConnected: true, isInternetReachable: true });
      listener({ isConnected: false, isInternetReachable: false });
      listener({ isConnected: true, isInternetReachable: true });
    });
  });

  describe('Network type detection scenarios', () => {
    it('should detect wifi connection', async () => {
      (NetInfo.fetch as jest.Mock).mockResolvedValue({
        isConnected: true,
        type: 'wifi',
      });

      const [isOnline, networkType] = await Promise.all([
        networkMonitor.isOnline(),
        networkMonitor.getNetworkType(),
      ]);

      expect(isOnline).toBe(true);
      expect(networkType).toBe('wifi');
    });

    it('should detect cellular connection', async () => {
      (NetInfo.fetch as jest.Mock).mockResolvedValue({
        isConnected: true,
        type: 'cellular',
      });

      const [isOnline, networkType] = await Promise.all([
        networkMonitor.isOnline(),
        networkMonitor.getNetworkType(),
      ]);

      expect(isOnline).toBe(true);
      expect(networkType).toBe('cellular');
    });

    it('should handle transition from wifi to cellular', async () => {
      // Start with wifi
      (NetInfo.fetch as jest.Mock).mockResolvedValueOnce({
        isConnected: true,
        type: 'wifi',
      });

      let networkType = await networkMonitor.getNetworkType();
      expect(networkType).toBe('wifi');

      // Switch to cellular
      (NetInfo.fetch as jest.Mock).mockResolvedValueOnce({
        isConnected: true,
        type: 'cellular',
      });

      networkType = await networkMonitor.getNetworkType();
      expect(networkType).toBe('cellular');
    });
  });

  describe('Sync engine integration scenarios', () => {
    it('should support sync engine checking connectivity before upload', async () => {
      (NetInfo.fetch as jest.Mock).mockResolvedValue({
        isConnected: true,
        isInternetReachable: true,
      });

      // Simulate sync engine checking connectivity
      const canSync = await networkMonitor.isOnline();
      expect(canSync).toBe(true);

      // Sync engine would proceed with upload
    });

    it('should support sync engine skipping upload when offline', async () => {
      (NetInfo.fetch as jest.Mock).mockResolvedValue({
        isConnected: false,
        isInternetReachable: false,
      });

      // Simulate sync engine checking connectivity
      const canSync = await networkMonitor.isOnline();
      expect(canSync).toBe(false);

      // Sync engine would skip upload and mark records as offline
    });

    it('should support sync engine listening for reconnection', (done) => {
      const mockUnsubscribe = jest.fn();
      
      let listener: ((state: any) => void) = jest.fn();
      (NetInfo.addEventListener as jest.Mock).mockImplementation((cb) => {
        listener = cb;
        return mockUnsubscribe;
      });

      // Sync engine subscribes to connectivity changes
      const unsubscribe = networkMonitor.subscribe((isOnline) => {
        if (isOnline) {
          // Sync engine would trigger sync on reconnection
          expect(isOnline).toBe(true);
          unsubscribe();
          done();
        }
      });

      // Simulate network reconnection
      listener({ isConnected: true, isInternetReachable: true });
    });
  });

  describe('Real-world connectivity scenarios', () => {
    it('should handle airplane mode scenario', async () => {
      // Airplane mode: no connection
      (NetInfo.fetch as jest.Mock).mockResolvedValue({
        isConnected: false,
        type: 'none',
      });

      const [isOnline, networkType] = await Promise.all([
        networkMonitor.isOnline(),
        networkMonitor.getNetworkType(),
      ]);

      expect(isOnline).toBe(false);
      expect(networkType).toBe('none');
    });

    it('should handle captive portal scenario (connected but no internet)', async () => {
      // Connected to wifi but captive portal blocks internet
      (NetInfo.fetch as jest.Mock).mockResolvedValue({
        isConnected: true,
        isInternetReachable: false,
        type: 'wifi',
      });

      const [isOnline, networkType] = await Promise.all([
        networkMonitor.isOnline(),
        networkMonitor.getNetworkType(),
      ]);

      expect(isOnline).toBe(false); // Should be offline due to no internet
      expect(networkType).toBe('wifi'); // But network type is still wifi
    });

    it('should handle poor connectivity scenario', async () => {
      // Connected but internet reachability unknown (null)
      (NetInfo.fetch as jest.Mock).mockResolvedValue({
        isConnected: true,
        isInternetReachable: null,
        type: 'cellular',
      });

      const isOnline = await networkMonitor.isOnline();
      
      // Should be optimistic when reachability is unknown
      expect(isOnline).toBe(true);
    });
  });

  describe('Multiple subscribers scenario', () => {
    it('should notify all subscribers of connectivity changes', (done) => {
      const mockUnsubscribe = jest.fn();
      const subscriber1States: boolean[] = [];
      const subscriber2States: boolean[] = [];
      
      let listener1: ((state: any) => void) = jest.fn();
      let listener2: ((state: any) => void) = jest.fn();
      
      (NetInfo.addEventListener as jest.Mock)
        .mockImplementationOnce((cb) => {
          listener1 = cb;
          return mockUnsubscribe;
        })
        .mockImplementationOnce((cb) => {
          listener2 = cb;
          return mockUnsubscribe;
        });

      const unsubscribe1 = networkMonitor.subscribe((isOnline) => {
        subscriber1States.push(isOnline);
      });

      const unsubscribe2 = networkMonitor.subscribe((isOnline) => {
        subscriber2States.push(isOnline);
        
        if (subscriber2States.length === 2) {
          expect(subscriber1States).toEqual([true, false]);
          expect(subscriber2States).toEqual([true, false]);
          unsubscribe1();
          unsubscribe2();
          done();
        }
      });

      // Simulate state changes
      listener1({ isConnected: true, isInternetReachable: true });
      listener2({ isConnected: true, isInternetReachable: true });
      
      listener1({ isConnected: false, isInternetReachable: false });
      listener2({ isConnected: false, isInternetReachable: false });
    });
  });

  describe('Performance and reliability', () => {
    it('should handle rapid consecutive isOnline() calls', async () => {
      (NetInfo.fetch as jest.Mock).mockResolvedValue({
        isConnected: true,
        isInternetReachable: true,
      });

      // Simulate rapid calls
      const results = await Promise.all([
        networkMonitor.isOnline(),
        networkMonitor.isOnline(),
        networkMonitor.isOnline(),
        networkMonitor.isOnline(),
        networkMonitor.isOnline(),
      ]);

      expect(results).toEqual([true, true, true, true, true]);
      expect(NetInfo.fetch).toHaveBeenCalledTimes(5);
    });

    it('should handle rapid consecutive getNetworkType() calls', async () => {
      (NetInfo.fetch as jest.Mock).mockResolvedValue({
        isConnected: true,
        type: 'wifi',
      });

      // Simulate rapid calls
      const results = await Promise.all([
        networkMonitor.getNetworkType(),
        networkMonitor.getNetworkType(),
        networkMonitor.getNetworkType(),
      ]);

      expect(results).toEqual(['wifi', 'wifi', 'wifi']);
      expect(NetInfo.fetch).toHaveBeenCalledTimes(3);
    });
  });
});
