import { useTransactionsContext } from '@/contexts/TransactionsContext';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export function OfflineIndicator() {
  const { syncStatus, pendingCount } = useTransactionsContext();
  
  if (syncStatus === 'synced') return null;
  
  return (
    <View style={[styles.container, styles[syncStatus]]}>
      {syncStatus === 'offline' && (
        <>
          <Ionicons name="cloud-offline-outline" size={14} color="#fff" />
          <Text style={styles.text}>Offline Mode</Text>
        </>
      )}
      {syncStatus === 'pending' && (
        <>
          <Ionicons name="time-outline" size={14} color="#fff" />
          <Text style={styles.text}>{pendingCount} pending sync</Text>
        </>
      )}
      {syncStatus === 'syncing' && (
        <>
          <Ionicons name="cloud-upload-outline" size={14} color="#fff" />
          <Text style={styles.text}>Syncing...</Text>
        </>
      )}
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
  offline: { backgroundColor: '#dc2626' },
  pending: { backgroundColor: '#f59e0b' },
  syncing: { backgroundColor: '#3b82f6' },
  synced: { backgroundColor: 'transparent' },
  text: { color: '#fff', fontSize: 12, fontWeight: '600' },
});
