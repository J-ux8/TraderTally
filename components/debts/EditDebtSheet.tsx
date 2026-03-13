import { getLocalISOString } from '@/lib/dateUtils';
import { Debt } from '@/lib/debts';
import { Calendar as CalendarIcon, Trash2, X } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { Alert, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Calendar } from 'react-native-calendars';

interface EditDebtSheetProps {
  debt: Debt | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (id: string, data: {
    customer_name: string;
    amount: number;
    due_date: string | null;
    note: string | null;
  }) => void;
  onDelete: (id: string) => void;
}

export function EditDebtSheet({ debt, open, onOpenChange, onSave, onDelete }: EditDebtSheetProps) {
  const [customerName, setCustomerName] = useState('');
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState<Date | null>(null);
  const [note, setNote] = useState('');
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [tempDate, setTempDate] = useState<Date>(new Date());

  useEffect(() => {
    if (debt) {
      setCustomerName(debt.customer_name);
      setAmount(String(debt.amount));
      setDueDate(debt.due_date ? new Date(debt.due_date) : null);
      setNote(debt.note || '');
    }
  }, [debt]);

  const handleAmountChange = (value: string) => {
    const cleaned = value.replace(/[^0-9.]/g, '');
    const parts = cleaned.split('.');
    if (parts.length > 2) return;
    if (parts[1]?.length > 2) return;
    setAmount(cleaned);
  };

  const handleSave = () => {
    if (!debt) return;

    if (!customerName.trim()) {
      Alert.alert('Error', 'Please enter customer name');
      return;
    }

    const numericAmount = parseFloat(amount);
    if (!amount || isNaN(numericAmount) || numericAmount <= 0) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }

    onSave(debt.id, {
      customer_name: customerName.trim(),
      amount: numericAmount,
      due_date: dueDate ? getLocalISOString(dueDate).split('T')[0] : null,
      note: note.trim() || null,
    });

    onOpenChange(false);
  };

  const handleDelete = () => {
    if (!debt) return;

    Alert.alert(
      'Delete Debt',
      'Are you sure you want to delete this debt? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            onDelete(debt.id);
            onOpenChange(false);
          },
        },
      ]
    );
  };

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

  if (!debt) return null;

  return (
    <Modal
      visible={open}
      transparent
      animationType="slide"
      onRequestClose={() => onOpenChange(false)}
    >
      <View style={styles.overlay}>
        <TouchableOpacity
          style={styles.overlayTouchable}
          activeOpacity={1}
          onPress={() => onOpenChange(false)}
        />
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>Edit Debt</Text>
            <TouchableOpacity
              onPress={() => onOpenChange(false)}
              style={styles.closeButton}
              activeOpacity={0.7}
            >
              <X size={24} color="#666" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {/* Customer Name */}
            <View style={styles.inputCard}>
              <Text style={styles.label}>Customer Name</Text>
              <TextInput
                style={styles.input}
                value={customerName}
                onChangeText={setCustomerName}
                placeholder="Enter customer name"
                placeholderTextColor="#999"
                autoCapitalize="words"
              />
            </View>

            {/* Amount */}
            <View style={styles.inputCard}>
              <Text style={styles.label}>Amount (ZMW)</Text>
              <View style={styles.amountContainer}>
                <Text style={styles.amountPrefix}>K</Text>
                <TextInput
                  style={styles.amountInput}
                  value={amount}
                  onChangeText={handleAmountChange}
                  placeholder="0.00"
                  keyboardType="decimal-pad"
                  placeholderTextColor="#999"
                />
              </View>
            </View>

            {/* Due Date */}
            <View style={styles.inputCard}>
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
            <View style={styles.inputCard}>
              <Text style={styles.label}>Note (optional)</Text>
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
              <Text style={styles.charCounter}>{note.length}/200</Text>
            </View>
          </ScrollView>

          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.deleteButton}
              onPress={handleDelete}
              activeOpacity={0.7}
            >
              <Trash2 size={20} color="#ef4444" />
              <Text style={styles.deleteButtonText}>Delete</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.saveButton}
              onPress={handleSave}
              activeOpacity={0.8}
            >
              <Text style={styles.saveButtonText}>Save Changes</Text>
            </TouchableOpacity>
          </View>
        </View>
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
                    const selectedDate = new Date(day.dateString);
                    setTempDate(selectedDate);
                    if (Platform.OS === 'android') {
                      setDueDate(selectedDate);
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
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  overlayTouchable: {
    flex: 1,
  },
  sheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#333',
  },
  closeButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    padding: 20,
  },
  inputCard: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    color: '#666',
    marginBottom: 12,
  },
  input: {
    backgroundColor: '#f9fafb',
    borderWidth: 2,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  amountContainer: {
    position: 'relative',
  },
  amountPrefix: {
    position: 'absolute',
    left: 16,
    top: '50%',
    marginTop: -16,
    fontSize: 20,
    fontWeight: '800',
    color: '#1e3a8a',
    zIndex: 1,
  },
  amountInput: {
    backgroundColor: '#f9fafb',
    borderWidth: 2,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    paddingLeft: 48,
    paddingRight: 16,
    paddingVertical: 16,
    fontSize: 18,
    fontWeight: '700',
    color: '#1e3a8a',
  },
  dateButton: {
    backgroundColor: '#f9fafb',
    borderWidth: 2,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dateButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  dateButtonPlaceholder: {
    color: '#999',
    fontWeight: '500',
  },
  clearDateButton: {
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  clearDateText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ef4444',
  },
  noteInput: {
    backgroundColor: '#f9fafb',
    borderWidth: 2,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    minHeight: 100,
    lineHeight: 22,
  },
  charCounter: {
    fontSize: 12,
    color: '#999',
    textAlign: 'right',
    marginTop: 8,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    padding: 20,
    paddingTop: 0,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  deleteButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    borderWidth: 2,
    borderColor: '#ef4444',
    borderRadius: 12,
    paddingVertical: 16,
    gap: 8,
  },
  deleteButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ef4444',
  },
  saveButton: {
    flex: 1,
    backgroundColor: '#1e3a8a',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalOverlayTouchable: {
    flex: 1,
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 20,
    maxHeight: '85%',
  },
  modalHeader: {
    alignItems: 'center',
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    marginBottom: 16,
    paddingHorizontal: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#333',
  },
  calendarContainer: {
    paddingHorizontal: 16,
    paddingBottom: 24,
    alignItems: 'center',
  },
  calendarStyle: {
    width: '100%',
    borderRadius: 16,
    padding: 8,
  },
  dateActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    width: '100%',
  },
  dateCancelButton: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: 12,
    backgroundColor: '#f5f5f5',
  },
  dateCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  dateConfirmButton: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: 12,
    backgroundColor: '#1e3a8a',
  },
  dateConfirmText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
});

