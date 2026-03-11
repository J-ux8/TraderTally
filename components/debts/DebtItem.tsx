import { Debt } from '@/lib/debts';
import { AlertCircle, Calendar, CheckCircle2, MessageSquare, User } from 'lucide-react-native';
import React from 'react';
import { Alert, Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

interface DebtItemProps {
  debt: Debt;
  onSettle?: () => void;
  onClick: () => void;
  businessName?: string;
}

export const DebtItem = React.memo(function DebtItem({ debt, onSettle, onClick, businessName }: DebtItemProps) {
  const isOverdue = debt.due_date && !debt.is_settled && new Date(debt.due_date) < new Date();
  const dueDate = debt.due_date ? new Date(debt.due_date) : null;

  const formatDate = (date: Date) => {
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    }
    if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    }

    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    return `${days[date.getDay()]}, ${months[date.getMonth()]} ${date.getDate()}`;
  };

  const handleRemind = async () => {
    const amount = Number(debt.amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const formattedDueDate = dueDate ? formatDate(dueDate) : 'soon';
    const business = businessName || 'MobiBooks';

    const message = `Hi ${debt.customer_name}, this is a friendly reminder that you have an outstanding balance of K ${amount} at ${business}. Due date: ${formattedDueDate}. Thank you! 🙏`;

    const encodedMessage = encodeURIComponent(message);
    const whatsappUrl = `whatsapp://send?text=${encodedMessage}`;
    const smsUrl = `sms:?body=${encodedMessage}`;

    try {
      const canOpenWhatsApp = await Linking.canOpenURL(whatsappUrl);
      if (canOpenWhatsApp) {
        await Linking.openURL(whatsappUrl);
      } else {
        await Linking.openURL(smsUrl);
      }
    } catch (error) {
      Alert.alert('Error', 'Could not open messaging app');
    }
  };

  return (
    <TouchableOpacity
      style={[styles.container, debt.is_settled ? styles.containerSettled : undefined]}
      onPress={onClick}
      activeOpacity={0.7}
    >
      <View style={styles.content}>
        <View style={styles.header}>
          <View style={styles.customerInfo}>
            <View style={[styles.iconContainer, debt.is_settled ? styles.iconContainerSettled : undefined]}>
              <User size={20} color={debt.is_settled ? "#999" : "#1e3a8a"} />
            </View>
            <View style={styles.customerDetails}>
              <Text style={[styles.customerName, debt.is_settled ? styles.customerNameSettled : undefined]}>
                {debt.customer_name}
              </Text>
              {dueDate && (
                <View style={styles.dateContainer}>
                  <Calendar size={14} color="#999" />
                  <Text style={[styles.dateText, isOverdue ? styles.dateTextOverdue : undefined]}>
                    {formatDate(dueDate)}
                  </Text>
                </View>
              )}
            </View>
          </View>
          <View style={styles.amountContainer}>
            <Text style={[styles.amount, debt.is_settled ? styles.amountSettled : undefined]}>
              K {Number(debt.amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </Text>
            {isOverdue && !debt.is_settled && (
              <View style={styles.overdueBadge}>
                <AlertCircle size={12} color="#ef4444" />
                <Text style={styles.overdueText}>Overdue</Text>
              </View>
            )}
            {debt.is_settled && (
              <View style={styles.settledBadge}>
                <CheckCircle2 size={14} color="#1e3a8a" />
                <Text style={styles.settledText}>Settled</Text>
              </View>
            )}
          </View>
        </View>
        {debt.note && (
          <Text style={[styles.note, debt.is_settled ? styles.noteSettled : undefined]} numberOfLines={2}>
            {debt.note}
          </Text>
        )}

      </View>
      {!debt.is_settled && (
        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.remindButton}
            onPress={(e) => {
              e.stopPropagation();
              handleRemind();
            }}
            activeOpacity={0.7}
          >
            <MessageSquare size={18} color="#f59e0b" />
            <Text style={styles.remindButtonText}>Remind</Text>
          </TouchableOpacity>

          {onSettle && (
            <TouchableOpacity
              style={styles.settleButton}
              onPress={(e) => {
                e.stopPropagation();
                onSettle();
              }}
              activeOpacity={0.7}
            >
              <CheckCircle2 size={18} color="#1e3a8a" />
              <Text style={styles.settleButtonText}>Settle</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  containerSettled: {
    opacity: 0.7,
    backgroundColor: '#f9fafb',
  },
  content: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  customerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12,
  },
  iconContainer: {
    width: 40,
    height: 40,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  iconContainerSettled: {
    backgroundColor: '#f0f0f0',
  },
  customerDetails: {
    flex: 1,
  },
  customerName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
    marginBottom: 4,
  },
  customerNameSettled: {
    color: '#999',
  },
  dateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dateText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#999',
  },
  dateTextOverdue: {
    color: '#ef4444',
    fontWeight: '600',
  },
  amountContainer: {
    alignItems: 'flex-end',
  },
  amount: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1e3a8a',
    marginBottom: 4,
  },
  amountSettled: {
    color: '#999',
  },
  overdueBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  overdueText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#ef4444',
  },
  settledBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  settledText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#1e3a8a',
  },
  note: {
    fontSize: 14,
    fontWeight: '500',
    color: '#666',
    marginTop: 8,
    lineHeight: 20,
  },
  noteSettled: {
    color: '#999',
  },
  settleButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  settleButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1e3a8a',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  remindButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  remindButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#f59e0b',
  },
});

