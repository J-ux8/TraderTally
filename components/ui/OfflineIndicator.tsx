import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface OfflineIndicatorProps {
  alwaysShow?: boolean;
  compact?: boolean;
}

export function OfflineIndicator({ alwaysShow = false, compact = false }: OfflineIndicatorProps) {
  // Online-only app - always show online status if alwaysShow is true
  if (!alwaysShow) return null;
  
  return (
    <View style={[styles.container, styles.online, compact && styles.compact]}>
      <Ionicons name="cloud-done-outline" size={compact ? 12 : 14} color="#fff" />
      <Text style={[styles.text, compact && styles.compactText]}>Online</Text>
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
