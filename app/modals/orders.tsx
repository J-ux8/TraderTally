import { OfflineIndicator } from '@/components/ui/OfflineIndicator';
import { useThemeColors } from '@/hooks/useThemeColors';
import { router, useFocusEffect } from "expo-router";
import { Package, ArrowLeft, Calendar as CalendarIcon, ChevronDown } from "lucide-react-native";
import React, { useCallback, useState } from "react";
import { FlatList, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { Calendar } from 'react-native-calendars';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/contexts/ThemeContext';
import { useCategoriesContext, Category } from '@/contexts/CategoriesContext';
import { placeOrder } from '@/lib/orders';
import { useToastContext } from '@/contexts/ToastContext';
import { useTransactionsContext } from '@/contexts/TransactionsContext';

export default function OrdersScreen() {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const { refresh } = useTransactionsContext();
  const { categories, addCategory, refresh: refreshCategories } = useCategoriesContext();
  const { success: showSuccess, error: showError } = useToastContext();

  const [productName, setProductName] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [orderPrice, setOrderPrice] = useState("");
  const [quantity, setQuantity] = useState("");
  const [sellingPrice, setSellingPrice] = useState("");
  const [date, setDate] = useState<Date>(new Date());
  const [loading, setLoading] = useState(false);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [tempDate, setTempDate] = useState<Date>(new Date());
  const [categoryPickerOpen, setCategoryPickerOpen] = useState(false);
  const [newCategoryModal, setNewCategoryModal] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");

  useFocusEffect(
    useCallback(() => {
      setProductName("");
      setSelectedCategory(null);
      setOrderPrice("");
      setQuantity("");
      setSellingPrice("");
      setDate(new Date());
    }, [])
  );

  const handleOrderPriceChange = (value: string) => {
    const cleaned = value.replace(/[^0-9.]/g, '');
    const parts = cleaned.split('.');
    if (parts.length > 2) return;
    if (parts[1]?.length > 2) return;
    setOrderPrice(cleaned);
  };

  const handleQuantityChange = (value: string) => {
    const cleaned = value.replace(/[^0-9.]/g, '');
    setQuantity(cleaned);
  };

  const handleSellingPriceChange = (value: string) => {
    const cleaned = value.replace(/[^0-9.]/g, '');
    const parts = cleaned.split('.');
    if (parts.length > 2) return;
    if (parts[1]?.length > 2) return;
    setSellingPrice(cleaned);
  };

  async function handleSubmit() {
    const numericOrderPrice = parseFloat(orderPrice);
    const numericQty = parseFloat(quantity);
    const numericSellingPrice = sellingPrice ? parseFloat(sellingPrice) : null;

    const name = productName.trim();
    if (!name) {
      showError('Missing Product Name', { message: 'Please enter the product name' });
      return;
    }
    if (!selectedCategory) {
      showError('Missing Category', { message: 'Please select a category' });
      return;
    }
    if (isNaN(numericOrderPrice) || numericOrderPrice <= 0) {
      showError('Invalid Order Price', { message: 'Please enter a valid order price per unit' });
      return;
    }
    if (isNaN(numericQty) || numericQty <= 0) {
      showError('Invalid Quantity', { message: 'Please enter a valid quantity' });
      return;
    }
    if (numericSellingPrice == null || isNaN(numericSellingPrice) || numericSellingPrice <= 0) {
      showError('Invalid Selling Price', { message: 'Please enter a valid selling price per unit' });
      return;
    }

    setLoading(true);

    try {
      await placeOrder({
        productName: name,
        categoryId: selectedCategory.id,
        categoryName: selectedCategory.name,
        orderPricePerUnit: numericOrderPrice,
        quantity: numericQty,
        sellingPrice: numericSellingPrice,
        purchasedAt: date.toISOString(),
      });

      const totalCostAmount = numericOrderPrice * numericQty;
      showSuccess(
        `Recorded ${numericQty} ${name}`,
        {
          amount: totalCostAmount,
          message: `(${selectedCategory.name}) — cost K${numericOrderPrice.toFixed(2)}/unit, sell at K${numericSellingPrice.toFixed(2)}/unit`
        }
      );
      refresh();
      router.back();
    } catch (error: any) {
      console.error('Error recording order:', error);
      showError('Failed to Record Order', { message: error.message || 'Please try again' });
    } finally {
      setLoading(false);
    }
  }

  const handleAddNewCategory = async () => {
    const name = newCategoryName.trim();
    if (!name) {
      showError('Missing Name', { message: 'Please enter a category name' });
      return;
    }
    try {
      const cat = await addCategory(name, 'income');
      setSelectedCategory(cat);
      setNewCategoryModal(false);
      setNewCategoryName("");
      await refreshCategories();
    } catch (err: any) {
      showError('Failed to add category', { message: err.message });
    }
  };

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
              <View style={styles.headerIcon}><Package size={22} color="#1e3a8a" /></View>
              <View style={styles.headerTextContainer}>
                <Text style={[styles.headerTitle, { color: colors.textColor }]}>Record Stock</Text>
                <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>Order new stock from supplier</Text>
              </View>
            </View>
            <OfflineIndicator />
          </View>
        </View>

        <ScrollView style={styles.scrollView} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={[styles.card, { backgroundColor: colors.cardBackground }]}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Product Name</Text>
            <TextInput
              style={[styles.quantityInput, { color: colors.textColor, backgroundColor: colors.inputBackground, borderColor: colors.borderColor }]}
              value={productName}
              onChangeText={setProductName}
              placeholder="e.g. Coca-Cola"
              placeholderTextColor={colors.textSecondary}
              autoFocus
            />
          </View>

          <View style={[styles.card, { backgroundColor: colors.cardBackground }]}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Category</Text>
            <TouchableOpacity
              style={[styles.quantityInput, { backgroundColor: colors.inputBackground, borderColor: colors.borderColor, justifyContent: 'center' }]}
              onPress={() => setCategoryPickerOpen(true)}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ color: selectedCategory ? colors.textColor : colors.textSecondary, fontSize: 16, fontWeight: '600' }}>
                  {selectedCategory ? selectedCategory.name : 'Tap to select category'}
                </Text>
                <ChevronDown size={20} color={colors.textSecondary} />
              </View>
            </TouchableOpacity>
          </View>

          <View style={[styles.card, { backgroundColor: colors.cardBackground }]}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Order Price Per Unit (ZMW)</Text>
            <View style={styles.amountContainer}>
              <Text style={[styles.amountPrefix, { color: colors.textColor }]}>K</Text>
              <TextInput
                style={[styles.amountInput, { color: colors.textColor }]}
                value={orderPrice}
                onChangeText={handleOrderPriceChange}
                placeholder="0.00"
                keyboardType="decimal-pad"
                placeholderTextColor="rgba(30, 58, 138, 0.4)"
              />
            </View>
          </View>

          <View style={[styles.card, { backgroundColor: colors.cardBackground }]}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Quantity</Text>
            <TextInput
              style={[styles.quantityInput, { color: colors.textColor, backgroundColor: colors.inputBackground, borderColor: colors.borderColor }]}
              value={quantity}
              onChangeText={handleQuantityChange}
              placeholder="e.g. 24"
              keyboardType="decimal-pad"
              placeholderTextColor={colors.textSecondary}
            />
          </View>

          <View style={[styles.card, { backgroundColor: colors.cardBackground }]}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Selling Price per Unit (ZMW)</Text>
            <View style={styles.amountContainer}>
              <Text style={[styles.amountPrefix, { color: colors.textColor }]}>K</Text>
              <TextInput
                style={[styles.amountInput, { color: colors.textColor }]}
                value={sellingPrice}
                onChangeText={handleSellingPriceChange}
                placeholder="0.00"
                keyboardType="decimal-pad"
                placeholderTextColor="rgba(30, 58, 138, 0.4)"
              />
            </View>
            <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 8 }}>
              The price each unit will be sold for
            </Text>
          </View>

          {orderPrice && quantity && sellingPrice && (
            <View style={[styles.card, { backgroundColor: colors.cardBackground, borderColor: '#10b981', borderWidth: 1 }]}>
              <Text style={[styles.label, { color: '#10b981' }]}>Order Summary</Text>
              <View style={{ gap: 6 }}>
                <SummaryLine label="Cost per unit" value={parseFloat(orderPrice)} />
                <SummaryLine label="Selling price" value={parseFloat(sellingPrice)} />
                <SummaryLine label="Profit per unit" value={parseFloat(sellingPrice) - parseFloat(orderPrice)} color={parseFloat(sellingPrice) >= parseFloat(orderPrice) ? '#10b981' : '#ef4444'} />
                <SummaryLine label="Total cost" value={parseFloat(orderPrice) * parseFloat(quantity)} bold />
              </View>
            </View>
          )}

          <View style={[styles.card, { backgroundColor: colors.cardBackground }]}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Date of Order</Text>
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
          <TouchableOpacity style={styles.saveButton} onPress={handleSubmit} disabled={!productName.trim() || !selectedCategory || !orderPrice || !quantity || !sellingPrice || loading}>
            <Text style={styles.saveButtonText}>{loading ? 'Saving...' : 'Save'}</Text>
          </TouchableOpacity>
        </View>

        {/* Category Picker Modal */}
        <Modal visible={categoryPickerOpen} transparent animationType="slide">
          <View style={styles.overlay}>
            <View style={[styles.modalContent, { backgroundColor: colors.cardBackground, maxHeight: 400 }]}>
              <Text style={[styles.modalTitle, { color: colors.textColor }]}>Select Category</Text>
              <FlatList
                data={categories}
                keyExtractor={item => item.id}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[styles.pickerItem, { borderBottomColor: colors.borderColor }]}
                    onPress={() => { setSelectedCategory(item); setCategoryPickerOpen(false); }}
                  >
                    <Text style={[styles.pickerItemText, { color: colors.textColor }]}>{item.name}</Text>
                  </TouchableOpacity>
                )}
                ListFooterComponent={() => (
                  <TouchableOpacity
                    style={[styles.pickerItem, { borderBottomColor: colors.borderColor }]}
                    onPress={() => { setCategoryPickerOpen(false); setNewCategoryModal(true); }}
                  >
                    <Text style={{ color: '#1e3a8a', fontWeight: '700', fontSize: 15 }}>+ Add New Category</Text>
                  </TouchableOpacity>
                )}
              />
              <TouchableOpacity style={styles.modalCloseButton} onPress={() => setCategoryPickerOpen(false)}>
                <Text style={{ color: colors.textSecondary, fontWeight: '600' }}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* New Category Modal */}
        <Modal visible={newCategoryModal} transparent animationType="fade">
          <View style={styles.overlay}>
            <View style={[styles.modalContent, { backgroundColor: colors.cardBackground }]}>
              <Text style={[styles.modalTitle, { color: colors.textColor }]}>New Category</Text>
              <TextInput
                style={[styles.quantityInput, { color: colors.textColor, backgroundColor: colors.inputBackground, borderColor: colors.borderColor, marginBottom: 16 }]}
                value={newCategoryName}
                onChangeText={setNewCategoryName}
                placeholder="Category name"
                placeholderTextColor={colors.textSecondary}
                autoFocus
              />
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <TouchableOpacity
                  style={[styles.modalCloseButton, { flex: 1 }]}
                  onPress={() => { setNewCategoryModal(false); setNewCategoryName(""); }}
                >
                  <Text style={{ color: colors.textSecondary, fontWeight: '600', textAlign: 'center' }}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.saveButton, { flex: 1 }]}
                  onPress={handleAddNewCategory}
                >
                  <Text style={styles.saveButtonText}>Add</Text>
                </TouchableOpacity>
              </View>
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

function SummaryLine({ label, value, color, bold }: { label: string; value: number | null; color?: string; bold?: boolean }) {
  if (value == null) return null;
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
      <Text style={{ fontSize: 13, color: '#666' }}>{label}</Text>
      <Text style={{ fontSize: 14, fontWeight: bold ? '700' : '600', color: color ?? '#333' }}>
        K{value.toFixed(2)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
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
  headerTextContainer: { flex: 1 },
  headerTitle: { fontSize: 22, fontWeight: '800', marginBottom: 2 },
  headerSubtitle: { fontSize: 13, fontWeight: '500' },
  scrollView: { flex: 1 },
  content: { padding: 20, gap: 20 },
  card: { padding: 20, borderRadius: 16, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8 },
  label: { fontSize: 14, fontWeight: '700', marginBottom: 12 },
  amountContainer: { position: 'relative' },
  amountPrefix: { position: 'absolute', left: 16, top: '50%', marginTop: -24, fontSize: 32, fontWeight: '800', zIndex: 1 },
  amountInput: { width: '100%', height: 80, paddingLeft: 56, fontSize: 36, fontWeight: '800', borderRadius: 16, borderWidth: 2, borderColor: 'rgba(30, 58, 138, 0.3)', backgroundColor: 'rgba(30, 58, 138, 0.05)' },
  quantityInput: { width: '100%', height: 56, paddingHorizontal: 16, fontSize: 18, fontWeight: '600', borderRadius: 12, borderWidth: 2 },
  dateButton: { height: 56, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 12, borderWidth: 2 },
  dateButtonText: { fontSize: 16, fontWeight: '600' },
  bottomActions: { padding: 20, borderTopWidth: 1 },
  saveButton: { height: 56, backgroundColor: '#1e3a8a', borderRadius: 12, justifyContent: 'center', alignItems: 'center', elevation: 4 },
  saveButtonText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
  modalContent: { padding: 20, borderRadius: 24 },
  modalTitle: { fontSize: 18, fontWeight: '700', marginBottom: 16 },
  modalActions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 20, paddingTop: 20, borderTopWidth: 1, borderTopColor: '#eee' },
  modalCloseButton: { padding: 12, alignItems: 'center', marginTop: 8 },
  pickerItem: { paddingVertical: 14, borderBottomWidth: 1 },
  pickerItemText: { fontSize: 16, fontWeight: '500' },
});
