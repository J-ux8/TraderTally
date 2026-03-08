import { useTransactionsContext } from '@/contexts/TransactionsContext';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import NetInfo from '@react-native-community/netinfo';

interface OfflineIndicatorProps {
  alwaysShow?: boolean; // Show even when synced
  compact?: boolean; // Smaller version
}

export function OfflineIndicator({ alwaysShow = false, compact = false }: OfflineIndicatorProps) {
  const { syncStatus, pendingCount } = useTransactionsContext();
  const [isOnline, setIsOnline] = useState(true);
  
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsOnline(state.isConnected ?? false);
    });
    return () => unsubscribe();
  }, []);
  
  // Don't show if synced and alwaysShow is false
  if (!alwaysShow && syncStatus === 'synced' && isOnline) return null;
  
  const getStatusInfo = () => {
    if (!isOnline) {
      return {
        icon: 'cloud-offline-outline' as const,
        text: compact ? 'Offline' : 'Offline Mode',
        style: styles.offline,
      };
    }
    
    if (syncStatus === 'syncing') {
      return {
        icon: 'cloud-upload-outline' as const,
        text: compact ? 'Syncing' : 'Syncing...',
        style: styles.syncing,
      };
    }
    
    if (syncStatus === 'pending' || pendingCount > 0) {
      return {
        icon: 'time-outline' as const,
        text: compact ? `${pendingCount}` : `${pendingCount} pending`,
        style: styles.pending,
      };
    }
    
    // Online and synced
    return {
      icon: 'cloud-done-outline' as const,
      text: compact ? 'Synced' : 'All synced',
      style: styles.synced,
    };
  };
  
  const status = getStatusInfo();
  
  return (
    <View style={[styles.container, status.style, compact && styles.compact]}>
      <Ionicons name={status.icon} size={compact ? 12 : 14} color="#fff" />
      <Text style={[styles.text, compact && styles.compactText]}>{status.text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 6,
  },
  compact: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  offline: { backgroundColor: '#dc2626' },
  pending: { backgroundColor: '#f59e0b' },
  syncing: { backgroundColor: '#3b82f6' },
  synced: { backgroundColor: '#10b981' },
  text: { 
    color: '#fff', 
    fontSize: 12, 
    fontWeight: '600' 
  },
  compactText: {
    fontSize: 11,
  },
});
