import { getLocalISOString } from '@/lib/dateUtils';
import { OfflineIndicator } from '@/components/ui/OfflineIndicator';
import { useTransactionsContext } from '@/contexts/TransactionsContext';
import { useToastContext } from '@/contexts/ToastContext';
import { useThemeColors } from '@/hooks/useThemeColors';
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { ArrowLeft, Calendar as CalendarIcon, TrendingDown, Plus, Check } from "lucide-react-native";
import React, { useCallback, useState } from "react";
import { KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { Calendar } from 'react-native-calendars';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useTheme } from '@/contexts/ThemeContext';

const EXPENSE_TYPES = [
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

export default function RecordExpenseScreen() {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { recordExpense } = useTransactionsContext();
  const { success: showSuccess, error: showError } = useToastContext();
  const params = useLocalSearchParams<{
    templateId?: string;
    amount?: string;
    category?: string;
    description?: string;
  }>();
  
  const [amount, setAmount] = useState("");
  const [expenseType, setExpenseType] = useState<string>("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState<Date>(new Date());
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [tempDate, setTempDate] = useState<Date>(new Date());

  useFocusEffect(
    useCallback(() => {
      // Pre-fill from template if provided
      if (params.templateId && params.amount) {
        setAmount(params.amount);
        setExpenseType(params.category || "");
        setDescription(params.description || "");
        setDate(new Date());
        setDatePickerOpen(false);
        setShowDropdown(false);
      } else {
        // Reset form for new entry
        setAmount("");
        setExpenseType("");
        setDescription("");
        setDate(new Date());
        setDatePickerOpen(false);
        setShowDropdown(false);
      }
    }, [params.templateId, params.amount, params.category, params.description])
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
              style={[styles.dropdownButton, { backgroundColor: colors.inputBackground, borderColor: colors.borderColor }]}
              onPress={() => setShowDropdown(!showDropdown)}
              activeOpacity={0.7}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <TrendingDown size={20} color={colors.textSecondary} style={{ marginRight: 12 }} />
                <Text style={[styles.dropdownButtonText, { color: expenseType ? colors.textColor : colors.textSecondary }]}>
                  {expenseType || 'Select expense type...'}
                </Text>
              </View>
              <Plus size={20} color={colors.textSecondary} style={{ transform: [{ rotate: showDropdown ? '45deg' : '0deg' }] }} />
            </TouchableOpacity>

            {showDropdown && (
              <View style={[styles.dropdownContainer, { borderColor: colors.borderColor, backgroundColor: colors.cardBackground, marginTop: 8 }]}>
                <ScrollView style={{ maxHeight: 250 }} nestedScrollEnabled keyboardShouldPersistTaps="always">
                  {EXPENSE_TYPES.map((type) => (
                    <TouchableOpacity
                      key={type}
                      style={[styles.option, { borderBottomColor: colors.borderColor, backgroundColor: expenseType === type ? 'rgba(30, 58, 138, 0.05)' : 'transparent' }]}
                      onPress={() => {
                        setExpenseType(type);
                        setShowDropdown(false);
                      }}
                    >
                      <Text style={[styles.optionText, { color: colors.textColor }]}>{type}</Text>
                      {expenseType === type && <Check size={18} color="#1e3a8a" />}
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}
          </View>

          <View style={[styles.card, { backgroundColor: colors.cardBackground }]}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Notes / Description</Text>
            <View style={[styles.inputContainer, { backgroundColor: colors.inputBackground, borderColor: colors.borderColor, height: 100, alignItems: 'flex-start', paddingTop: 12 }]}>
              <TextInput
                style={[styles.textInput, { color: colors.textColor, textAlignVertical: 'top' }]}
                value={description}
                onChangeText={setDescription}
                placeholder="What was this expense for?"
                placeholderTextColor={colors.textSecondary}
                multiline
                numberOfLines={3}
              />
            </View>
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
            <Text style={styles.saveButtonText}>{loading ? 'Saving...' : 'Save Expense'}</Text>
          </TouchableOpacity>
        </View>

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
  inputContainer: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, borderWidth: 2, paddingHorizontal: 16 },
  textInput: { flex: 1, fontSize: 16, fontWeight: '500' },
  dropdownButton: { height: 56, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 12, borderWidth: 2 },
  dropdownButtonText: { fontSize: 16, fontWeight: '600' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  dropdownContainer: { borderRadius: 16, borderWidth: 1, maxHeight: 400, overflow: 'hidden' },
  option: { padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1 },
  optionText: { fontSize: 16, fontWeight: '600' },
  dateButton: { height: 56, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 12, borderWidth: 2 },
  dateButtonText: { fontSize: 16, fontWeight: '600' },
  bottomActions: { padding: 20, borderTopWidth: 1 },
  saveButton: { height: 56, backgroundColor: '#1e3a8a', borderRadius: 12, justifyContent: 'center', alignItems: 'center', elevation: 4 },
  saveButtonText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  modalContent: { padding: 20, borderRadius: 24 },
  modalActions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 20, paddingTop: 20, borderTopWidth: 1, borderTopColor: '#eee' },
});
