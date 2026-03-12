import React, { useState, useCallback, useEffect } from 'react';
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
import { router, useLocalSearchParams } from 'expo-router';
import { useTemplatesContext } from '@/contexts/TemplatesContext';
import { useCategoriesContext } from '@/contexts/CategoriesContext';
import { useToastContext } from '@/contexts/ToastContext';
import { TemplateInput, validateTemplateInput } from '@/lib/templates';
import { ChevronDown } from 'lucide-react-native';

export default function EditTemplateScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { templates, updateTemplate } = useTemplatesContext();
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

  const template = templates.find((t) => t.id === id);

  // Initialize form with template data
  useEffect(() => {
    if (template) {
      setName(template.name);
      setType(template.type);
      setAmount(template.default_amount.toString());
      setCategory(template.category);
      setDescription(template.description || '');
    }
  }, [template]);

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

      await updateTemplate(template!.id, input);
      showSuccess('Template updated successfully! 🎉');
      router.back();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update template';
      showError(message);
    } finally {
      setLoading(false);
    }
  }, [name, type, amount, category, description, validateForm, template, updateTemplate, showSuccess, showError]);

  if (!template) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorMessage}>Template not found</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>Edit Template</Text>
          <Text style={styles.subtitle}>Update your template preset</Text>
        </View>

        <View style={styles.form}>
          {/* Template Name */}
          <View style={styles.field}>
            <Text style={styles.label}>Template Name *</Text>
            <TextInput
              style={[styles.input, errors.name && styles.inputError]}
              placeholder="e.g., Bread Sale"
              value={name}
              onChangeText={setName}
              editable={!loading}
            />
            {errors.name && <Text style={styles.errorText}>{errors.name}</Text>}
          </View>

          {/* Transaction Type */}
          <View style={styles.field}>
            <Text style={styles.label}>Transaction Type *</Text>
            <TouchableOpacity
              style={[styles.dropdown, errors.type && styles.inputError]}
              onPress={() => setShowTypeDropdown(!showTypeDropdown)}
              disabled={loading}
            >
              <Text style={styles.dropdownText}>{type === 'sale' ? 'Sale' : 'Expense'}</Text>
              <ChevronDown size={20} color="#666" />
            </TouchableOpacity>
            {showTypeDropdown && (
              <View style={styles.dropdownMenu}>
                {['sale', 'expense'].map((t) => (
                  <TouchableOpacity
                    key={t}
                    style={styles.dropdownOption}
                    onPress={() => {
                      setType(t as 'sale' | 'expense');
                      setShowTypeDropdown(false);
                    }}
                  >
                    <Text style={styles.dropdownOptionText}>{t === 'sale' ? 'Sale' : 'Expense'}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
            {errors.type && <Text style={styles.errorText}>{errors.type}</Text>}
          </View>

          {/* Default Amount */}
          <View style={styles.field}>
            <Text style={styles.label}>Default Amount *</Text>
            <TextInput
              style={[styles.input, errors.amount && styles.inputError]}
              placeholder="e.g., 50"
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
              editable={!loading}
            />
            {errors.amount && <Text style={styles.errorText}>{errors.amount}</Text>}
          </View>

          {/* Category */}
          <View style={styles.field}>
            <Text style={styles.label}>Category</Text>
            <TouchableOpacity
              style={styles.dropdown}
              onPress={() => setShowCategoryDropdown(!showCategoryDropdown)}
              disabled={loading}
            >
              <Text style={[styles.dropdownText, !category && styles.placeholder]}>
                {category || 'Select category'}
              </Text>
              <ChevronDown size={20} color="#666" />
            </TouchableOpacity>
            {showCategoryDropdown && (
              <View style={styles.dropdownMenu}>
                <TouchableOpacity
                  style={styles.dropdownOption}
                  onPress={() => {
                    setCategory(null);
                    setShowCategoryDropdown(false);
                  }}
                >
                  <Text style={styles.dropdownOptionText}>None</Text>
                </TouchableOpacity>
                {categories.map((cat) => (
                  <TouchableOpacity
                    key={cat.id}
                    style={styles.dropdownOption}
                    onPress={() => {
                      setCategory(cat.name);
                      setShowCategoryDropdown(false);
                    }}
                  >
                    <Text style={styles.dropdownOptionText}>{cat.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          {/* Description */}
          <View style={styles.field}>
            <Text style={styles.label}>Description</Text>
            <TextInput
              style={[styles.input, styles.textArea, errors.description && styles.inputError]}
              placeholder="e.g., Bread loaf"
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={3}
              editable={!loading}
            />
            {errors.description && <Text style={styles.errorText}>{errors.description}</Text>}
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.button, styles.cancelButton]}
          onPress={() => router.back()}
          disabled={loading}
        >
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.button, styles.saveButton, loading && styles.buttonDisabled]}
          onPress={handleSave}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <Text style={styles.saveButtonText}>Save Changes</Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  scroll: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#333',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
  },
  form: {
    padding: 16,
    gap: 16,
  },
  field: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    color: '#333',
  },
  input: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#333',
  },
  inputError: {
    borderColor: '#ef4444',
  },
  textArea: {
    textAlignVertical: 'top',
    paddingTop: 10,
  },
  dropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  dropdownText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  placeholder: {
    color: '#999',
  },
  dropdownMenu: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    marginTop: 4,
    overflow: 'hidden',
  },
  dropdownOption: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  dropdownOptionText: {
    fontSize: 14,
    color: '#333',
  },
  errorText: {
    fontSize: 12,
    color: '#ef4444',
    fontWeight: '500',
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#f0f0f0',
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#333',
  },
  saveButton: {
    backgroundColor: '#1e3a8a',
  },
  saveButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  errorMessage: {
    fontSize: 16,
    color: '#ef4444',
    textAlign: 'center',
    marginTop: 20,
  },
});
