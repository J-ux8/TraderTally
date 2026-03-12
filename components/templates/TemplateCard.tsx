import React from 'react';
import { TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import { Template } from '@/lib/templates';
import { TrendingUp, TrendingDown } from 'lucide-react-native';

interface TemplateCardProps {
  template: Template;
  onPress: (template: Template) => void;
  onLongPress: (template: Template) => void;
}

export const TemplateCard = React.memo(function TemplateCard({
  template,
  onPress,
  onLongPress,
}: TemplateCardProps) {
  const isSale = template.type === 'sale';
  const bgColor = isSale ? '#dcfce7' : '#fee2e2';
  const textColor = isSale ? '#166534' : '#991b1b';
  const iconColor = isSale ? '#22c55e' : '#ef4444';

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: bgColor }]}
      onPress={() => onPress(template)}
      onLongPress={() => onLongPress(template)}
      activeOpacity={0.7}
      delayLongPress={500}
    >
      <View style={styles.header}>
        <View style={styles.iconContainer}>
          {isSale ? (
            <TrendingUp size={16} color={iconColor} />
          ) : (
            <TrendingDown size={16} color={iconColor} />
          )}
        </View>
        <Text style={[styles.name, { color: textColor }]} numberOfLines={1}>
          {template.name}
        </Text>
      </View>
      <Text style={[styles.amount, { color: textColor }]}>
        K{template.default_amount.toFixed(2)}
      </Text>
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  card: {
    borderRadius: 12,
    padding: 12,
    marginRight: 8,
    minWidth: 140,
    minHeight: 80,
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconContainer: {
    width: 24,
    height: 24,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  name: {
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  amount: {
    fontSize: 14,
    fontWeight: '700',
    marginTop: 4,
  },
});
