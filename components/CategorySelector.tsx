import React, { useState, useEffect } from 'react';
import {
    View, Text, TextInput, TouchableOpacity, Modal,
    StyleSheet, ActivityIndicator, Alert, ScrollView
} from 'react-native';
import { Check, Plus, ShoppingCart, TrendingDown } from 'lucide-react-native';
import { supabase } from '../lib/supabase';
import { addCategory, Category, getUserCategories } from '../lib/categories';
import { useThemeColors } from '@/hooks/useThemeColors';

interface CategorySelectorProps {
    selectedCategoryName: string;
    onSelect: (categoryName: string) => void;
    type?: 'expense' | 'income';
}

export const CategorySelector = ({ selectedCategoryName, onSelect, type = 'income' }: CategorySelectorProps) => {
    const colors = useThemeColors();
    const [categories, setCategories] = useState<Category[]>([]);
    const [dropdownVisible, setDropdownVisible] = useState(false);
    const [modalVisible, setModalVisible] = useState(false);

    const [newCatName, setNewCatName] = useState('');
    const [errorText, setErrorText] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        loadCategories();
    }, []);

    const loadCategories = async () => {
        try {
            const cats = await getUserCategories();
            setCategories(cats);
        } catch (e) {
            console.error('Error loading categories:', e);
        }
    };

    const validateInput = (name: string) => {
        const trimmed = name.trim();
        if (!trimmed) return "Category name cannot be empty.";
        if (trimmed.length > 50) return "Category name must be under 50 characters.";

        const normalized = trimmed.toLowerCase();
        const isDuplicate = categories.some(cat => cat.normalized_name === normalized);
        if (isDuplicate) return "This category already exists.";

        return null;
    };

    const handleSave = async () => {
        const error = validateInput(newCatName);
        if (error) {
            setErrorText(error);
            return;
        }

        setIsSaving(true);
        try {
            const trimmedName = newCatName.trim();

            // Save locally (Offline-First optimistic update logic is within addCategory)
            const newCat = await addCategory(trimmedName);

            setCategories(prev => [...prev, newCat].sort((a, b) => a.name.localeCompare(b.name)));
            onSelect(newCat.name); // Auto-select new category

            setModalVisible(false);
            setNewCatName('');
        } catch (err) {
            console.error(err);
            Alert.alert("Error", "Could not save category.");
        } finally {
            setIsSaving(false);
        }
    };

    const IconComponent = type === 'expense' ? TrendingDown : ShoppingCart;

    return (
        <View style={styles.container}>
            {/* Dropdown Display */}
            <View style={styles.row}>
                <TouchableOpacity
                    style={[styles.dropdownButton, { backgroundColor: colors.inputBackground, borderColor: colors.borderColor }]}
                    onPress={() => setDropdownVisible(!dropdownVisible)}
                    activeOpacity={0.7}
                >
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <IconComponent size={20} color={colors.textSecondary} style={{ marginRight: 12 }} />
                        <Text style={[styles.dropdownButtonText, { color: selectedCategoryName ? colors.textColor : colors.textSecondary }]}>
                            {selectedCategoryName || 'Select category...'}
                        </Text>
                    </View>
                    <Plus size={20} color={colors.textSecondary} style={{ transform: [{ rotate: dropdownVisible ? '45deg' : '0deg' }] }} />
                </TouchableOpacity>

                {/* "+" Button */}
                <TouchableOpacity
                    style={styles.addButton}
                    onPress={() => {
                        setModalVisible(true);
                        setDropdownVisible(false);
                        setErrorText('');
                        setNewCatName('');
                    }}
                >
                    <Plus size={24} color="#FFF" />
                </TouchableOpacity>
            </View>

            {/* Expanded Dropdown Area */}
            {dropdownVisible && (
                <View style={[styles.dropdownContainer, { borderColor: colors.borderColor, backgroundColor: colors.cardBackground }]}>
                    <ScrollView style={{ maxHeight: 250 }} keyboardShouldPersistTaps="always">
                        {categories.map((cat) => (
                            <TouchableOpacity
                                key={cat.id}
                                style={[styles.option, { borderBottomColor: colors.borderColor, backgroundColor: selectedCategoryName === cat.name ? 'rgba(30, 58, 138, 0.05)' : 'transparent' }]}
                                onPress={() => {
                                    onSelect(cat.name);
                                    setDropdownVisible(false);
                                }}
                            >
                                <Text style={[styles.optionText, { color: colors.textColor }]}>{cat.name}</Text>
                                {selectedCategoryName === cat.name && <Check size={18} color="#1e3a8a" />}
                            </TouchableOpacity>
                        ))}
                        {categories.length === 0 && (
                            <View style={styles.option}>
                                <Text style={[styles.optionText, { color: colors.textSecondary }]}>No categories found</Text>
                            </View>
                        )}
                    </ScrollView>
                </View>
            )}

            {/* Add Category Modal */}
            <Modal visible={modalVisible} animationType="slide" transparent>
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { backgroundColor: colors.cardBackground }]}>
                        <Text style={[styles.modalTitle, { color: colors.textColor }]}>New Category</Text>

                        <TextInput
                            style={[styles.input, { color: colors.textColor, borderColor: colors.borderColor, backgroundColor: colors.inputBackground }]}
                            value={newCatName}
                            onChangeText={(t) => {
                                setNewCatName(t);
                                setErrorText('');
                            }}
                            placeholder="e.g. Food, Transport"
                            placeholderTextColor={colors.textSecondary}
                            maxLength={50}
                            autoFocus
                        />
                        {errorText ? <Text style={styles.errorText}>{errorText}</Text> : null}

                        <View style={styles.modalActions}>
                            <TouchableOpacity
                                style={[styles.button, styles.cancelBtn]}
                                onPress={() => setModalVisible(false)}
                                disabled={isSaving}
                            >
                                <Text style={styles.cancelText}>Cancel</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.button, styles.saveBtn, isSaving && styles.disabledBtn]}
                                onPress={handleSave}
                                disabled={isSaving}
                            >
                                {isSaving ? (
                                    <ActivityIndicator color="#FFF" size="small" />
                                ) : (
                                    <Text style={styles.saveText}>Save</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { width: '100%' },
    row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    dropdownButton: { flex: 1, height: 56, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 12, borderWidth: 2 },
    dropdownButtonText: { fontSize: 16, fontWeight: '600' },
    addButton: { backgroundColor: '#1e3a8a', height: 56, width: 56, justifyContent: 'center', alignItems: 'center', borderRadius: 12 },
    dropdownContainer: { marginTop: 8, borderRadius: 12, borderWidth: 1, overflow: 'hidden' },
    option: { padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1 },
    optionText: { fontSize: 16, fontWeight: '500' },

    modalOverlay: { flex: 1, justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.5)', padding: 20 },
    modalContent: { padding: 24, borderRadius: 16, elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4 },
    modalTitle: { fontSize: 20, fontWeight: '800', marginBottom: 20 },
    input: { borderWidth: 2, padding: 16, borderRadius: 12, fontSize: 16, marginBottom: 8 },
    errorText: { color: 'red', fontSize: 14, marginBottom: 16, fontWeight: '500' },
    modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 16 },
    button: { paddingVertical: 12, paddingHorizontal: 24, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
    cancelBtn: { backgroundColor: '#e5e5ea' },
    saveBtn: { backgroundColor: '#1e3a8a', minWidth: 100 },
    disabledBtn: { opacity: 0.5 },
    cancelText: { color: '#333', fontSize: 16, fontWeight: '600' },
    saveText: { color: '#FFF', fontSize: 16, fontWeight: '700' }
});
