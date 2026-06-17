import { getLocalISOString } from '@/lib/dateUtils';
import { useTransactionsContext } from '@/contexts/TransactionsContext';
import { OfflineIndicator } from '@/components/ui/OfflineIndicator';
import { useThemeColors } from '@/hooks/useThemeColors';
import { supabase } from "@/lib/supabase";
import { deleteTransaction, updateTransaction } from "@/lib/transactions";
import { useFocusEffect } from "expo-router";
import { Calendar as CalendarIcon, Edit2, ShoppingBag, Trash2, TrendingDown, TrendingUp } from "lucide-react-native";
import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Modal, Platform, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { Calendar } from 'react-native-calendars';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface Transaction {
  id: string;
  amount: number;
  category: string | null;
  description: string | null;
  transaction_date: string;
  created_at: string;
  user_id: string;
  sale_items?: any[];
}

// Predefined selection list for editing
const CATEGORY_OPTIONS = [
  'Sale',
  'Stock / Inventory',
  'Rent / Stall Fee',
  'Salaries / Helpers',
  'Transport / Fuel',
  'Utilities',
  'Maintenance / Repairs',
  'Business Supplies',
  'Market Levy / Tax',
  'Other'
];

function ProfitDisplay({ saleItems }: { saleItems: any[] }) {
  const itemsWithCost = saleItems.filter((i: any) => i.unit_cost != null);
  if (itemsWithCost.length === 0) return null;

  // Group by category
  const groups = new Map<string, { items: typeof itemsWithCost; profit: number }>();
  for (const item of itemsWithCost) {
    const catName = item.category_name || 'Uncategorized';
    if (!groups.has(catName)) groups.set(catName, { items: [], profit: 0 });
    const group = groups.get(catName)!;
    group.items.push(item);
    group.profit += (item.unit_price - item.unit_cost) * item.quantity;
  }

  const totalProfit = Array.from(groups.values()).reduce((s, g) => s + g.profit, 0);

  return (
    <View style={{ marginTop: 4 }}>
      {Array.from(groups.entries()).map(([catName, group]) => (
        <View key={catName} style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
          <Text style={{ fontSize: 12, fontWeight: '700', color: group.profit >= 0 ? '#10b981' : '#ef4444' }}>
            {catName}: Profit K{group.profit.toFixed(2)}
          </Text>
          <Text style={{ fontSize: 11, color: '#999', marginLeft: 4 }}>
            ({group.items.map((i: any) => `${i.quantity}x ${i.product_name}`).join(', ')})
          </Text>
        </View>
      ))}
      {groups.size > 1 && (
        <Text style={{ fontSize: 12, fontWeight: '800', color: totalProfit >= 0 ? '#10b981' : '#ef4444', marginTop: 3 }}>
          Total Profit: K{totalProfit.toFixed(2)}
        </Text>
      )}
    </View>
  );
}

const TransactionItem = React.memo(({
  transaction,
  onEdit,
  onDelete,
  colors,
  dynamicStyles,
  formatDate,
  formatTime
}: {
  transaction: Transaction,
  onEdit: (t: Transaction) => void,
  onDelete: (id: string) => void,
  colors: any,
  dynamicStyles: any,
  formatDate: (d: string) => string,
  formatTime: (d: string) => string
}) => {
  const sale = transaction.amount > 0;
  return (
    <View style={[dynamicStyles.card, styles.listItem]}>
      <View style={styles.transactionHeader}>
        <View style={styles.transactionLeft}>
          <View style={[styles.typeIcon, { backgroundColor: sale ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)' }]}>
            {sale ? (
              <TrendingUp size={20} color="#1e3a8a" />
            ) : (
              <TrendingDown size={20} color="#ef4444" />
            )}
          </View>
          <View style={styles.transactionInfo}>
            <Text style={[dynamicStyles.amount, { color: sale ? '#1e3a8a' : '#ef4444' }]}>
              {sale ? '+' : '-'}K {Math.abs(transaction.amount).toFixed(2)}
            </Text>
            <View style={styles.dateTimeContainer}>
              <Text style={dynamicStyles.date}>{formatDate(transaction.transaction_date)}</Text>
              <Text style={dynamicStyles.time}>{formatTime(transaction.transaction_date)}</Text>
              
              <View style={styles.txnIdBadge}>
                <Text style={styles.txnIdText}>
                  #{transaction.id ? transaction.id.split('-')[0].substring(0, 8).toUpperCase() : 'UNKNOWN'}
                </Text>
              </View>
            </View>
          </View>
        </View>
        <View style={styles.transactionActions}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => onEdit(transaction)}
            activeOpacity={0.7}
          >
            <Edit2 size={18} color="#1e3a8a" />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, styles.deleteButton]}
            onPress={() => onDelete(transaction.id)}
            activeOpacity={0.7}
          >
            <Trash2 size={18} color="#ef4444" />
          </TouchableOpacity>
        </View>
      </View>
      {!!transaction.category && (
        <View style={styles.categoryContainer}>
          <Text style={dynamicStyles.category}>{transaction.category}</Text>
        </View>
      )}
      {!!transaction.description && (
        <Text style={dynamicStyles.description}>{transaction.description}</Text>
      )}
      {transaction.amount > 0 && transaction.sale_items && transaction.sale_items.length > 0 && (
        <ProfitDisplay saleItems={transaction.sale_items} />
      )}
    </View>
  );
});

import { useCustomAlert } from '@/components/ui/CustomAlertContext';

export default function RecordsScreen() {
  const { showAlert } = useCustomAlert();
  const Alert = { alert: showAlert };
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const {
    transactions,
    loading,
    refresh,
    updateTransaction: updateTransactionInContext,
    removeTransaction: removeTransactionFromContext
  } = useTransactionsContext();
  const [user, setUser] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Edit modal state
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [editAmount, setEditAmount] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editCategory, setEditCategory] = useState<string | null>(null);
  const [editDate, setEditDate] = useState<Date>(new Date());
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const initUser = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          setUser(session.user);
        }
      } catch (error) {
        console.error('[records] Failed to get session:', error);
      }
    };

    initUser();
  }, []);

  // Only refresh if needed, not on every focus
  useFocusEffect(
    useCallback(() => {
      // Don't auto-refresh on focus - user can pull to refresh if needed
      // This significantly improves perceived performance
    }, [])
  );


  async function onRefresh() {
    setRefreshing(true);
    try {
      await refresh();
    } finally {
      setRefreshing(false);
    }
  }

  function openEditModal(transaction: Transaction) {
    setSelectedTransaction(transaction);
    setEditAmount(Math.abs(transaction.amount).toString());
    setEditDescription(transaction.description || "");
    setEditCategory(transaction.category);
    setEditDate(new Date(transaction.transaction_date));
    setEditModalVisible(true);
  }

  function closeEditModal() {
    setEditModalVisible(false);
    setSelectedTransaction(null);
    setEditAmount("");
    setEditDescription("");
    setEditCategory(null);
    setDatePickerOpen(false);
  }

  async function handleUpdateTransaction() {
    if (!selectedTransaction || !editAmount.trim()) {
      Alert.alert('Error', 'Please fill in the amount');
      return;
    }

    const amount = parseFloat(editAmount);
    if (isNaN(amount) || amount <= 0) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }

    // Determine if it's a sale or expense based on original amount
    const finalAmount = selectedTransaction.amount < 0 ? -amount : amount;

    setSaving(true);
    try {
      await updateTransaction(
        selectedTransaction.id,
        finalAmount,
        editCategory,
        editDescription.trim() || null,
        getLocalISOString(editDate)
      );
      // Update in context
      updateTransactionInContext(selectedTransaction.id, finalAmount, editCategory, editDescription.trim() || null, getLocalISOString(editDate));
      closeEditModal();
      Alert.alert('Success', 'Transaction updated successfully! 🎉');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to update transaction');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteTransaction(transactionId: string) {
    Alert.alert(
      "Delete Transaction",
      "Are you sure you want to delete this transaction? This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteTransaction(transactionId);
              removeTransactionFromContext(transactionId);
              Alert.alert('Success', 'Transaction deleted successfully');
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to delete transaction');
            }
          },
        },
      ]
    );
  }

  const handleAmountChange = (value: string) => {
    const cleaned = value.replace(/[^0-9.]/g, '');
    const parts = cleaned.split('.');
    if (parts.length > 2) return;
    if (parts[1]?.length > 2) return;
    setEditAmount(cleaned);
  };

  const formatDate = useCallback((dateString: string) => {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Invalid date';
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
  }, []);

  const formatTime = useCallback((dateString: string) => {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Invalid time';
    
    return date.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    });
  }, []);

  const isSale = useCallback((amount: number) => amount > 0, []);

  const dynamicStyles = {
    container: { ...styles.container, backgroundColor: colors.backgroundColor },
    card: { ...styles.transactionItem, backgroundColor: colors.cardBackground, borderColor: colors.borderColor },
    amount: { ...styles.amount, color: colors.textColor },
    date: { ...styles.date, color: colors.textSecondary },
    time: { ...styles.time, color: colors.textSecondary },
    category: { ...styles.category, color: colors.textSecondary },
    description: { ...styles.description, color: colors.textColor },
    emptyText: { ...styles.emptyText, color: colors.textSecondary },
    modalContent: { ...styles.modalContent, backgroundColor: colors.cardBackground },
    inputContainer: { ...styles.inputContainer, backgroundColor: colors.inputBackground, borderColor: colors.borderColor },
    input: { ...styles.input, color: colors.textColor },
    inputLabel: { ...styles.inputLabel, color: colors.textSecondary },
  };

  return (
    <View style={dynamicStyles.container}>
      {/* Hero Header */}
      <View style={[styles.header, { backgroundColor: colors.cardBackground, paddingTop: Math.max(10, insets.top + 4) }]}>
        <View style={styles.headerDecoration1} />
        <View style={styles.headerDecoration2} />
        <View style={styles.headerContent}>
          <View style={styles.headerLeft}>
            <View style={styles.headerIcon}>
              <TrendingUp size={22} color="#1e3a8a" />
            </View>
            <View style={styles.headerTextContainer}>
              <Text style={[styles.headerTitle, { color: colors.textColor }]}>Records</Text>
              <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
                {transactions.length} transaction{transactions.length !== 1 ? 's' : ''}
              </Text>
            </View>
          </View>
          <View style={styles.headerRight}>
            <OfflineIndicator alwaysShow compact />
          </View>
        </View>
      </View>

      {loading && transactions.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1e3a8a" />
          <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading transactions...</Text>
        </View>
      ) : (
        <View style={styles.contentContainer}>
          <FlatList
            data={transactions}
            renderItem={({ item }) => (
              <TransactionItem
                transaction={item}
                onEdit={openEditModal}
                onDelete={handleDeleteTransaction}
                colors={colors}
                dynamicStyles={dynamicStyles}
                formatDate={formatDate}
                formatTime={formatTime}
              />
            )}
            keyExtractor={(item) => item.id}
            contentContainerStyle={[
              styles.scrollContent,
              transactions.length === 0 && styles.emptyContainer
            ]}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#1e3a8a" />
            }
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No transactions yet</Text>
                <Text style={[styles.emptySubtext, { color: colors.textSecondary }]}>
                  Your transactions will appear here once you start recording them.
                </Text>
              </View>
            }
          />
        </View>
      )}

      {/* Edit Transaction Modal */}
      <Modal visible={editModalVisible} transparent animationType="slide" onRequestClose={closeEditModal}>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={closeEditModal} />
          <View style={dynamicStyles.modalContent}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.borderColor }]}>
              <Text style={[styles.modalTitle, { color: colors.textColor }]}>Edit Transaction</Text>
              <TouchableOpacity onPress={closeEditModal} style={styles.modalCloseButton} activeOpacity={0.7}>
                <Text style={styles.modalCloseText}>Cancel</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
              <View style={styles.inputCard}>
                <Text style={dynamicStyles.inputLabel}>Amount</Text>
                <View style={dynamicStyles.inputContainer}>
                  <Text style={[styles.currencySymbol, { color: colors.textSecondary }]}>K</Text>
                  <TextInput
                    style={dynamicStyles.input}
                    value={editAmount}
                    onChangeText={handleAmountChange}
                    placeholder="0.00"
                    placeholderTextColor={colors.textSecondary}
                    keyboardType="decimal-pad"
                  />
                </View>
              </View>

              <View style={styles.inputCard}>
                <Text style={dynamicStyles.inputLabel}>Category</Text>
                <TouchableOpacity
                  style={styles.dropdownButton}
                  onPress={() => setShowCategoryDropdown(!showCategoryDropdown)}
                  activeOpacity={0.7}
                >
                  <View style={dynamicStyles.inputContainer}>
                    <ShoppingBag size={20} color={colors.textSecondary} style={styles.inputIcon} />
                    <Text style={[styles.dropdownText, !editCategory && styles.dropdownPlaceholder, { color: editCategory ? colors.textColor : colors.textSecondary }]}>
                      {editCategory || 'Select category'}
                    </Text>
                  </View>
                </TouchableOpacity>
                {showCategoryDropdown && (
                  <View style={[styles.dropdown, { backgroundColor: colors.cardBackground, borderColor: colors.borderColor }]}>
                    <ScrollView style={styles.dropdownScroll} nestedScrollEnabled>
                      {CATEGORY_OPTIONS.map((cat) => (
                        <TouchableOpacity
                          key={cat}
                          style={[styles.dropdownOption, { borderBottomColor: colors.borderColor }]}
                          onPress={() => {
                            setEditCategory(cat);
                            setShowCategoryDropdown(false);
                          }}
                          activeOpacity={0.7}
                        >
                          <Text style={[styles.dropdownOptionText, { color: colors.textColor }]}>{cat}</Text>
                          {editCategory === cat && (
                            <View style={styles.checkmark}>
                              <Text style={styles.checkmarkText}>✓</Text>
                            </View>
                          )}
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                )}
              </View>

              <View style={styles.inputCard}>
                <Text style={dynamicStyles.inputLabel}>Description</Text>
                <View style={dynamicStyles.inputContainer}>
                  <TextInput
                    style={[dynamicStyles.input, styles.textArea]}
                    value={editDescription}
                    onChangeText={setEditDescription}
                    placeholder="Add a description (optional)"
                    placeholderTextColor={colors.textSecondary}
                    multiline
                  />
                </View>
              </View>

              <View style={styles.inputCard}>
                <Text style={dynamicStyles.inputLabel}>Date</Text>
                <TouchableOpacity style={styles.dateButton} onPress={() => setDatePickerOpen(true)} activeOpacity={0.7}>
                  <View style={dynamicStyles.inputContainer}>
                    <CalendarIcon size={20} color={colors.textSecondary} style={styles.inputIcon} />
                    <Text style={[styles.dateText, { color: colors.textColor }]}>
                      {`${['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][editDate.getMonth()]} ${editDate.getDate()}, ${editDate.getFullYear()}`}
                    </Text>
                  </View>
                </TouchableOpacity>
              </View>
            </ScrollView>

            <View style={[styles.modalActions, { borderTopColor: colors.borderColor }]}>
              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton, saving && styles.buttonDisabled]}
                onPress={handleUpdateTransaction}
                disabled={saving}
                activeOpacity={0.8}
              >
                <Text style={styles.saveButtonText}>{saving ? 'Saving...' : 'Save Changes'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={datePickerOpen} transparent animationType="fade" onRequestClose={() => setDatePickerOpen(false)}>
        <TouchableOpacity style={styles.datePickerOverlay} activeOpacity={1} onPress={() => setDatePickerOpen(false)}>
          <View style={[styles.datePickerContainer, { backgroundColor: colors.cardBackground }]}>
            <Calendar
              current={editDate.toISOString().split("T")[0]}
              onDayPress={(day) => {
                const [year, month, d] = day.dateString.split('-').map(Number);
                const now = new Date();
                setEditDate(new Date(year, month - 1, d, editDate.getHours(), editDate.getMinutes(), editDate.getSeconds()));
                setDatePickerOpen(false);
              }}
              theme={{
                backgroundColor: colors.cardBackground,
                calendarBackground: colors.cardBackground,
                textSectionTitleColor: colors.textColor,
                selectedDayBackgroundColor: '#1e3a8a',
                dayTextColor: colors.textColor,
                monthTextColor: colors.textColor,
              }}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </View >
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingBottom: 24, paddingHorizontal: 20, borderBottomLeftRadius: 24, borderBottomRightRadius: 24, overflow: 'hidden' },
  headerDecoration1: { position: 'absolute', top: -50, right: -50, width: 150, height: 150, borderRadius: 75, backgroundColor: 'rgba(30, 58, 138, 0.03)' },
  headerDecoration2: { position: 'absolute', bottom: -30, left: -30, width: 100, height: 100, borderRadius: 50, backgroundColor: 'rgba(30, 58, 138, 0.03)' },
  headerContent: { zIndex: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 16 },
  headerIcon: { width: 48, height: 48, backgroundColor: 'rgba(30, 58, 138, 0.08)', borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  headerTextContainer: { flex: 1 },
  headerTitle: { fontSize: 22, fontWeight: '800', marginBottom: 2 },
  headerSubtitle: { fontSize: 13, fontWeight: '500' },
  headerRight: { justifyContent: 'center', alignItems: 'flex-end', flexDirection: 'row', gap: 12 },
  contentContainer: { flex: 1 },
  scrollView: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 40, paddingTop: 10 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 60 },
  loadingText: { marginTop: 12, fontSize: 16 },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 60 },
  emptyText: { fontSize: 20, fontWeight: '700', marginBottom: 8 },
  emptySubtext: { fontSize: 16, marginBottom: 24, textAlign: 'center' },
  listItem: { marginBottom: 12 },
  transactionItem: { padding: 16, borderRadius: 16, borderWidth: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  transactionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  transactionLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 12 },
  typeIcon: { width: 40, height: 40, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  transactionInfo: { flex: 1 },
  amount: { fontSize: 20, fontWeight: '700', marginBottom: 4 },
  dateTimeContainer: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  date: { fontSize: 13 },
  time: { fontSize: 12, fontWeight: '500' },
  txnIdBadge: { backgroundColor: 'rgba(0,0,0,0.03)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, borderWidth: 1, borderColor: 'rgba(0,0,0,0.05)' },
  txnIdText: { fontSize: 10, fontWeight: '700', color: '#666', letterSpacing: 0.5 },
  transactionActions: { flexDirection: 'row', gap: 8 },
  actionButton: { width: 36, height: 36, borderRadius: 8, backgroundColor: 'rgba(16, 185, 129, 0.1)', justifyContent: 'center', alignItems: 'center' },
  deleteButton: { backgroundColor: 'rgba(239, 68, 68, 0.1)' },
  categoryContainer: { marginTop: 8, marginBottom: 4 },
  category: { fontSize: 14, fontWeight: '600' },
  description: { fontSize: 14, lineHeight: 20 },
  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)' },
  modalContent: { borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '90%', paddingBottom: 20 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, borderBottomWidth: 1 },
  modalTitle: { fontSize: 20, fontWeight: '700' },
  modalCloseButton: { padding: 4 },
  modalCloseText: { fontSize: 16, fontWeight: '600', color: '#1e3a8a' },
  modalScroll: { padding: 20 },
  inputCard: { marginBottom: 20 },
  inputLabel: { fontSize: 14, fontWeight: '700', marginBottom: 12 },
  inputContainer: { flexDirection: 'row', alignItems: 'center', borderWidth: 2, borderRadius: 12, paddingHorizontal: 16, minHeight: 56 },
  inputIcon: { marginRight: 12 },
  currencySymbol: { fontSize: 16, fontWeight: '600', marginRight: 8 },
  input: { flex: 1, fontSize: 16, fontWeight: '500' },
  textArea: { minHeight: 80, textAlignVertical: 'top', paddingTop: 12 },
  dropdownButton: { width: '100%' },
  dropdownText: { flex: 1, fontSize: 16, fontWeight: '500' },
  dropdownPlaceholder: { color: '#999' },
  dropdown: { marginTop: 8, borderRadius: 12, borderWidth: 1, overflow: 'hidden', maxHeight: 200 },
  dropdownScroll: { maxHeight: 200 },
  dropdownOption: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1 },
  dropdownOptionText: { fontSize: 16, fontWeight: '500' },
  checkmark: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#1e3a8a', justifyContent: 'center', alignItems: 'center' },
  checkmarkText: { color: '#ffffff', fontSize: 14, fontWeight: '700' },
  dateButton: { width: '100%' },
  dateText: { flex: 1, fontSize: 16, fontWeight: '500' },
  modalActions: { padding: 20, paddingTop: 10, borderTopWidth: 1 },
  modalButton: { height: 56, justifyContent: 'center', alignItems: 'center', borderRadius: 12 },
  saveButton: { backgroundColor: '#1e3a8a', elevation: 4 },
  saveButtonText: { fontSize: 18, fontWeight: '700', color: '#ffffff' },
  buttonDisabled: { opacity: 0.6 },
  datePickerOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  datePickerContainer: { borderRadius: 16, padding: 20, width: '100%', maxWidth: 400 },
});
