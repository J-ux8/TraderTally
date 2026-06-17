import { getLocalISOString } from '@/lib/dateUtils';
import { OfflineIndicator } from '@/components/ui/OfflineIndicator';
import { useTransactionsContext } from '@/contexts/TransactionsContext';
import { useToastContext } from '@/contexts/ToastContext';
import { useThemeColors } from '@/hooks/useThemeColors';
import { router, useFocusEffect } from "expo-router";
import { ArrowLeft, Calendar as CalendarIcon, TrendingDown, Check, ChevronDown } from "lucide-react-native";
import React, { useCallback, useState } from "react";
import { FlatList, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { Calendar } from 'react-native-calendars';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useTheme } from '@/contexts/ThemeContext';

const EXPENSE_TYPES = [
  'Rent / Stall Fee',
  'Salaries / Helpers',
  'Transport / Fuel',
  'Utilities',
  'Maintenance / Repairs',
  'Business Supplies',
  'Market Levy / Tax',
  'Other'
];

export default function RecordExpenseScreen() {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { recordExpense } = useTransactionsContext();
  const { success: showSuccess, error: showError } = useToastContext();
  
  const [amount, setAmount] = useState("");
  const [expenseType, setExpenseType] = useState<string>("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState<Date>(new Date());
  const [loading, setLoading] = useState(false);
  const [typePickerOpen, setTypePickerOpen] = useState(false);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [tempDate, setTempDate] = useState<Date>(new Date());

  useFocusEffect(
    useCallback(() => {
      setAmount("");
      setExpenseType("");
      setDescription("");
      setDate(new Date());
      setDatePickerOpen(false);
      setTypePickerOpen(false);
    }, [])
  );

  const handleAmountChange = (value: string) => {
    const cleaned = value.replace(/[^0-9.]/g, '');
    const parts = cleaned.split('.');
    if (parts.length > 2) return;
    if (parts[1]?.length > 2) return;
    setAmount(cleaned);
  };

  async function handleSubmit() {
    const numericAmount = parseFloat(amount);
    if (!amount || isNaN(numericAmount) || numericAmount <= 0) {
      showError('Invalid Amount', { message: 'Please enter a valid amount' });
      return;
    }

    if (!expenseType) {
      showError('Select Type', { message: 'Please select an expense type' });
      return;
    }

    setLoading(true);
    const dateStr = getLocalISOString(date);

    try {
      await recordExpense(numericAmount, expenseType.trim(), description.trim(), dateStr);
      showSuccess('Expense Recorded', {
        amount: numericAmount,
        category: expenseType.trim(),
        message: 'Transaction saved successfully',
      });
      router.back();
    } catch (error: any) {
      console.error('Error recording expense:', error);
      showError('Failed to Record Expense', { message: error.message || 'Please try again' });
    } finally {
      setLoading(false);
    }
  }

  const formatDate = (dateToFormat: Date) => {
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    if (dateToFormat.toDateString() === today.toDateString()) return 'Today';
    if (dateToFormat.toDateString() === yesterday.toDateString()) return 'Yesterday';

    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    return `${days[dateToFormat.getDay()]}, ${months[dateToFormat.getMonth()]} ${dateToFormat.getDate()}, ${dateToFormat.getFullYear()}`;
  };

  const formattedDate = formatDate(date);
  const dateStrForCalendar = (d: Date) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.backgroundColor }]}>
      <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
      <KeyboardAvoidingView
        style={[styles.container, { backgroundColor: colors.backgroundColor }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <View style={[styles.header, { backgroundColor: colors.cardBackground, paddingTop: Math.max(10, insets.top + 4) }]}>
          <View style={styles.headerDecoration1} />
          <View style={styles.headerDecoration2} />
          <View style={styles.headerContent}>
            <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
              <ArrowLeft size={22} color="#1e3a8a" />
            </TouchableOpacity>
            <View style={styles.headerIconContainer}>
              <View style={styles.headerIcon}><TrendingDown size={22} color="#1e3a8a" /></View>
              <View style={styles.headerTextContainer}>
                <Text style={[styles.headerTitle, { color: colors.textColor }]}>Record Expense</Text>
                <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>Track your business costs</Text>
              </View>
            </View>
            <OfflineIndicator />
          </View>
        </View>

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
          <View style={[styles.card, { backgroundColor: colors.cardBackground }]}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Amount spent (ZMW)</Text>
            <View style={styles.amountContainer}>
              <Text style={[styles.amountPrefix, { color: colors.textColor }]}>K</Text>
              <TextInput
                style={[styles.amountInput, { color: colors.textColor }]}
                value={amount}
                onChangeText={handleAmountChange}
                placeholder="0.00"
                keyboardType="decimal-pad"
                placeholderTextColor="rgba(30, 58, 138, 0.4)"
                autoFocus
              />
            </View>
          </View>

          <View style={[styles.card, { backgroundColor: colors.cardBackground }]}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Type of Expense</Text>
            <TouchableOpacity
              style={[styles.quantityInput, { backgroundColor: colors.inputBackground, borderColor: colors.borderColor, justifyContent: 'center' }]}
              onPress={() => setTypePickerOpen(true)}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ color: expenseType ? colors.textColor : colors.textSecondary, fontSize: 16, fontWeight: '600' }}>
                  {expenseType || 'Tap to select type'}
                </Text>
                <ChevronDown size={20} color={colors.textSecondary} />
              </View>
            </TouchableOpacity>
          </View>

          <View style={[styles.card, { backgroundColor: colors.cardBackground }]}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Notes / Description</Text>
            <TextInput
              style={[styles.quantityInput, { color: colors.textColor, backgroundColor: colors.inputBackground, borderColor: colors.borderColor, paddingTop: 12, textAlignVertical: 'top' }]}
              value={description}
              onChangeText={setDescription}
              placeholder="What was this expense for?"
              placeholderTextColor={colors.textSecondary}
              multiline
              numberOfLines={3}
            />
          </View>

          <View style={[styles.card, { backgroundColor: colors.cardBackground }]}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Date</Text>
            <TouchableOpacity
              style={[styles.dateButton, { backgroundColor: colors.inputBackground, borderColor: colors.borderColor }]}
              onPress={() => { setTempDate(date); setDatePickerOpen(true); }}
            >
              <Text style={[styles.dateButtonText, { color: colors.textColor }]}>{formattedDate}</Text>
              <CalendarIcon size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
        </ScrollView>

        <View style={[styles.bottomActions, { backgroundColor: colors.cardBackground, borderTopColor: colors.borderColor }]}>
          <TouchableOpacity style={styles.saveButton} onPress={handleSubmit} disabled={!amount || loading}>
            <Text style={styles.saveButtonText}>{loading ? 'Saving...' : 'Save'}</Text>
          </TouchableOpacity>
        </View>

        {/* Type Picker Modal */}
        <Modal visible={typePickerOpen} transparent animationType="slide">
          <View style={styles.overlay}>
            <View style={[styles.modalContent, { backgroundColor: colors.cardBackground, maxHeight: 400 }]}>
              <Text style={[styles.modalTitle, { color: colors.textColor }]}>Select Expense Type</Text>
              <FlatList
                data={EXPENSE_TYPES}
                keyExtractor={item => item}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[styles.pickerItem, { borderBottomColor: colors.borderColor }]}
                    onPress={() => { setExpenseType(item); setTypePickerOpen(false); }}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Text style={[styles.pickerItemText, { color: colors.textColor }]}>{item}</Text>
                      {expenseType === item && <Check size={18} color="#1e3a8a" />}
                    </View>
                  </TouchableOpacity>
                )}
              />
              <TouchableOpacity style={styles.modalCloseButton} onPress={() => setTypePickerOpen(false)}>
                <Text style={{ color: colors.textSecondary, fontWeight: '600' }}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        <Modal visible={datePickerOpen} transparent animationType="slide">
          <View style={styles.overlay}>
            <View style={[styles.modalContent, { backgroundColor: colors.cardBackground }]}>
              <Calendar
                current={dateStrForCalendar(tempDate)}
                onDayPress={(day: any) => {
                  const [year, month, d] = day.dateString.split('-').map(Number);
                  const now = new Date();
                  setTempDate(new Date(year, month - 1, d, now.getHours(), now.getMinutes(), now.getSeconds()));
                }}
                maxDate={dateStrForCalendar(new Date())}
                theme={{ calendarBackground: colors.cardBackground, dayTextColor: colors.textColor, monthTextColor: colors.textColor, selectedDayBackgroundColor: '#1e3a8a' }}
                markedDates={{ [dateStrForCalendar(tempDate)]: { selected: true } }}
              />
              <View style={styles.modalActions}>
                <TouchableOpacity onPress={() => setDatePickerOpen(false)}><Text style={{ color: colors.textSecondary }}>Cancel</Text></TouchableOpacity>
                <TouchableOpacity onPress={() => { setDate(tempDate); setDatePickerOpen(false); }}><Text style={{ color: '#1e3a8a', fontWeight: 'bold' }}>Done</Text></TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: { flex: 1 },
  header: {
    paddingBottom: 24,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    overflow: 'hidden',
    position: 'relative',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
  },
  headerDecoration1: {
    position: 'absolute',
    top: -50,
    right: -50,
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: 'rgba(30, 58, 138, 0.03)',
  },
  headerDecoration2: {
    position: 'absolute',
    bottom: -30,
    left: -30,
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(30, 58, 138, 0.03)',
  },
  headerContent: {
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
    backgroundColor: 'rgba(30, 58, 138, 0.08)',
    marginRight: 16,
  },
  headerIconContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    flex: 1,
  },
  headerIcon: {
    width: 48,
    height: 48,
    backgroundColor: 'rgba(30, 58, 138, 0.08)',
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTextContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 2,
  },
  headerSubtitle: {
    fontSize: 13,
    fontWeight: '500',
  },
  scrollView: { flex: 1 },
  content: { padding: 20, gap: 20 },
  card: { padding: 20, borderRadius: 16, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8 },
  label: { fontSize: 14, fontWeight: '700', marginBottom: 12 },
  amountContainer: { position: 'relative' },
  amountPrefix: { position: 'absolute', left: 16, top: '50%', marginTop: -24, fontSize: 32, fontWeight: '800', zIndex: 1 },
  amountInput: { width: '100%', height: 80, paddingLeft: 56, fontSize: 36, fontWeight: '800', borderRadius: 16, borderWidth: 2, borderColor: 'rgba(30, 58, 138, 0.3)', backgroundColor: 'rgba(30, 58, 138, 0.05)' },
  quantityInput: { width: '100%', height: 56, paddingHorizontal: 16, fontSize: 18, fontWeight: '600', borderRadius: 12, borderWidth: 2 },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  dateButton: { height: 56, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 12, borderWidth: 2 },
  dateButtonText: { fontSize: 16, fontWeight: '600' },
  bottomActions: { padding: 20, borderTopWidth: 1 },
  saveButton: { height: 56, backgroundColor: '#1e3a8a', borderRadius: 12, justifyContent: 'center', alignItems: 'center', elevation: 4 },
  saveButtonText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  modalContent: { padding: 20, borderRadius: 24 },
  modalTitle: { fontSize: 18, fontWeight: '700', marginBottom: 16 },
  modalActions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 20, paddingTop: 20, borderTopWidth: 1, borderTopColor: '#eee' },
  modalCloseButton: { padding: 12, alignItems: 'center', marginTop: 8 },
  pickerItem: { paddingVertical: 14, borderBottomWidth: 1 },
  pickerItemText: { fontSize: 16, fontWeight: '500' },
});
