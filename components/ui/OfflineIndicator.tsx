import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSync } from '@/context/SyncContext';

interface OfflineIndicatorProps {
  alwaysShow?: boolean;
  compact?: boolean;
}

export function OfflineIndicator({ alwaysShow = false, compact = false }: OfflineIndicatorProps) {
  const { syncStatus, lastSyncedAt } = useSync();

  // If synced and not forced to show, stay hidden
  if (!alwaysShow && syncStatus === 'synced') return null;

  const getStatusConfig = () => {
    switch (syncStatus) {
      case 'offline':
        return {
          icon: 'cloud-offline-outline' as any,
          label: 'Offline',
          color: '#ef4444',
        };
      case 'syncing':
        return {
          icon: 'sync-outline' as any,
          label: 'Syncing...',
          color: '#3b82f6',
        };
      case 'failed':
        return {
          icon: 'alert-circle-outline' as any,
          label: 'Sync Failed',
          color: '#f59e0b',
        };
      default:
        return {
          icon: 'cloud-done-outline' as any,
          label: 'Synced',
          color: '#10b981',
        };
    }
  };

  const config = getStatusConfig();
  
  const formatTime = (isoString: string | null) => {
    if (!isoString) return '';
    const date = new Date(isoString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <View style={[styles.container, { backgroundColor: config.color }, compact && styles.compact]}>
      <Ionicons 
        name={config.icon} 
        size={compact ? 12 : 14} 
        color="#fff" 
        style={syncStatus === 'syncing' ? styles.rotating : undefined} 
      />
      <View>
        <Text style={[styles.text, compact && styles.compactText]}>
          {config.label}
        </Text>
        {!compact && lastSyncedAt && syncStatus === 'synced' && (
          <Text style={styles.timeText}>
            Updated {formatTime(lastSyncedAt)}
          </Text>
        )}
      </View>
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
    gap: 8,
  },
  compact: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  text: { 
    color: '#fff', 
    fontSize: 12, 
    fontWeight: '700',
    letterSpacing: 0.1,
  },
  compactText: {
    fontSize: 10,
  },
  timeText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 10,
    fontWeight: '400',
  },
  rotating: {
    // Rotation animation would be nice here if we add Reanimated, 
    // but for now, simple icon is fine.
  }
});
