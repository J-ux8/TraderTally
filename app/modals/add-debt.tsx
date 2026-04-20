import { getLocalISOString } from "@/lib/dateUtils";
import { OfflineIndicator } from "@/components/ui/OfflineIndicator";
import { useDebts } from "@/hooks/useDebts";
import { useToastContext } from "@/contexts/ToastContext";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { ArrowLeft, Calendar as CalendarIcon, FileText, Phone, Plus, User } from "lucide-react-native";
import { useCallback, useState } from "react";
import { Alert, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { Calendar } from 'react-native-calendars';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function AddDebtScreen() {
  const params = useLocalSearchParams<{ amount?: string; note?: string; isSale?: string; category?: string }>();
  const { createDebt: createDebtFromHook, refresh: refreshDebts } = useDebts();
  const { success: showSuccess, error: showError } = useToastContext();
  const [debtType, setDebtType] = useState<'receivable' | 'payable'>((params as any).type || 'receivable');
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [amount, setAmount] = useState(params.amount || "");
  const [dueDate, setDueDate] = useState<Date | null>(null);
  const [note, setNote] = useState(params.note || "");
  const [loading, setLoading] = useState(false);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [tempDate, setTempDate] = useState<Date>(new Date());

  useFocusEffect(
    useCallback(() => {
      // Clear form when screen is focused
      setDebtType((params as any).type || 'receivable');
      setCustomerName("");
      setCustomerPhone("");
      setAmount("");
      setDueDate(null);
      setNote("");
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
    if (!customerName.trim()) {
      showError(debtType === 'receivable' ? 'Missing Customer' : 'Missing Supplier', { message: `Please enter ${debtType === 'receivable' ? 'customer' : 'supplier'} name` });
      return;
    }

    const numericAmount = parseFloat(amount);
    if (!amount || isNaN(numericAmount) || numericAmount <= 0) {
      showError('Invalid Amount', { message: 'Please enter a valid amount' });
      return;
    }

    setLoading(true);

    try {
      await createDebtFromHook(
        customerName.trim(),
        numericAmount,
        dueDate ? getLocalISOString(dueDate).split("T")[0] : null,
        note.trim() || null,
        customerPhone.trim() || undefined,
        debtType
      );

      await refreshDebts(true);

      showSuccess(debtType === 'receivable' ? 'Credit Added' : 'Debt Recorded', {
        amount: numericAmount,
        category: customerName.trim(),
        message: debtType === 'receivable' ? 'Added to Credit Book' : 'Added to Money I Owe',
      });
      router.back();
    } catch (error: any) {
      console.error('Error recording debt:', error);
      showError(debtType === 'receivable' ? 'Failed to Add Credit' : 'Failed to Record Debt', { message: error.message || 'Please try again' });
    } finally {
      setLoading(false);
    }
  }

  const formatDate = (dateToFormat: Date) => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    const day = days[dateToFormat.getDay()];
    const month = months[dateToFormat.getMonth()];
    const dateNum = dateToFormat.getDate();
    const year = dateToFormat.getFullYear();

    return `${day}, ${month} ${dateNum}, ${year}`;
  };

  const formatDateForCalendar = (dateToFormat: Date) => {
    const year = dateToFormat.getFullYear();
    const month = String(dateToFormat.getMonth() + 1).padStart(2, '0');
    const day = String(dateToFormat.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const selectedDateString = dueDate ? formatDateForCalendar(dueDate) : formatDateForCalendar(tempDate);
  const todayString = formatDateForCalendar(new Date());

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerDecoration} />
          <View style={styles.headerContent}>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => router.back()}
              activeOpacity={0.7}
            >
              <ArrowLeft size={20} color="#ffffff" />
            </TouchableOpacity>
            <View style={styles.headerTitleContainer}>
              <View style={styles.headerIcon}>
                <Plus size={20} color="#ffffff" />
              </View>
              <View>
                <Text style={styles.headerTitle}>{debtType === 'receivable' ? 'Add Credit' : 'Add Debt'}</Text>
                <Text style={styles.headerSubtitle}>{debtType === 'receivable' ? 'Record money owed to you' : 'Record money you owe'}</Text>
              </View>
            </View>
            <OfflineIndicator />
          </View>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Debt Type Selector */}
          <View style={styles.typeSelector}>
            <TouchableOpacity
              style={[styles.typeButton, debtType === 'receivable' && styles.typeButtonActive]}
              onPress={() => setDebtType('receivable')}
              activeOpacity={0.7}
            >
              <Text style={[styles.typeButtonText, debtType === 'receivable' && styles.typeButtonTextActive]}>
                Money Owed To Me
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.typeButton, debtType === 'payable' && styles.typeButtonActivePayable]}
              onPress={() => setDebtType('payable')}
              activeOpacity={0.7}
            >
              <Text style={[styles.typeButtonText, debtType === 'payable' && styles.typeButtonTextActive]}>
                Money I Owe
              </Text>
            </TouchableOpacity>
          </View>

          {/* Customer / Supplier Name */}
          <View style={styles.card}>
            <Text style={styles.label}>{debtType === 'receivable' ? 'Customer Name' : 'Supplier/Person Name'}</Text>
            <View style={styles.inputContainer}>
              <User size={20} color="#666" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                value={customerName}
                onChangeText={setCustomerName}
                placeholder={debtType === 'receivable' ? "Enter customer name" : "Enter person/business name"}
                placeholderTextColor="#999"
                autoCapitalize="words"
                autoFocus
              />
            </View>
            {debtType === 'payable' && (
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={false} 
                style={{ marginTop: 12 }} 
                contentContainerStyle={{ gap: 8 }}
                keyboardShouldPersistTaps="handled"
              >
                {['Supplier', 'Landlord', 'Employee', 'Service Provider'].map((cat) => (
                   <TouchableOpacity 
                     key={cat} 
                     style={styles.suggestionPill} 
                     onPress={() => setCustomerName(cat)}
                     activeOpacity={0.7}
                   >
                     <Text style={styles.suggestionPillText}>{cat}</Text>
                   </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </View>

          {/* Phone Number */}
          <View style={styles.card}>
            <Text style={styles.label}>
              {debtType === 'receivable' ? 'Phone Number (WhatsApp)' : 'Supplier Phone (Optional)'}
            </Text>
            <View style={styles.inputContainer}>
              <Phone size={20} color="#666" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                value={customerPhone}
                onChangeText={setCustomerPhone}
                placeholder="e.g. 0970000000"
                placeholderTextColor="#999"
                keyboardType="phone-pad"
              />
            </View>
          </View>

          {/* Amount */}
          <View style={styles.card}>
            <Text style={styles.label}>Amount (ZMW)</Text>
            <View style={styles.amountContainer}>
              <Text style={styles.amountPrefix}>K</Text>
              <TextInput
                style={styles.amountInput}
                value={amount}
                onChangeText={handleAmountChange}
                placeholder="0.00"
                keyboardType="decimal-pad"
                placeholderTextColor="rgba(30, 58, 138, 0.4)"
              />
            </View>
          </View>

          {/* Due Date */}
          <View style={styles.card}>
            <Text style={styles.label}>Due Date (optional)</Text>
            <TouchableOpacity
              style={styles.dateButton}
              onPress={() => {
                setTempDate(dueDate || new Date());
                setDatePickerOpen(true);
              }}
              activeOpacity={0.7}
            >
              <Text style={[styles.dateButtonText, !dueDate && styles.dateButtonPlaceholder]}>
                {dueDate ? formatDate(dueDate) : 'Select due date'}
              </Text>
              <CalendarIcon size={20} color="#666" />
            </TouchableOpacity>
            {dueDate && (
              <TouchableOpacity
                onPress={() => setDueDate(null)}
                style={styles.clearDateButton}
                activeOpacity={0.7}
              >
                <Text style={styles.clearDateText}>Clear date</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Note */}
          <View style={styles.card}>
            <Text style={styles.label}>Note (optional)</Text>
            <View style={styles.noteContainer}>
              <FileText size={20} color="#666" style={styles.inputIcon} />
              <TextInput
                style={styles.noteInput}
                value={note}
                onChangeText={(text) => {
                  if (text.length <= 200) {
                    setNote(text);
                  }
                }}
                placeholder="Add a note..."
                placeholderTextColor="#999"
                multiline
                numberOfLines={3}
                textAlignVertical="top"
                maxLength={200}
              />
            </View>
            <Text style={styles.charCounter}>{note.length}/200</Text>
          </View>
        </ScrollView>

        {/* Bottom Actions */}
        <View style={styles.bottomActions}>
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={() => router.back()}
            disabled={loading}
            activeOpacity={0.7}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.saveButton, (!customerName || !amount || loading) && styles.saveButtonDisabled]}
            onPress={handleSubmit}
            disabled={!customerName || !amount || loading}
            activeOpacity={0.8}
          >
            <Text style={styles.saveButtonText}>
              {loading ? 'Saving...' : (debtType === 'receivable' ? 'Save Credit' : 'Save Debt')}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Date Picker Modal */}
        {datePickerOpen && (
          <Modal
            visible={datePickerOpen}
            transparent
            animationType="slide"
            onRequestClose={() => setDatePickerOpen(false)}
          >
            <View style={styles.modalOverlay}>
              <TouchableOpacity
                style={styles.modalOverlayTouchable}
                activeOpacity={1}
                onPress={() => setDatePickerOpen(false)}
              />
              <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Select Due Date</Text>
                </View>
                <View style={styles.calendarContainer}>
                  <Calendar
                    current={selectedDateString}
                    onDayPress={(day) => {
                      const selectedDate = new Date(day.timestamp);
                      setTempDate(selectedDate);
                      setDueDate(selectedDate);
                      if (Platform.OS === 'android') {
                        setDatePickerOpen(false);
                      }
                    }}
                    minDate={todayString}
                    theme={{
                      backgroundColor: '#ffffff',
                      calendarBackground: '#ffffff',
                      textSectionTitleColor: '#666',
                      selectedDayBackgroundColor: '#1e3a8a',
                      selectedDayTextColor: '#ffffff',
                      todayTextColor: '#1e3a8a',
                      dayTextColor: '#333',
                      textDisabledColor: '#d3d3d3',
                      dotColor: '#1e3a8a',
                      selectedDotColor: '#ffffff',
                      arrowColor: '#1e3a8a',
                      monthTextColor: '#333',
                      textDayFontWeight: '600',
                      textMonthFontWeight: 'bold',
                      textDayHeaderFontWeight: '600',
                      textDayFontSize: 16,
                      textMonthFontSize: 18,
                      textDayHeaderFontSize: 14,
                    }}
                    style={styles.calendarStyle}
                    markedDates={{
                      [selectedDateString]: {
                        selected: true,
                        selectedColor: '#1e3a8a',
                        selectedTextColor: '#ffffff',
                      },
                    }}
                    markingType="custom"
                    enableSwipeMonths
                    hideExtraDays
                    firstDay={1}
                  />
                  <View style={styles.dateActions}>
                    <TouchableOpacity
                      style={styles.dateCancelButton}
                      onPress={() => setDatePickerOpen(false)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.dateCancelText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.dateConfirmButton}
                      onPress={() => {
                        setDueDate(tempDate);
                        setDatePickerOpen(false);
                      }}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.dateConfirmText}>Done</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </View>
          </Modal>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  header: {
    backgroundColor: "#1e3a8a",
    paddingTop: 50,
    paddingBottom: 24,
    paddingHorizontal: 16,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    position: "relative",
    overflow: "hidden",
  },
  headerDecoration: {
    position: "absolute",
    top: -40,
    right: -40,
    width: 128,
    height: 128,
    borderRadius: 64,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
  },
  headerContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    zIndex: 10,
  },
  backButton: {
    width: 44,
    height: 44,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 12,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
  },
  headerTitleContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  headerIcon: {
    width: 40,
    height: 40,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#ffffff",
  },
  headerSubtitle: {
    fontSize: 14,
    color: "rgba(255, 255, 255, 0.8)",
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingTop: 20,
    gap: 24,
  },
  typeSelector: {
    flexDirection: 'row',
    backgroundColor: '#e5e7eb',
    borderRadius: 12,
    padding: 4,
    marginBottom: 8,
  },
  typeButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 8,
  },
  typeButtonActive: {
    backgroundColor: '#10b981', // green for receivable
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  typeButtonActivePayable: {
    backgroundColor: '#ef4444', // red for payable
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  typeButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6b7280',
  },
  typeButtonTextActive: {
    color: '#ffffff',
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  suggestionPill: {
    backgroundColor: 'rgba(30, 58, 138, 0.08)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(30, 58, 138, 0.15)',
  },
  suggestionPillText: {
    color: '#1e3a8a',
    fontSize: 13,
    fontWeight: '600',
  },
  label: {
    fontSize: 14,
    fontWeight: "700",
    color: "#666",
    marginBottom: 12,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f9fafb",
    borderWidth: 2,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    paddingHorizontal: 16,
    minHeight: 56,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    fontWeight: "500",
    color: "#333",
    paddingVertical: 0,
  },
  amountContainer: {
    position: "relative",
  },
  amountPrefix: {
    position: "absolute",
    left: 16,
    top: "50%",
    marginTop: -24,
    fontSize: 32,
    fontWeight: "800",
    color: "#1e3a8a",
    zIndex: 1,
  },
  amountInput: {
    width: "100%",
    height: 80,
    paddingLeft: 56,
    paddingRight: 16,
    fontSize: 36,
    fontWeight: "800",
    backgroundColor: "rgba(30, 58, 138, 0.05)",
    borderWidth: 2,
    borderColor: "rgba(30, 58, 138, 0.3)",
    borderRadius: 16,
    color: "#1e3a8a",
  },
  dateButton: {
    width: "100%",
    height: 56,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#f9fafb",
    borderWidth: 2,
    borderColor: "#e5e7eb",
    borderRadius: 12,
  },
  dateButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
  },
  dateButtonPlaceholder: {
    color: "#999",
    fontWeight: "500",
  },
  clearDateButton: {
    marginTop: 8,
    alignSelf: "flex-start",
  },
  clearDateText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#ef4444",
  },
  noteContainer: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#f9fafb",
    borderWidth: 2,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    padding: 16,
    minHeight: 100,
  },
  noteInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: "500",
    color: "#333",
    lineHeight: 22,
    paddingTop: 0,
  },
  charCounter: {
    fontSize: 12,
    color: "#999",
    textAlign: "right",
    marginTop: 8,
  },
  bottomActions: {
    flexDirection: "row",
    gap: 12,
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
    backgroundColor: "#ffffff",
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 4,
  },
  cancelButton: {
    flex: 1,
    height: 56,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#ffffff",
    borderWidth: 2,
    borderColor: "#e5e7eb",
    borderRadius: 12,
  },
  cancelButtonText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#666",
  },
  saveButton: {
    flex: 1,
    height: 56,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#1e3a8a",
    borderRadius: 12,
    shadowColor: "#1e3a8a",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#ffffff",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalOverlayTouchable: {
    flex: 1,
  },
  modalContent: {
    backgroundColor: "#ffffff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 20,
    maxHeight: "85%",
  },
  modalHeader: {
    alignItems: "center",
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    marginBottom: 16,
    paddingHorizontal: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#333",
  },
  calendarContainer: {
    paddingHorizontal: 16,
    paddingBottom: 24,
    alignItems: "center",
  },
  calendarStyle: {
    width: "100%",
    borderRadius: 16,
    padding: 8,
  },
  dateActions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
    width: "100%",
  },
  dateCancelButton: {
    flex: 1,
    paddingVertical: 14,
    alignItems: "center",
    borderRadius: 12,
    backgroundColor: "#f5f5f5",
  },
  dateCancelText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#666",
  },
  dateConfirmButton: {
    flex: 1,
    paddingVertical: 14,
    alignItems: "center",
    borderRadius: 12,
    backgroundColor: "#1e3a8a",
  },
  dateConfirmText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#ffffff",
  },
  loadingText: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
    marginTop: 50,
  },
});
