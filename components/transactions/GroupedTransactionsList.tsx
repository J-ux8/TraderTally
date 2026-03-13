/**
 * GroupedTransactionsList Component
 * 
 * Displays a list of transaction groups, replacing individual transaction items
 * with grouped summaries. Supports loading states, empty states, and pull-to-refresh.
 */

import React, { memo, useCallback } from 'react';
import { 
  View, 
  Text, 
  FlatList, 
  StyleSheet, 
  RefreshControl, 
  ActivityIndicator,
  ListRenderItem
} from 'react-native';
import { TransactionGroup } from '@/types/grouping';
import { GroupSummaryCard } from './GroupSummaryCard';
import { useTheme } from '@/contexts/ThemeContext';
import { useThemeColors } from '@/hooks/useThemeColors';

/**
 * Props for GroupedTransactionsList component
 */
export interface GroupedTransactionsListProps {
  groups: TransactionGroup[];
  onGroupPress: (group: TransactionGroup) => void;
  loading?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  emptyMessage?: string;
  showDates?: boolean;
  compact?: boolean;
  maxItems?: number; // Limit number of items to show
  scrollable?: boolean; // Whether to use FlatList (true) or simple View (false)
}

/**
 * GroupedTransactionsList component for displaying transaction groups
 */
export const GroupedTransactionsList = memo<GroupedTransactionsListProps>(({
  groups,
  onGroupPress,
  loading = false,
  refreshing = false,
  onRefresh,
  emptyMessage = "No transactions found",
  showDates = false,
  compact = false,
  maxItems,
  scrollable = true
}) => {
  const { theme } = useTheme();
  const colors = useThemeColors();

  // Limit groups if maxItems is specified
  const displayGroups = maxItems ? groups.slice(0, maxItems) : groups;

  // Render individual group item
  const renderGroupItem: ListRenderItem<TransactionGroup> = useCallback(({ item, index }) => (
    <GroupSummaryCard
      group={item}
      onPress={() => onGroupPress(item)}
      showDate={showDates}
      compact={compact}
      style={index === 0 ? styles.firstItem : undefined}
    />
  ), [onGroupPress, showDates, compact]);

  // Key extractor for FlatList
  const keyExtractor = useCallback((item: TransactionGroup) => item.id, []);

  // Get item layout for performance optimization
  const getItemLayout = useCallback((data: any, index: number) => ({
    length: compact ? 60 : 80, // Estimated item height
    offset: (compact ? 60 : 80) * index,
    index,
  }), [compact]);

  // Dynamic colors based on theme
  const backgroundColor = theme === 'dark' ? '#0f172a' : '#f8fafc';
  const textColor = theme === 'dark' ? '#e2e8f0' : '#1e293b';
  const textSecondary = theme === 'dark' ? '#94a3b8' : '#64748b';

  // Loading state
  if (loading && groups.length === 0) {
    return (
      <View style={[styles.centerContainer, { backgroundColor }]}>
        <ActivityIndicator size="large" color={colors.primaryColor} />
        <Text style={[styles.loadingText, { color: textSecondary }]}>
          Loading transactions...
        </Text>
      </View>
    );
  }

  // Empty state
  if (!loading && groups.length === 0) {
    return (
      <View style={[styles.centerContainer, { backgroundColor }]}>
        <Text style={[styles.emptyText, { color: textColor }]}>
          {emptyMessage}
        </Text>
        <Text style={[styles.emptySubtext, { color: textSecondary }]}>
          Your transactions will appear here once you start recording them.
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor }]}>
      {/* Header with summary info */}
      {!compact && groups.length > 0 && (
        <View style={styles.header}>
          <Text style={[styles.headerText, { color: textColor }]}>
            {groups.length} {groups.length === 1 ? 'group' : 'groups'}
          </Text>
          <Text style={[styles.headerSubtext, { color: textSecondary }]}>
            {groups.reduce((sum, group) => sum + group.transactionCount, 0)} total transactions
          </Text>
        </View>
      )}

      {/* Groups list - use FlatList for scrollable, View for non-scrollable */}
      {scrollable ? (
        <FlatList
          data={displayGroups}
          renderItem={renderGroupItem}
          keyExtractor={keyExtractor}
          getItemLayout={getItemLayout}
          showsVerticalScrollIndicator={false}
          refreshControl={
            onRefresh ? (
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={[colors.primaryColor]}
                tintColor={colors.primaryColor}
              />
            ) : undefined
          }
          contentContainerStyle={[
            styles.listContent,
            groups.length === 0 && styles.emptyListContent
          ]}
          removeClippedSubviews={true}
          maxToRenderPerBatch={10}
          windowSize={10}
          initialNumToRender={8}
          disableVirtualization={false}
        />
      ) : (
        <View style={styles.listContent}>
          {displayGroups.map((item, index) => (
            <GroupSummaryCard
              key={item.id}
              group={item}
              onPress={() => onGroupPress(item)}
              showDate={showDates}
              compact={compact}
              style={index === 0 ? styles.firstItem : undefined}
            />
          ))}
        </View>
      )}

      {/* Show more indicator if items are limited */}
      {maxItems && groups.length > maxItems && (
        <View style={styles.showMoreContainer}>
          <Text style={[styles.showMoreText, { color: textSecondary }]}>
            +{groups.length - maxItems} more groups
          </Text>
        </View>
      )}
    </View>
  );
});

GroupedTransactionsList.displayName = 'GroupedTransactionsList';

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0, 0, 0, 0.05)',
  },
  headerText: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 2,
  },
  headerSubtext: {
    fontSize: 12,
    fontWeight: '400',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  emptyListContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  firstItem: {
    marginTop: 4,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  showMoreContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.05)',
  },
  showMoreText: {
    fontSize: 12,
    fontWeight: '500',
  },
});

export default GroupedTransactionsList;