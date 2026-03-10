import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import NetInfo from '@react-native-community/netinfo';

interface OfflineIndicatorProps {
  alwaysShow?: boolean; // Show even when online
  compact?: boolean; // Smaller version
}

export function OfflineIndicator({ alwaysShow = false, compact = false }: OfflineIndicatorProps) {
  const [isOnline, setIsOnline] = useState(true);
  
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsOnline(state.isConnected ?? false);
    });
    return () => unsubscribe();
  }, []);
  
  // Don't show if online and alwaysShow is false
  if (!alwaysShow && isOnline) return null;
  
  const getStatusInfo = () => {
    if (!isOnline) {
      return {
        icon: 'cloud-offline-outline' as const,
        text: compact ? 'Offline' : 'Offline Mode',
        style: styles.offline,
      };
    }
    
    // Online
    return {
      icon: 'cloud-done-outline' as const,
      text: compact ? 'Online' : 'Online',
      style: styles.online,
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
  online: { backgroundColor: '#10b981' },
  text: { 
    color: '#fff', 
    fontSize: 12, 
    fontWeight: '600' 
  },
  compactText: {
    fontSize: 11,
  },
});
