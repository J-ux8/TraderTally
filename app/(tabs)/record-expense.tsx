import { useTransactionsContext } from '@/contexts/TransactionsContext';
import { useThemeColors } from '@/hooks/useThemeColors';
import { supabase } from "@/lib/supabase";
import { createCategory } from "@/lib/transactions";
import { router, useFocusEffect } from "expo-router";
import { ArrowLeft, Calendar as CalendarIcon, Check, ChevronDown, Plus, TrendingDown } from "lucide-react-native";
import React, { useCallback, useEffect, useState } from "react";
import { Alert, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { Calendar } from 'react-native-calendars';
import { SafeAreaView } from 'react-native-safe-area-context';

interface UserCategory {
  id: string;
  name: string;
}

// Predefined expense types for micro-entrepreneurs
const EXPENSE_TYPES = [
  'Rent',
  'Salaries',
  'Transport',
  'Stock/Inventory',
  'Utilities',
  'Marketing',
  'Office Supplies',
  'Fuel',
  'Maintenance',
  'Insurance',
  'Taxes',
  'Other'
];

export default function RecordExpenseScreen() {
  const colors = useThemeColors();
  const { categories: contextCategories, addTransaction, updateTransaction, removeTransaction, refreshCategories, addCategory, recordExpense } = useTransactionsContext();
  const [user, setUser] = useState<any>(null);
  const [amount, setAmount] = useState("");
  const [expenseType, setExpenseType] = useState<string | null>(null);
  const [date, setDate] = useState<Date>(new Date());
  const [categories, setCategories] = useState<UserCategory[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [showExpenseTypeDropdown, setShowExpenseTypeDropdown] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [loading, setLoading] = useState(false);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [tempDate, setTempDate] = useState<Date>(new Date());

  useEffect(() => {
    checkUserAndLoadCategories();
  }, []);

  // Use categories from context
  useEffect(() => {
    if (contextCategories.length > 0) {
      setCategories(contextCategories.map(cat => ({ id: cat.id, name: cat.name })));
    }
  }, [contextCategories]);

  // Clear form when screen comes into focus (after successful submission)
  useFocusEffect(
    useCallback(() => {
      // Reset form to default state when screen is focused
      setAmount("");
      setExpenseType(null);
      setSelectedCategory(null);
      setDate(new Date());
      setDatePickerOpen(false);
      setShowCategoryDropdown(false);
      setShowExpenseTypeDropdown(false);
    }, [])
  );

  async function checkUserAndLoadCategories() {
    try {
      // First check session to avoid race conditions
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        router.replace("/Authentication/login");
        return;
      }
      
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) {
        router.replace("/Authentication/login");
        return;
      }
      setUser(currentUser);
      // Categories are loaded from context, no need to fetch
    } catch (error) {
      console.error("Error checking user:", error);
      router.replace("/Authentication/login");
    }
  }

  const handleAmountChange = (value: string) => {
    // Only allow numbers and one decimal point
    const cleaned = value.replace(/[^0-9.]/g, '');
    const parts = cleaned.split('.');
    if (parts.length > 2) return;
    if (parts[1]?.length > 2) return;
    setAmount(cleaned);
  };

  async function handleAddCategory() {
    if (!newCategoryName.trim() || !user) return;
    
    // Check if category already exists (case-insensitive)
    const exists = categories.some(
      c => c.name.toLowerCase() === newCategoryName.trim().toLowerCase()
    );
    
    if (exists) {
      Alert.alert('Error', 'Category already exists');
      return;
    }
    
    try {
      const data = await createCategory(newCategoryName.trim(), user.id);
      
      if (data) {
        // Add to context immediately (optimistic update)
        addCategory({ id: data.id, name: data.name });
        // Also refresh from server to ensure consistency
        await refreshCategories();
        setSelectedCategory(data.name);
        setNewCategoryName('');
        setIsAddingCategory(false);
        setShowCategoryDropdown(true);
      }
    } catch (error: any) {
      console.error('Error adding category:', error);
      Alert.alert('Error', error.message || 'Failed to add category');
    }
  }

  async function handleSubmit() {
    if (!user) return;
    
    const numericAmount = parseFloat(amount);
    if (!amount || isNaN(numericAmount) || numericAmount <= 0) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }
    
    setLoading(true);
    
    // Get local date string (avoid timezone issues)
    const getLocalDateString = (d: Date) => {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };
    
    const dateStr = getLocalDateString(date);
    
    // Optimistic update - add transaction immediately
    const tempId = `temp-${Date.now()}`;
    const optimisticTransaction = {
      id: tempId,
      amount: -Math.abs(numericAmount), // Negative for expense
      category: selectedCategory || expenseType,
      description: expenseType || null,
      transaction_date: dateStr,
      created_at: new Date().toISOString(),
      user_id: user.id,
    };
    addTransaction(optimisticTransaction);
    
    try {
      // Use context to record (local-first)
      const result = await recordExpense(numericAmount, selectedCategory, expenseType || null, dateStr);

      // Replace optimistic transaction with returned local record
      if (result) {
        removeTransaction(tempId);
        addTransaction(result as any);
      }
      
      // Clear form fields
      setAmount("");
      setExpenseType(null);
      setSelectedCategory(null);
      setDate(new Date());
      
      Alert.alert("Success", "Expense recorded! 💸");
      router.back();
    } catch (error: any) {
      console.error('Error recording expense:', error);
      // Remove optimistic transaction on error
      removeTransaction(tempId);
      Alert.alert('Error', error.message || 'Failed to record expense');
    } finally {
      setLoading(false);
    }
  }

  const selectedCategoryName = categories.find(c => c.name === selectedCategory)?.name;
  
  // Format date helper
  const formatDate = (dateToFormat: Date) => {
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    
    const isToday = dateToFormat.toDateString() === today.toDateString();
    const isYesterday = dateToFormat.toDateString() === yesterday.toDateString();
    
    if (isToday) {
      return 'Today';
    }
    if (isYesterday) {
      return 'Yesterday';
    }
    
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    const day = days[dateToFormat.getDay()];
    const month = months[dateToFormat.getMonth()];
    const dateNum = dateToFormat.getDate();
    const year = dateToFormat.getFullYear();
    
    return `${day}, ${month} ${dateNum}, ${year}`;
  };
  
  const formattedDate = formatDate(date);
  const isToday = date.toDateString() === new Date().toDateString();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = date.toDateString() === yesterday.toDateString();
  
  // Format date for react-native-calendars (YYYY-MM-DD)
  const formatDateForCalendar = (dateToFormat: Date) => {
    const year = dateToFormat.getFullYear();
    const month = String(dateToFormat.getMonth() + 1).padStart(2, '0');
    const day = String(dateToFormat.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  
  const selectedDateString = formatDateForCalendar(tempDate);
  const todayString = formatDateForCalendar(new Date());
  const yesterdayString = formatDateForCalendar(yesterday);

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.backgroundColor }]} edges={['top']}>
      <KeyboardAvoidingView 
        style={[styles.container, { backgroundColor: colors.backgroundColor }]}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.headerBackground }]}>
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
              <TrendingDown size={20} color="#ffffff" />
            </View>
            <View>
              <Text style={styles.headerTitle}>Record Expense</Text>
              <Text style={styles.headerSubtitle}>Track your spending</Text>
            </View>
          </View>
        </View>
      </View>

      <ScrollView 
        style={styles.scrollView} 
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Amount Input - Large and Prominent */}
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
              placeholderTextColor="rgba(16, 185, 129, 0.4)"
              autoFocus
              returnKeyType="next"
            />
          </View>
        </View>

        {/* Category Selector */}
        <View style={[styles.card, { backgroundColor: colors.cardBackground }]}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Category (optional)</Text>
          
          <View style={styles.categoryWrapper}>
          <TouchableOpacity
            style={[styles.categoryButton, { backgroundColor: colors.inputBackground, borderColor: colors.borderColor }]}
            onPress={() => {
              setShowExpenseTypeDropdown(false);
              setShowCategoryDropdown(!showCategoryDropdown);
            }}
            activeOpacity={0.7}
          >
              <Text style={[styles.categoryButtonText, !selectedCategoryName && styles.categoryButtonPlaceholder, { color: selectedCategoryName ? colors.textColor : colors.textSecondary }]}>
                {selectedCategoryName || 'Select category'}
              </Text>
              <ChevronDown 
                size={20} 
                color={colors.textSecondary} 
                style={[styles.chevron, showCategoryDropdown && styles.chevronRotated]} 
              />
            </TouchableOpacity>

            {showCategoryDropdown && (
              <Modal
                visible={showCategoryDropdown}
                transparent
                animationType="fade"
                onRequestClose={() => setShowCategoryDropdown(false)}
              >
                <TouchableOpacity
                  style={styles.categoryOverlay}
                  activeOpacity={1}
                  onPress={() => setShowCategoryDropdown(false)}
                >
                  <View style={styles.categoryDropdownContainer}>
                    <View style={styles.categoryDropdown}>
                      <ScrollView 
                        style={styles.categoryScrollView}
                        nestedScrollEnabled
                        showsVerticalScrollIndicator={false}
                      >
                        {/* None option */}
                        <TouchableOpacity
                          style={styles.categoryOption}
                          onPress={() => {
                            setSelectedCategory(null);
                            setShowCategoryDropdown(false);
                          }}
                          activeOpacity={0.7}
                        >
                          <Text style={styles.categoryOptionTextMuted}>No category</Text>
                        </TouchableOpacity>
                        
                        {/* Existing categories */}
                        {categories.map((category) => (
                          <TouchableOpacity
                            key={category.id}
                            style={styles.categoryOption}
                            onPress={() => {
                              setSelectedCategory(category.name);
                              setShowCategoryDropdown(false);
                            }}
                            activeOpacity={0.7}
                          >
                            <Text style={styles.categoryOptionText}>{category.name}</Text>
                            {selectedCategory === category.name && (
                              <Check size={20} color="#10b981" />
                            )}
                          </TouchableOpacity>
                        ))}
                        
                        {/* Add new category */}
                        <View style={styles.categoryDivider} />
                        {isAddingCategory ? (
                          <View style={styles.addCategoryInputContainer}>
                            <TextInput
                              style={styles.addCategoryInput}
                              value={newCategoryName}
                              onChangeText={setNewCategoryName}
                              placeholder="Category name"
                              placeholderTextColor="#999"
                              autoFocus
                              onSubmitEditing={handleAddCategory}
                            />
                            <TouchableOpacity
                              style={styles.addCategorySubmitButton}
                              onPress={handleAddCategory}
                              activeOpacity={0.8}
                            >
                              <Text style={styles.addCategorySubmitText}>Add</Text>
                            </TouchableOpacity>
                          </View>
                        ) : (
                          <TouchableOpacity
                            style={styles.addCategoryTrigger}
                            onPress={() => {
                              setIsAddingCategory(true);
                              setShowCategoryDropdown(true);
                            }}
                            activeOpacity={0.7}
                          >
                            <Plus size={20} color="#10b981" />
                            <Text style={styles.addCategoryTriggerText}>Add new category</Text>
                          </TouchableOpacity>
                        )}
                      </ScrollView>
                    </View>
                  </View>
                </TouchableOpacity>
              </Modal>
            )}
          </View>
        </View>

        {/* Expense Type Selector */}
        <View style={[styles.card, { backgroundColor: colors.cardBackground }]}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Type of Expense</Text>
          
          <View style={styles.categoryWrapper}>
            <TouchableOpacity
              style={[styles.categoryButton, { backgroundColor: colors.inputBackground, borderColor: colors.borderColor }]}
              onPress={() => {
                setShowCategoryDropdown(false);
                setShowExpenseTypeDropdown(!showExpenseTypeDropdown);
              }}
              activeOpacity={0.7}
            >
              <Text style={[styles.categoryButtonText, !expenseType && styles.categoryButtonPlaceholder, { color: expenseType ? colors.textColor : colors.textSecondary }]}>
                {expenseType || 'Select expense type'}
              </Text>
              <ChevronDown 
                size={20} 
                color={colors.textSecondary} 
                style={[styles.chevron, showExpenseTypeDropdown && styles.chevronRotated]} 
              />
            </TouchableOpacity>

            {showExpenseTypeDropdown && (
              <Modal
                visible={showExpenseTypeDropdown}
                transparent
                animationType="fade"
                onRequestClose={() => setShowExpenseTypeDropdown(false)}
              >
                <TouchableOpacity
                  style={styles.categoryOverlay}
                  activeOpacity={1}
                  onPress={() => setShowExpenseTypeDropdown(false)}
                >
                  <View style={styles.categoryDropdownContainer}>
                    <View style={[styles.categoryDropdown, { backgroundColor: colors.cardBackground, borderColor: colors.borderColor }]}>
                      <ScrollView 
                        style={styles.categoryScrollView}
                        nestedScrollEnabled
                        showsVerticalScrollIndicator={false}
                      >
                        {/* None option */}
                        <TouchableOpacity
                          style={[styles.categoryOption, { backgroundColor: colors.cardBackground }]}
                          onPress={() => {
                            setExpenseType(null);
                            setShowExpenseTypeDropdown(false);
                          }}
                          activeOpacity={0.7}
                        >
                          <Text style={[styles.categoryOptionTextMuted, { color: colors.textSecondary }]}>No type</Text>
                        </TouchableOpacity>
                        
                        {/* Expense types */}
                        {EXPENSE_TYPES.map((type) => (
                          <TouchableOpacity
                            key={type}
                            style={[styles.categoryOption, { backgroundColor: colors.cardBackground }]}
                            onPress={() => {
                              setExpenseType(type);
                              setShowExpenseTypeDropdown(false);
                            }}
                            activeOpacity={0.7}
                          >
                            <Text style={[styles.categoryOptionText, { color: colors.textColor }]}>{type}</Text>
                            {expenseType === type && (
                              <Check size={20} color="#10b981" />
                            )}
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>
                  </View>
                </TouchableOpacity>
              </Modal>
            )}
          </View>
        </View>

        {/* Date Picker */}
        <View style={[styles.card, { backgroundColor: colors.cardBackground }]}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Date</Text>
          <TouchableOpacity
            style={[styles.dateButton, { backgroundColor: colors.inputBackground, borderColor: colors.borderColor }]}
            onPress={() => {
              setTempDate(date);
              setDatePickerOpen(true);
            }}
            activeOpacity={0.7}
          >
            <Text style={[styles.dateButtonText, { color: colors.textColor }]}>{formattedDate}</Text>
            <CalendarIcon size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Bottom Actions */}
      <View style={[styles.bottomActions, { backgroundColor: colors.cardBackground, borderTopColor: colors.borderColor }]}>
        <TouchableOpacity
          style={[styles.cancelButton, { backgroundColor: colors.cardBackground, borderColor: colors.borderColor }]}
          onPress={() => router.back()}
          disabled={loading}
          activeOpacity={0.7}
        >
          <Text style={[styles.cancelButtonText, { color: colors.textSecondary }]}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.saveButton, (!amount || loading) && styles.saveButtonDisabled]}
          onPress={handleSubmit}
          disabled={!amount || loading}
          activeOpacity={0.8}
        >
          <Text style={styles.saveButtonText}>
            {loading ? 'Saving...' : 'Save Expense'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Date Picker Bottom Sheet Modal */}
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
            onPress={() => {
              setTempDate(date);
              setDatePickerOpen(false);
            }}
          />
          <View style={[styles.modalContent, { backgroundColor: colors.cardBackground }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.borderColor }]}>
              <Text style={[styles.modalTitle, { color: colors.textColor }]}>Select Date</Text>
            </View>
            
            {/* Quick Date Selection Buttons */}
            <View style={styles.quickDateContainer}>
              <TouchableOpacity
                style={[styles.quickDateButton, isToday && styles.quickDateButtonActive, { backgroundColor: colors.inputBackground, borderColor: colors.borderColor }]}
                onPress={() => {
                  setDate(new Date());
                  setDatePickerOpen(false);
                }}
                activeOpacity={0.7}
              >
                <Text style={[styles.quickDateText, isToday && styles.quickDateTextActive, { color: isToday ? '#ffffff' : colors.textColor }]}>Today</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.quickDateButton, isYesterday && styles.quickDateButtonActive, { backgroundColor: colors.inputBackground, borderColor: colors.borderColor }]}
                onPress={() => {
                  const yesterday = new Date();
                  yesterday.setDate(yesterday.getDate() - 1);
                  setDate(yesterday);
                  setDatePickerOpen(false);
                }}
                activeOpacity={0.7}
              >
                <Text style={[styles.quickDateText, isYesterday && styles.quickDateTextActive, { color: isYesterday ? '#ffffff' : colors.textColor }]}>Yesterday</Text>
              </TouchableOpacity>
            </View>

            {/* Calendar with larger touch targets */}
            <View style={styles.calendarContainer}>
              <Calendar
                current={selectedDateString}
                onDayPress={(day) => {
                  const selectedDate = new Date(day.dateString);
                  setTempDate(selectedDate);
                  if (Platform.OS === 'android') {
                    setDate(selectedDate);
                    setDatePickerOpen(false);
                  }
                }}
                minDate="2020-01-01"
                maxDate={todayString}
                theme={{
                  backgroundColor: colors.cardBackground,
                  calendarBackground: colors.cardBackground,
                  textSectionTitleColor: colors.textSecondary,
                  selectedDayBackgroundColor: '#10b981',
                  selectedDayTextColor: '#ffffff',
                  todayTextColor: '#10b981',
                  dayTextColor: colors.textColor,
                  textDisabledColor: colors.textSecondary,
                  dotColor: '#10b981',
                  selectedDotColor: '#ffffff',
                  arrowColor: '#10b981',
                  monthTextColor: colors.textColor,
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
                    selectedColor: '#10b981',
                    selectedTextColor: '#ffffff',
                  },
                  [todayString]: {
                    customStyles: {
                      container: {
                        backgroundColor: 'rgba(16, 185, 129, 0.1)',
                        borderRadius: 8,
                      },
                      text: {
                        color: '#10b981',
                        fontWeight: 'bold',
                      },
                    },
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
                  onPress={() => {
                    setTempDate(date);
                    setDatePickerOpen(false);
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={styles.dateCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.dateConfirmButton}
                  onPress={() => {
                    setDate(tempDate);
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
    backgroundColor: "#10b981",
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
    paddingTop: 0,
    gap: 24,
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
  label: {
    fontSize: 14,
    fontWeight: "700",
    color: "#666",
    marginBottom: 12,
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
    color: "#10b981",
    zIndex: 1,
  },
  amountInput: {
    width: "100%",
    height: 80,
    paddingLeft: 56,
    paddingRight: 16,
    fontSize: 36,
    fontWeight: "800",
    backgroundColor: "rgba(16, 185, 129, 0.05)",
    borderWidth: 2,
    borderColor: "rgba(16, 185, 129, 0.3)",
    borderRadius: 16,
    color: "#10b981",
  },
  categoryWrapper: {
    position: "relative",
    zIndex: 10,
  },
  categoryButton: {
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
  categoryButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
  },
  categoryButtonPlaceholder: {
    color: "#999",
  },
  chevron: {
    transform: [{ rotate: '0deg' }],
  },
  chevronRotated: {
    transform: [{ rotate: '180deg' }],
  },
  categoryOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  categoryDropdownContainer: {
    width: "100%",
    maxWidth: 400,
  },
  categoryDropdown: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 12,
    maxHeight: 400,
    overflow: "hidden",
  },
  categoryScrollView: {
    maxHeight: 400,
  },
  categoryOption: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#ffffff",
  },
  categoryOptionText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
  },
  categoryOptionTextMuted: {
    fontSize: 16,
    fontWeight: "500",
    color: "#999",
  },
  categoryDivider: {
    height: 1,
    backgroundColor: "#e5e7eb",
    marginVertical: 4,
  },
  addCategoryTrigger: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  addCategoryTriggerText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#10b981",
  },
  addCategoryInputContainer: {
    padding: 12,
    flexDirection: "row",
    gap: 8,
  },
  addCategoryInput: {
    flex: 1,
    height: 48,
    paddingHorizontal: 14,
    backgroundColor: "#f9fafb",
    borderWidth: 2,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    fontSize: 16,
    fontWeight: "500",
    color: "#333",
  },
  addCategorySubmitButton: {
    height: 48,
    paddingHorizontal: 20,
    backgroundColor: "#10b981",
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  addCategorySubmitText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#ffffff",
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
    backgroundColor: "#10b981",
    borderRadius: 12,
    shadowColor: "#10b981",
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
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#333",
  },
  quickDateContainer: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  quickDateButton: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: "#f5f5f5",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "transparent",
  },
  quickDateButtonActive: {
    backgroundColor: "#10b981",
    borderColor: "#10b981",
  },
  quickDateText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#666",
  },
  quickDateTextActive: {
    color: "#ffffff",
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
    backgroundColor: "#10b981",
  },
  dateConfirmText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#ffffff",
  },
});

