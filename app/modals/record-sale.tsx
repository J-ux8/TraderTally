import { getLocalISOString } from '@/lib/dateUtils';
import { CategorySelector } from '@/components/CategorySelector';
import { OfflineIndicator } from '@/components/ui/OfflineIndicator';
import { useTransactionsContext } from '@/contexts/TransactionsContext';
import { useToastContext } from '@/contexts/ToastContext';
import { useThemeColors } from '@/hooks/useThemeColors';
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { ArrowLeft, Calendar as CalendarIcon, ShoppingBag } from "lucide-react-native";
import React, { useCallback, useEffect, useState } from "react";
import { Alert, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { Calendar } from 'react-native-calendars';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function RecordSaleScreen() {
  const colors = useThemeColors();
  const { recordSale } = useTransactionsContext();
  const { success: showSuccess, error: showError } = useToastContext();
  const params = useLocalSearchParams<{
    templateId?: string;
    amount?: string;
    category?: string;
    description?: string;
  }>();
  
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");

  const [paymentMode, setPaymentMode] = useState<'Paid' | 'Credit'>('Paid');
  const [description, setDescription] = useState("");
  const [date, setDate] = useState<Date>(new Date());
  const [loading, setLoading] = useState(false);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [tempDate, setTempDate] = useState<Date>(new Date());

  useFocusEffect(
    useCallback(() => {
      // Pre-fill from template if provided
      if (params.templateId && params.amount) {
        setAmount(params.amount);
        setCategory(params.category || "");
        setDescription(params.description || "");
        setPaymentMode('Paid');
        setDate(new Date());
        setDatePickerOpen(false);
      } else {
        // Reset form for new entry
        setAmount("");
        setCategory("");
        setPaymentMode('Paid');
        setDescription("");
        setDate(new Date());
        setDatePickerOpen(false);
      }
    }, [params.templateId, params.amount, params.category, params.description])
  );

  useEffect(() => {
    if (paymentMode === 'Credit') {
      const numericAmount = parseFloat(amount);
      if (amount && !isNaN(numericAmount) && numericAmount > 0) {
        // Redirect to credit book with initial values
        router.push({
          pathname: '/(tabs)/debts',
          params: {
            amount: amount,
            note: description,
            isSale: 'true',
            category: category
          }
        });
        // Reset payment mode so it doesn't loop when they come back
        setPaymentMode('Paid');
      } else {
        if (amount) {
          Alert.alert('Incomplete Amount', 'Please set a valid amount before moving to Credit Book.');
          setPaymentMode('Paid');
        }
      }
    }
  }, [paymentMode, amount, description, category]);


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

    if (!category.trim()) {
      showError('Missing Category', { message: 'Please enter a category or item name' });
      return;
    }

    setLoading(true);
    const dateStr = getLocalISOString(date);

    try {
      await recordSale(numericAmount, category.trim(), description.trim() || null, dateStr);

      showSuccess('Sale Recorded', {
        amount: numericAmount,
        category: category.trim(),
        message: 'Transaction saved successfully',
      });
      router.back();
    } catch (error: any) {
      console.error('Error recording sale:', error);
      showError('Failed to Record Sale', { message: error.message || 'Please try again' });
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
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.backgroundColor }]} edges={['top']}>
      <KeyboardAvoidingView
        style={[styles.container, { backgroundColor: colors.backgroundColor }]}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <View style={[styles.header, { backgroundColor: colors.headerBackground }]}>
          <View style={styles.headerDecoration} />
          <View style={styles.headerContent}>
            <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
              <ArrowLeft size={20} color="#ffffff" />
            </TouchableOpacity>
            <View style={styles.headerTitleContainer}>
              <View style={styles.headerIcon}><ShoppingBag size={20} color="#ffffff" /></View>
              <View>
                <Text style={styles.headerTitle}>Record Sale</Text>
                <Text style={styles.headerSubtitle}>Add your latest sale</Text>
              </View>
            </View>
            <OfflineIndicator />
          </View>
        </View>

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={[styles.card, { backgroundColor: colors.cardBackground }]}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Amount received (ZMW)</Text>
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
            <Text style={[styles.label, { color: colors.textSecondary }]}>Category / Item Name</Text>
            <CategorySelector
              selectedCategoryName={category}
              onSelect={setCategory}
              type="income"
            />
          </View>

          <View style={[styles.card, { backgroundColor: colors.cardBackground }]}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Payment Status</Text>
            <View style={styles.segmentedContainer}>
              <TouchableOpacity
                style={[styles.segment, paymentMode === 'Paid' && styles.segmentActive]}
                onPress={() => setPaymentMode('Paid')}
              >
                <Text style={[styles.segmentText, paymentMode === 'Paid' && styles.segmentTextActive]}>Paid Full</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.segment, paymentMode === 'Credit' && styles.segmentActiveCredit]}
                onPress={() => setPaymentMode('Credit')}
              >
                <Text style={[styles.segmentText, paymentMode === 'Credit' && styles.segmentTextActive]}>On Credit</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={[styles.card, { backgroundColor: colors.cardBackground }]}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Note (optional)</Text>
            <TextInput
              style={[styles.descriptionInput, { color: colors.textColor, backgroundColor: colors.inputBackground, borderColor: colors.borderColor }]}
              value={description}
              onChangeText={setDescription}
              placeholder="e.g., customer name, quantity"
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
            <Text style={styles.saveButtonText}>{loading ? 'Saving...' : 'Save Sale'}</Text>
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: { flex: 1 },
  header: { padding: 24, paddingTop: 40, borderBottomLeftRadius: 24, borderBottomRightRadius: 24, overflow: 'hidden' },
  headerDecoration: { position: 'absolute', top: -40, right: -40, width: 128, height: 128, borderRadius: 64, backgroundColor: 'rgba(255,255,255,0.1)' },
  headerContent: { flexDirection: 'row', alignItems: 'center' },
  backButton: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center', borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.2)', marginRight: 12 },
  headerTitleContainer: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  headerIcon: { width: 40, height: 40, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#fff' },
  headerSubtitle: { fontSize: 14, color: 'rgba(255,255,255,0.8)' },
  scrollView: { flex: 1 },
  content: { padding: 20, gap: 20 },
  card: { padding: 20, borderRadius: 16, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8 },
  label: { fontSize: 14, fontWeight: '700', marginBottom: 12 },
  amountContainer: { position: 'relative' },
  amountPrefix: { position: 'absolute', left: 16, top: '50%', marginTop: -24, fontSize: 32, fontWeight: '800', zIndex: 1 },
  amountInput: { width: '100%', height: 80, paddingLeft: 56, fontSize: 36, fontWeight: '800', borderRadius: 16, borderWidth: 2, borderColor: 'rgba(30, 58, 138, 0.3)', backgroundColor: 'rgba(30, 58, 138, 0.05)' },
  segmentedContainer: { flexDirection: 'row', backgroundColor: 'rgba(0,0,0,0.05)', borderRadius: 12, padding: 4 },
  segment: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 8 },
  segmentActive: { backgroundColor: '#1e3a8a' },
  segmentActiveCredit: { backgroundColor: '#1e3a8a' }, // Changed from amber to blue as requested
  segmentText: { fontSize: 14, fontWeight: '700', color: '#666' },
  segmentTextActive: { color: '#fff' },
  inputContainer: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, borderWidth: 2, paddingHorizontal: 16, height: 56 },
  textInput: { flex: 1, fontSize: 16, fontWeight: '500' },
  descriptionInput: { width: '100%', padding: 16, borderRadius: 12, borderWidth: 2, fontSize: 16, textAlignVertical: 'top' },
  dateButton: { height: 56, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 12, borderWidth: 2 },
  dateButtonText: { fontSize: 16, fontWeight: '600' },
  dropdownButton: { height: 56, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 12, borderWidth: 2 },
  dropdownButtonText: { fontSize: 16, fontWeight: '600' },
  dropdownContainer: { borderRadius: 16, borderWidth: 1, maxHeight: 400, overflow: 'hidden' },
  option: { padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  optionText: { fontSize: 16, fontWeight: '600' },
  bottomActions: { padding: 20, borderTopWidth: 1 },
  saveButton: { height: 56, backgroundColor: '#1e3a8a', borderRadius: 12, justifyContent: 'center', alignItems: 'center', elevation: 4 },
  saveButtonText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  modalContent: { padding: 20, borderRadius: 24 },
  modalActions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 20, paddingTop: 20, borderTopWidth: 1, borderTopColor: '#eee' },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    backgroundColor: 'transparent',
  },
  categoryChipActive: {
    backgroundColor: '#1e3a8a',
    borderColor: '#1e3a8a',
  },
  categoryChipText: {
    fontSize: 14,
    fontWeight: '600',
  },
  categoryChipTextActive: {
    color: '#fff',
  },
});
