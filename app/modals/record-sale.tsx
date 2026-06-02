import { getLocalISOString } from '@/lib/dateUtils';
import { ProductSelector } from '@/components/ProductSelector';
import { OfflineIndicator } from '@/components/ui/OfflineIndicator';
import { useTransactionsContext } from '@/contexts/TransactionsContext';
import { useToastContext } from '@/contexts/ToastContext';
import { useThemeColors } from '@/hooks/useThemeColors';
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { ArrowLeft, Calendar as CalendarIcon, ShoppingBag, User } from "lucide-react-native";
import React, { useCallback, useEffect, useState } from "react";
import { Alert, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { Calendar } from 'react-native-calendars';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useTheme } from '@/contexts/ThemeContext';
import { getOrCreateCustomer } from '@/lib/customers';
import { Product } from '@/lib/products';
import { completeSale } from '@/lib/sales';
import { CartItem } from '@/contexts/CartContext';

export default function RecordSaleScreen() {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { recordSale } = useTransactionsContext();
  const { success: showSuccess, error: showError } = useToastContext();
  const params = useLocalSearchParams<{
    templateId?: string;
    amount?: string;
    category?: string;
    description?: string;
  }>();
  
  const [amount, setAmount] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");

  const [paymentMode, setPaymentMode] = useState<'Paid' | 'Credit'>('Paid');
  const [description, setDescription] = useState("");
  const [date, setDate] = useState<Date>(new Date());
  const [loading, setLoading] = useState(false);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [tempDate, setTempDate] = useState<Date>(new Date());

  useFocusEffect(
    useCallback(() => {
      if (params.templateId && params.amount) {
        setAmount(params.amount);
        setDescription(params.description || "");
        setPaymentMode('Paid');
        setDate(new Date());
        setDatePickerOpen(false);
      } else {
        setAmount("");
        setSelectedProduct(null);
        setCustomerName("");
        setCustomerPhone("");
        setPaymentMode('Paid');
        setDescription("");
        setDate(new Date());
        setDatePickerOpen(false);
      }
    }, [params.templateId, params.amount, params.description])
  );

  useEffect(() => {
    if (paymentMode === 'Credit' && !customerName.trim()) {
      showError('Customer Required', { message: 'Credit sales require a customer name' });
      setPaymentMode('Paid');
    }
  }, [paymentMode]);


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

    if (!selectedProduct) {
      showError('Missing Product', { message: 'Please select or create a product' });
      return;
    }
    
    if (paymentMode === 'Credit' && !customerName.trim()) {
      showError('Customer Required', { message: 'Please enter a customer name for credit sales.' });
      return;
    }

    setLoading(true);

    try {
      let customerId = undefined;
      if (customerName.trim()) {
        try {
          const customer = await getOrCreateCustomer(customerName.trim(), customerPhone.trim());
          customerId = customer.id;
        } catch (e) {
          console.error('[RecordSale] Failed to link customer:', e);
        }
      }

      const cartItem: CartItem = {
         product_id: selectedProduct.id,
         name: selectedProduct.name,
         price: numericAmount,
         quantity: 1
      };

      await completeSale(
        [cartItem], 
        numericAmount, 
        paymentMode, 
        customerId, 
        customerName.trim(), 
        customerPhone.trim(),
        getLocalISOString(date)
      );

      showSuccess(paymentMode === 'Credit' ? 'Credit Sale Recorded' : 'Sale Recorded', {
        amount: numericAmount,
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
              <View style={styles.headerIcon}><ShoppingBag size={22} color="#1e3a8a" /></View>
              <View style={styles.headerTextContainer}>
                <Text style={[styles.headerTitle, { color: colors.textColor }]}>Record Sale</Text>
                <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>Add your latest sale</Text>
              </View>
            </View>
            <OfflineIndicator />
          </View>
        </View>

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={[styles.card, { backgroundColor: colors.cardBackground }]}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Customer (optional)</Text>
            <View style={[styles.inputContainer, { borderColor: colors.borderColor, backgroundColor: colors.inputBackground }]}>
              <User size={20} color={colors.textSecondary} style={{ marginRight: 12 }} />
              <TextInput
                style={[styles.textInput, { color: colors.textColor }]}
                value={customerName}
                onChangeText={setCustomerName}
                placeholder="Name of customer"
                placeholderTextColor={colors.textSecondary}
              />
            </View>
            
            {paymentMode === 'Credit' && (
              <>
                <Text style={[styles.label, { color: colors.textSecondary, marginTop: 16 }]}>Customer Phone (Optional)</Text>
                <View style={[styles.inputContainer, { borderColor: colors.borderColor, backgroundColor: colors.inputBackground }]}>
                  <TextInput
                    style={[styles.textInput, { color: colors.textColor }]}
                    value={customerPhone}
                    onChangeText={setCustomerPhone}
                    placeholder="e.g. 0970000000"
                    keyboardType="phone-pad"
                    placeholderTextColor={colors.textSecondary}
                  />
                </View>
              </>
            )}
          </View>

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
            <Text style={[styles.label, { color: colors.textSecondary }]}>Select Product</Text>
            <View style={{ zIndex: 10 }}>
              <ProductSelector
                selectedProduct={selectedProduct}
                onSelect={(prod) => {
                  setSelectedProduct(prod);
                  if (prod && !amount) setAmount(prod.price.toString());
                }}
              />
            </View>
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
  bottomActions: { padding: 20, borderTopWidth: 1 },
  saveButton: { height: 56, backgroundColor: '#1e3a8a', borderRadius: 12, justifyContent: 'center', alignItems: 'center', elevation: 4 },
  saveButtonText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  modalContent: { padding: 20, borderRadius: 24 },
  modalActions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 20, paddingTop: 20, borderTopWidth: 1, borderTopColor: '#eee' },
});
