/**
 * Debug/Monitoring Screen
 * 
 * Shows error logging statistics and recent errors
 * This is a developer/support tool for monitoring app health
 */

import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, Button, StyleSheet, ActivityIndicator, FlatList } from 'react-native';
import { useErrorMonitoring } from '@/context/ErrorMonitoringContext';
import { NetworkMonitor } from '@/sync/NetworkMonitor';

interface ErrorEntry {
  id: string;
  message: string;
  timestamp: string;
  level: string;
  context?: any;
}

export default function DebugScreen() {
  const {
    status,
    getErrorHistory,
    getQueuedErrors,
    clearHistory,
    processQueue,
    setUserContext,
  } = useErrorMonitoring();

  const [errors, setErrors] = useState<ErrorEntry[]>([]);
  const [queuedErrors, setQueuedErrors] = useState<ErrorEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [isOnline, setIsOnline] = useState(NetworkMonitor.getStatus());

  // Load error history on mount
  useEffect(() => {
    loadErrorHistory();
  }, []);

  // Refresh every 5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      loadErrorHistory();
      setIsOnline(NetworkMonitor.getStatus());
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const loadErrorHistory = async () => {
    try {
      const errorData = await getErrorHistory(20);
      const queueData = await getQueuedErrors(20);
      setErrors(errorData);
      setQueuedErrors(queueData);
    } catch (error) {
      console.error('[DebugScreen] Failed to load errors:', error);
    }
  };

  const handleClearHistory = async () => {
    try {
      setLoading(true);
      await clearHistory();
      await loadErrorHistory();
    } catch (error) {
      console.error('[DebugScreen] Failed to clear history:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleProcessQueue = async () => {
    try {
      setLoading(true);
      await processQueue();
      await loadErrorHistory();
    } catch (error) {
      console.error('[DebugScreen] Failed to process queue:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    try {
      setLoading(true);
      await loadErrorHistory();
    } finally {
      setLoading(false);
    }
  };

  const renderErrorItem = (item: ErrorEntry) => (
    <View style={styles.errorItem}>
      <View style={styles.errorHeader}>
        <Text style={[styles.level, { color: item.level === 'error' ? '#ef4444' : '#f59e0b' }]}>
          {item.level.toUpperCase()}
        </Text>
        <Text style={styles.timestamp}>{new Date(item.timestamp).toLocaleTimeString()}</Text>
      </View>
      <Text style={styles.message} numberOfLines={2}>{item.message}</Text>
      {item.context && (
        <Text style={styles.context}>{JSON.stringify(item.context).substring(0, 100)}...</Text>
      )}
    </View>
  );

  const renderQueueItem = (item: ErrorEntry) => (
    <View style={styles.queueItem}>
      <Text style={styles.queueMessage} numberOfLines={2}>{item.message}</Text>
      <Text style={styles.queueTime}>{new Date(item.timestamp).toLocaleTimeString()}</Text>
    </View>
  );

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>🔍 Error Monitoring Dashboard</Text>
      </View>

      {/* Status Card */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>System Status</Text>

        <View style={styles.statusRow}>
          <Text style={styles.label}>Error Logging:</Text>
          <Text style={status.enabled ? styles.enabled : styles.disabled}>
            {status.enabled ? '✅ Enabled' : '❌ Disabled'}
          </Text>
        </View>

        <View style={styles.statusRow}>
          <Text style={styles.label}>Network:</Text>
          <Text style={isOnline ? styles.enabled : styles.disabled}>
            {isOnline ? '🟢 Online' : '🔴 Offline'}
          </Text>
        </View>

        <View style={styles.statusRow}>
          <Text style={styles.label}>Total Errors:</Text>
          <Text style={styles.value}>{status.errorCount}</Text>
        </View>

        <View style={styles.statusRow}>
          <Text style={styles.label}>Queued (Pending):</Text>
          <Text style={status.unsentErrorCount > 0 ? styles.warning : styles.value}>
            {status.unsentErrorCount}
          </Text>
        </View>

        <View style={styles.statusRow}>
          <Text style={styles.label}>Queue Size:</Text>
          <Text style={styles.value}>{status.queueSize}</Text>
        </View>
      </View>

      {/* Action Buttons */}
      <View style={styles.buttonGroup}>
        <Button
          title={loading ? 'Loading...' : '🔄 Refresh'}
          onPress={handleRefresh}
          disabled={loading}
          color="#3b82f6"
        />
        <Button
          title={loading ? 'Processing...' : '📤 Process Queue'}
          onPress={handleProcessQueue}
          disabled={loading || !isOnline}
          color="#10b981"
        />
      </View>

      <View style={styles.buttonGroup}>
        <Button
          title={loading ? 'Clearing...' : '🗑️ Clear History'}
          onPress={handleClearHistory}
          disabled={loading}
          color="#ef4444"
        />
      </View>

      {/* Queued Errors Section */}
      {queuedErrors.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>📤 Queued Errors ({queuedErrors.length})</Text>
          <Text style={styles.cardSubtitle}>Waiting to be sent</Text>
          <FlatList
            scrollEnabled={false}
            data={queuedErrors.slice(0, 5)}
            renderItem={({ item }) => renderQueueItem(item)}
            keyExtractor={(item) => item.id}
          />
          {queuedErrors.length > 5 && (
            <Text style={styles.moreItems}>... and {queuedErrors.length - 5} more</Text>
          )}
        </View>
      )}

      {/* Recent Errors Section */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>📋 Recent Errors ({errors.length})</Text>
        {errors.length === 0 ? (
          <Text style={styles.noErrors}>No errors logged yet ✅</Text>
        ) : (
          <>
            <FlatList
              scrollEnabled={false}
              data={errors.slice(0, 10)}
              renderItem={({ item }) => renderErrorItem(item)}
              keyExtractor={(item) => item.id}
            />
            {errors.length > 10 && (
              <Text style={styles.moreItems}>... and {errors.length - 10} more</Text>
            )}
          </>
        )}
      </View>

      {/* Info Section */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>ℹ️ About This Screen</Text>
        <Text style={styles.infoText}>
          • This dashboard shows error logging statistics{'\n'}
          • Errors are logged automatically when they occur{'\n'}
          • Queued errors are sent when online{'\n'}
          • Use "Process Queue" to manually send now{'\n'}
          • Refresh data every 5 seconds automatically{'\n'}
          • This screen is for debugging only
        </Text>
      </View>

      <View style={styles.spacer} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f3f4f6',
    padding: 16,
  },
  header: {
    marginBottom: 20,
    paddingTop: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2937',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 12,
  },
  cardSubtitle: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 8,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  label: {
    fontSize: 14,
    color: '#4b5563',
    fontWeight: '500',
  },
  value: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
  },
  enabled: {
    fontSize: 14,
    fontWeight: '600',
    color: '#10b981',
  },
  disabled: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ef4444',
  },
  warning: {
    fontSize: 14,
    fontWeight: '600',
    color: '#f59e0b',
  },
  buttonGroup: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
    gap: 8,
  },
  errorItem: {
    backgroundColor: '#fef2f2',
    borderLeftWidth: 4,
    borderLeftColor: '#ef4444',
    padding: 12,
    marginBottom: 8,
    borderRadius: 8,
  },
  errorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  level: {
    fontSize: 12,
    fontWeight: '600',
  },
  timestamp: {
    fontSize: 12,
    color: '#6b7280',
  },
  message: {
    fontSize: 13,
    color: '#1f2937',
    fontWeight: '500',
    marginBottom: 4,
  },
  context: {
    fontSize: 11,
    color: '#6b7280',
    fontStyle: 'italic',
  },
  queueItem: {
    backgroundColor: '#fef3c7',
    borderLeftWidth: 4,
    borderLeftColor: '#f59e0b',
    padding: 12,
    marginBottom: 8,
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  queueMessage: {
    fontSize: 13,
    color: '#1f2937',
    fontWeight: '500',
    flex: 1,
    marginRight: 8,
  },
  queueTime: {
    fontSize: 11,
    color: '#6b7280',
  },
  noErrors: {
    fontSize: 14,
    color: '#10b981',
    fontWeight: '500',
    textAlign: 'center',
    paddingVertical: 16,
  },
  moreItems: {
    fontSize: 12,
    color: '#6b7280',
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 8,
  },
  infoText: {
    fontSize: 13,
    color: '#4b5563',
    lineHeight: 20,
  },
  spacer: {
    height: 40,
  },
});
