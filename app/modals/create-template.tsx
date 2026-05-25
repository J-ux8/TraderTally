import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useTemplatesContext } from '@/contexts/TemplatesContext';
import { useCategoriesContext } from '@/contexts/CategoriesContext';
import { useToastContext } from '@/contexts/ToastContext';
import { useTheme } from '@/contexts/ThemeContext';
import { useThemeColors } from '@/hooks/useThemeColors';
import { TemplateInput, validateTemplateInput } from '@/lib/templates';
import { ChevronDown, ShoppingBag, TrendingUp, TrendingDown, FileText, Tag } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function CreateTemplateScreen() {
  const insets = useSafeAreaInsets();
  const { theme } = useTheme();
  const colors = useThemeColors();
  const { createTemplate } = useTemplatesContext();
  const { categories } = useCategoriesContext();
  const { success: showSuccess, error: showError } = useToastContext();

  const [name, setName] = useState('');
  const [type, setType] = useState<'sale' | 'expense'>('sale');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [showTypeDropdown, setShowTypeDropdown] = useState(false);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = useCallback((): boolean => {
    const input: TemplateInput = {
      name,
      type,
      default_amount: parseFloat(amount) || 0,
      category,
      description,
    };

    const validation = validateTemplateInput(input);
    if (!validation.valid) {
      const errorMap: Record<string, string> = {};
      validation.errors.forEach((error) => {
        if (error.includes('name')) errorMap.name = error;
        else if (error.includes('type')) errorMap.type = error;
        else if (error.includes('Amount')) errorMap.amount = error;
        else if (error.includes('Description')) errorMap.description = error;
      });
      setErrors(errorMap);
      return false;
    }

    setErrors({});
    return true;
  }, [name, type, amount, category, description]);

  const handleSave = useCallback(async () => {
    if (!validateForm()) return;

    setLoading(true);
    try {
      const input: TemplateInput = {
        name,
        type,
        default_amount: parseFloat(amount),
        category,
        description: description || undefined,
      };

      await createTemplate(input);
      showSuccess('Template created successfully! 🎉');
      router.back();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create template';
      showError(message);
    } finally {
      setLoading(false);
    }
  }, [name, type, amount, category, description, validateForm, createTemplate, showSuccess, showError]);

  // Dynamic colors based on theme
  const backgroundColor = theme === 'dark' ? '#0f172a' : '#ffffff';
  const cardBackground = theme === 'dark' ? '#1e293b' : '#ffffff';
  const textColor = theme === 'dark' ? '#e2e8f0' : '#1e293b';
  const textSecondary = theme === 'dark' ? '#94a3b8' : '#64748b';
  const borderColor = theme === 'dark' ? '#334155' : '#e2e8f0';
  const inputBackground = theme === 'dark' ? '#334155' : '#f8fafc';

  return (
    <View style={[styles.container, { backgroundColor }]}>
      <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
      
      {/* Hero Header */}
      <View style={[styles.header, { backgroundColor: colors.headerBackground, paddingTop: Math.max(20, insets.top + 10) }]}>
        <View style={styles.headerDecoration1} />
        <View style={styles.headerDecoration2} />
        <View style={styles.headerContent}>
          <View style={styles.headerIconContainer}>
            <View style={styles.headerIcon}>
              <FileText size={24} color="#ffffff" />
            </View>
            <View style={styles.headerTextContainer}>
              <Text style={styles.headerTitle}>Create Template</Text>
              <Text style={styles.headerSubtitle}>Save a preset for quick transactions</Text>
            </View>
          </View>
        </View>
      </View>

      <KeyboardAvoidingView
        style={styles.content}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
          <View style={styles.form}>
            {/* Template Name */}
            <View style={styles.field}>
              <Text style={[styles.label, { color: textColor }]}>Template Name *</Text>
              <View style={[styles.inputContainer, { backgroundColor: inputBackground, borderColor: errors.name ? '#ef4444' : borderColor }]}>
                <Tag size={20} color={textSecondary} style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, { color: textColor }]}
                  placeholder="e.g., Bread Sale"
                  placeholderTextColor={textSecondary}
                  value={name}
                  onChangeText={setName}
                  editable={!loading}
                />
              </View>
              {errors.name && <Text style={styles.errorText}>{errors.name}</Text>}
            </View>

            {/* Transaction Type */}
            <View style={styles.field}>
              <Text style={[styles.label, { color: textColor }]}>Transaction Type *</Text>
              <TouchableOpacity
                style={[styles.inputContainer, { backgroundColor: inputBackground, borderColor: errors.type ? '#ef4444' : borderColor }]}
                onPress={() => setShowTypeDropdown(!showTypeDropdown)}
                disabled={loading}
                activeOpacity={0.7}
              >
                {type === 'sale' ? (
                  <TrendingUp size={20} color="#10b981" style={styles.inputIcon} />
                ) : (
                  <TrendingDown size={20} color="#ef4444" style={styles.inputIcon} />
                )}
                <Text style={[styles.dropdownText, { color: textColor }]}>
                  {type === 'sale' ? 'Sale' : 'Expense'}
                </Text>
                <ChevronDown size={20} color={textSecondary} />
              </TouchableOpacity>
              {showTypeDropdown && (
                <View style={[styles.dropdownMenu, { backgroundColor: cardBackground, borderColor }]}>
                  {['sale', 'expense'].map((t) => (
                    <TouchableOpacity
                      key={t}
                      style={[styles.dropdownOption, { borderBottomColor: borderColor }]}
                      onPress={() => {
                        setType(t as 'sale' | 'expense');
                        setShowTypeDropdown(false);
                      }}
                      activeOpacity={0.7}
                    >
                      {t === 'sale' ? (
                        <TrendingUp size={16} color="#10b981" style={styles.optionIcon} />
                      ) : (
                        <TrendingDown size={16} color="#ef4444" style={styles.optionIcon} />
                      )}
                      <Text style={[styles.dropdownOptionText, { color: textColor }]}>
                        {t === 'sale' ? 'Sale' : 'Expense'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
              {errors.type && <Text style={styles.errorText}>{errors.type}</Text>}
            </View>

            {/* Default Amount */}
            <View style={styles.field}>
              <Text style={[styles.label, { color: textColor }]}>Default Amount *</Text>
              <View style={[styles.inputContainer, { backgroundColor: inputBackground, borderColor: errors.amount ? '#ef4444' : borderColor }]}>
                <Text style={[styles.currencySymbol, { color: textSecondary }]}>K</Text>
                <TextInput
                  style={[styles.input, { color: textColor }]}
                  placeholder="0.00"
                  placeholderTextColor={textSecondary}
                  value={amount}
                  onChangeText={setAmount}
                  keyboardType="decimal-pad"
                  editable={!loading}
                />
              </View>
              {errors.amount && <Text style={styles.errorText}>{errors.amount}</Text>}
            </View>

            {/* Category */}
            <View style={styles.field}>
              <Text style={[styles.label, { color: textColor }]}>Category</Text>
              <TouchableOpacity
                style={[styles.inputContainer, { backgroundColor: inputBackground, borderColor }]}
                onPress={() => setShowCategoryDropdown(!showCategoryDropdown)}
                disabled={loading}
                activeOpacity={0.7}
              >
                <ShoppingBag size={20} color={textSecondary} style={styles.inputIcon} />
                <Text style={[styles.dropdownText, !category && styles.placeholder, { color: category ? textColor : textSecondary }]}>
                  {category || 'Select category'}
                </Text>
                <ChevronDown size={20} color={textSecondary} />
              </TouchableOpacity>
              {showCategoryDropdown && (
                <View style={[styles.dropdownMenu, { backgroundColor: cardBackground, borderColor }]}>
                  <TouchableOpacity
                    style={[styles.dropdownOption, { borderBottomColor: borderColor }]}
                    onPress={() => {
                      setCategory(null);
                      setShowCategoryDropdown(false);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.dropdownOptionText, { color: textSecondary }]}>None</Text>
                  </TouchableOpacity>
                  {categories.map((cat) => (
                    <TouchableOpacity
                      key={cat.id}
                      style={[styles.dropdownOption, { borderBottomColor: borderColor }]}
                      onPress={() => {
                        setCategory(cat.name);
                        setShowCategoryDropdown(false);
                      }}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.dropdownOptionText, { color: textColor }]}>{cat.name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            {/* Description */}
            <View style={styles.field}>
              <Text style={[styles.label, { color: textColor }]}>Description</Text>
              <View style={[styles.inputContainer, styles.textAreaContainer, { backgroundColor: inputBackground, borderColor: errors.description ? '#ef4444' : borderColor }]}>
                <TextInput
                  style={[styles.input, styles.textArea, { color: textColor }]}
                  placeholder="e.g., Bread loaf"
                  placeholderTextColor={textSecondary}
                  value={description}
                  onChangeText={setDescription}
                  multiline
                  numberOfLines={3}
                  editable={!loading}
                />
              </View>
              {errors.description && <Text style={styles.errorText}>{errors.description}</Text>}
            </View>
          </View>
        </ScrollView>

        <View style={[styles.footer, { borderTopColor: borderColor, backgroundColor: cardBackground }]}>
          <TouchableOpacity
            style={[styles.button, styles.cancelButton, { backgroundColor: 'rgba(30, 58, 138, 0.1)' }]}
            onPress={() => router.back()}
            disabled={loading}
            activeOpacity={0.8}
          >
            <Text style={[styles.cancelButtonText, { color: colors.primaryColor }]}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.button, styles.saveButton, { backgroundColor: colors.primaryColor }, loading && styles.buttonDisabled]}
            onPress={handleSave}
            disabled={loading}
            activeOpacity={0.8}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#ffffff" />
            ) : (
              <Text style={styles.saveButtonText}>Create Template</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingBottom: 32,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    overflow: 'hidden',
    position: 'relative',
  },
  headerDecoration1: {
    position: 'absolute',
    top: -50,
    right: -50,
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  headerDecoration2: {
    position: 'absolute',
    bottom: -30,
    left: -30,
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  headerContent: {
    zIndex: 10,
  },
  headerIconContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  headerIcon: {
    width: 56,
    height: 56,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTextContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#ffffff',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    fontWeight: '500',
  },
  content: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  form: {
    padding: 20,
    gap: 20,
  },
  field: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 4,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderRadius: 12,
    paddingHorizontal: 16,
    minHeight: 56,
  },
  inputIcon: {
    marginRight: 12,
  },
  currencySymbol: {
    fontSize: 16,
    fontWeight: '600',
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
  },
  textAreaContainer: {
    alignItems: 'flex-start',
    paddingVertical: 12,
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  dropdownText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
  },
  placeholder: {
    fontWeight: '400',
  },
  dropdownMenu: {
    marginTop: 8,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
    maxHeight: 200,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  dropdownOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  optionIcon: {
    marginRight: 12,
  },
  dropdownOptionText: {
    fontSize: 16,
    fontWeight: '500',
  },
  errorText: {
    fontSize: 12,
    color: '#ef4444',
    fontWeight: '500',
    marginTop: 4,
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
    padding: 20,
    borderTopWidth: 1,
  },
  button: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  cancelButton: {
    // backgroundColor set dynamically
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '700',
  },
  saveButton: {
    // backgroundColor set dynamically
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});
