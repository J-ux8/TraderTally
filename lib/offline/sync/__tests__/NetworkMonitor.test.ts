import NetInfo from '@react-native-community/netinfo';
import { networkMonitor, NetworkType } from '../NetworkMonitor';

describe('NetworkMonitor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('isOnline()', () => {
    it('should return true when connected and internet is reachable', async () => {
      (NetInfo.fetch as jest.Mock).mockResolvedValue({
        isConnected: true,
        isInternetReachable: true,
      });

      const result = await networkMonitor.isOnline();
      expect(result).toBe(true);
    });

    it('should return true when connected and internet reachability is null', async () => {
      (NetInfo.fetch as jest.Mock).mockResolvedValue({
        isConnected: true,
        isInternetReachable: null,
      });

      const result = await networkMonitor.isOnline();
      expect(result).toBe(true);
    });

    it('should return false when not connected', async () => {
      (NetInfo.fetch as jest.Mock).mockResolvedValue({
        isConnected: false,
        isInternetReachable: false,
      });

      const result = await networkMonitor.isOnline();
      expect(result).toBe(false);
    });

    it('should return false when connected but internet is not reachable', async () => {
      (NetInfo.fetch as jest.Mock).mockResolvedValue({
        isConnected: true,
        isInternetReachable: false,
      });

      const result = await networkMonitor.isOnline();
      expect(result).toBe(false);
    });

    it('should return false when isConnected is null', async () => {
      (NetInfo.fetch as jest.Mock).mockResolvedValue({
        isConnected: null,
        isInternetReachable: true,
      });

      const result = await networkMonitor.isOnline();
      expect(result).toBe(false);
    });
  });

  describe('subscribe()', () => {
    it('should call callback when connectivity changes to online', () => {
      const callback = jest.fn();
      const mockUnsubscribe = jest.fn();
      
      let listener: ((state: any) => void) = jest.fn();
      (NetInfo.addEventListener as jest.Mock).mockImplementation((cb) => {
        listener = cb;
        return mockUnsubscribe;
      });

      const unsubscribe = networkMonitor.subscribe(callback);

      // Simulate connectivity change to online
      listener({
        isConnected: true,
        isInternetReachable: true,
      });

      expect(callback).toHaveBeenCalledWith(true);
      expect(callback).toHaveBeenCalledTimes(1);

      // Cleanup
      unsubscribe();
      expect(mockUnsubscribe).toHaveBeenCalled();
    });

    it('should call callback when connectivity changes to offline', () => {
      const callback = jest.fn();
      const mockUnsubscribe = jest.fn();
      
      let listener: ((state: any) => void) = jest.fn();
      (NetInfo.addEventListener as jest.Mock).mockImplementation((cb) => {
        listener = cb;
        return mockUnsubscribe;
      });

      networkMonitor.subscribe(callback);

      // Simulate connectivity change to offline
      listener({
        isConnected: false,
        isInternetReachable: false,
      });

      expect(callback).toHaveBeenCalledWith(false);
    });

    it('should call callback with false when internet is not reachable', () => {
      const callback = jest.fn();
      const mockUnsubscribe = jest.fn();
      
      let listener: ((state: any) => void) = jest.fn();
      (NetInfo.addEventListener as jest.Mock).mockImplementation((cb) => {
        listener = cb;
        return mockUnsubscribe;
      });

      networkMonitor.subscribe(callback);

      // Simulate connected but no internet
      listener({
        isConnected: true,
        isInternetReachable: false,
      });

      expect(callback).toHaveBeenCalledWith(false);
    });

    it('should return unsubscribe function that cleans up listener', () => {
      const callback = jest.fn();
      const mockUnsubscribe = jest.fn();
      
      (NetInfo.addEventListener as jest.Mock).mockReturnValue(mockUnsubscribe);

      const unsubscribe = networkMonitor.subscribe(callback);
      
      expect(typeof unsubscribe).toBe('function');
      
      unsubscribe();
      expect(mockUnsubscribe).toHaveBeenCalled();
    });

    it('should handle multiple subscribers independently', () => {
      const callback1 = jest.fn();
      const callback2 = jest.fn();
      const mockUnsubscribe1 = jest.fn();
      const mockUnsubscribe2 = jest.fn();
      
      let listener1: ((state: any) => void) = jest.fn();
      let listener2: ((state: any) => void) = jest.fn();
      
      (NetInfo.addEventListener as jest.Mock)
        .mockImplementationOnce((cb) => {
          listener1 = cb;
          return mockUnsubscribe1;
        })
        .mockImplementationOnce((cb) => {
          listener2 = cb;
          return mockUnsubscribe2;
        });

      const unsubscribe1 = networkMonitor.subscribe(callback1);
      const unsubscribe2 = networkMonitor.subscribe(callback2);

      // Trigger both listeners
      listener1({ isConnected: true, isInternetReachable: true });
      listener2({ isConnected: false, isInternetReachable: false });

      expect(callback1).toHaveBeenCalledWith(true);
      expect(callback2).toHaveBeenCalledWith(false);

      // Unsubscribe first listener
      unsubscribe1();
      expect(mockUnsubscribe1).toHaveBeenCalled();
      expect(mockUnsubscribe2).not.toHaveBeenCalled();

      // Unsubscribe second listener
      unsubscribe2();
      expect(mockUnsubscribe2).toHaveBeenCalled();
    });
  });

  describe('getNetworkType()', () => {
    it('should return "wifi" when connected via wifi', async () => {
      (NetInfo.fetch as jest.Mock).mockResolvedValue({
        isConnected: true,
        type: 'wifi',
      });

      const result = await networkMonitor.getNetworkType();
      expect(result).toBe('wifi');
    });

    it('should return "cellular" when connected via cellular', async () => {
      (NetInfo.fetch as jest.Mock).mockResolvedValue({
        isConnected: true,
        type: 'cellular',
      });

      const result = await networkMonitor.getNetworkType();
      expect(result).toBe('cellular');
    });

    it('should return "none" when not connected', async () => {
      (NetInfo.fetch as jest.Mock).mockResolvedValue({
        isConnected: false,
        type: 'none',
      });

      const result = await networkMonitor.getNetworkType();
      expect(result).toBe('none');
    });

    it('should return "unknown" for unknown connection types', async () => {
      (NetInfo.fetch as jest.Mock).mockResolvedValue({
        isConnected: true,
        type: 'bluetooth',
      });

      const result = await networkMonitor.getNetworkType();
      expect(result).toBe('unknown');
    });

    it('should return "unknown" for ethernet connection', async () => {
      (NetInfo.fetch as jest.Mock).mockResolvedValue({
        isConnected: true,
        type: 'ethernet',
      });

      const result = await networkMonitor.getNetworkType();
      expect(result).toBe('unknown');
    });

    it('should return "none" when isConnected is false regardless of type', async () => {
      (NetInfo.fetch as jest.Mock).mockResolvedValue({
        isConnected: false,
        type: 'wifi',
      });

      const result = await networkMonitor.getNetworkType();
      expect(result).toBe('none');
    });
  });

  describe('Edge cases', () => {
    it('should handle NetInfo.fetch rejection gracefully', async () => {
      (NetInfo.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      await expect(networkMonitor.isOnline()).rejects.toThrow('Network error');
    });

    it('should handle NetInfo.fetch rejection in getNetworkType', async () => {
      (NetInfo.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      await expect(networkMonitor.getNetworkType()).rejects.toThrow('Network error');
    });

    it('should handle listener errors gracefully', () => {
      const callback = jest.fn(() => {
        throw new Error('Callback error');
      });
      const mockUnsubscribe = jest.fn();
      
      let listener: ((state: any) => void) = jest.fn();
      (NetInfo.addEventListener as jest.Mock).mockImplementation((cb) => {
        listener = cb;
        return mockUnsubscribe;
      });

      networkMonitor.subscribe(callback);

      // This should not throw
      expect(() => {
        listener({ isConnected: true, isInternetReachable: true });
      }).toThrow('Callback error');
    });
  });
});
