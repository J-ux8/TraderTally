import React, { useState, useEffect } from 'react';
import {
    View, Text, TextInput, TouchableOpacity, Modal,
    StyleSheet, ActivityIndicator, Alert, ScrollView
} from 'react-native';
import { Check, Plus, ShoppingCart, Trash2 } from 'lucide-react-native';
import { useThemeColors } from '@/hooks/useThemeColors';
import { Product, getProducts, upsertProduct } from '@/lib/products';
import { CategorySelector } from './CategorySelector';

interface ProductSelectorProps {
    selectedProduct: Product | null;
    onSelect: (product: Product | null) => void;
}

export const ProductSelector = ({ selectedProduct, onSelect }: ProductSelectorProps) => {
    const colors = useThemeColors();
    const [products, setProducts] = useState<Product[]>([]);
    const [dropdownVisible, setDropdownVisible] = useState(false);
    const [modalVisible, setModalVisible] = useState(false);

    const [newProductName, setNewProductName] = useState('');
    const [newProductPrice, setNewProductPrice] = useState('');
    const [newProductCategory, setNewProductCategory] = useState('');
    
    const [errorText, setErrorText] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [loading, setLoading] = useState(true);

    const loadProducts = async () => {
        try {
            setLoading(true);
            const data = await getProducts();
            setProducts(data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadProducts();
    }, []);

    const validateInput = () => {
        if (!newProductName.trim()) return "Product name cannot be empty.";
        if (isNaN(parseFloat(newProductPrice)) || parseFloat(newProductPrice) <= 0) return "Please enter a valid price.";
        if (!newProductCategory.trim()) return "Please select a category.";
        return null;
    };

    const handleSave = async () => {
        const error = validateInput();
        if (error) {
            setErrorText(error);
            return;
        }

        setIsSaving(true);
        try {
        const product = await upsertProduct(
                newProductName.trim(), 
                parseFloat(newProductPrice), 
                newProductCategory
              );
            await loadProducts();
            onSelect(product);
            
            setModalVisible(false);
            setNewProductName('');
            setNewProductPrice('');
            setNewProductCategory('');
        } catch (err) {
            console.error(err);
            Alert.alert("Error", "Could not save product.");
        } finally {
            setIsSaving(false);
        }
    };

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
                        <ShoppingCart size={20} color={colors.textSecondary} style={{ marginRight: 12 }} />
                        <Text style={[styles.dropdownButtonText, { color: selectedProduct ? colors.textColor : colors.textSecondary }]}>
                            {selectedProduct ? selectedProduct.display_name : 'Select product...'}
                        </Text>
                        {selectedProduct && selectedProduct.stock_quantity != null && (
                          <Text style={{ color: colors.textSecondary, fontSize: 12, marginLeft: 8 }}>
                            — {selectedProduct.stock_quantity} in stock
                          </Text>
                        )}
                    </View>
                    <Plus size={20} color={colors.textSecondary} style={{ transform: [{ rotate: dropdownVisible ? '45deg' : '0deg' }] }} />
                </TouchableOpacity>

                {/* "+" Button to Create Product */}
                <TouchableOpacity
                    style={styles.addButton}
                    onPress={() => {
                        setModalVisible(true);
                        setDropdownVisible(false);
                        setErrorText('');
                        setNewProductName('');
                        setNewProductPrice('');
                        setNewProductCategory('');
                    }}
                >
                    <Plus size={24} color="#FFF" />
                </TouchableOpacity>
            </View>

            {/* Expanded Dropdown Area */}
            {dropdownVisible && (
                <View style={[styles.dropdownContainer, { borderColor: colors.borderColor, backgroundColor: colors.cardBackground }]}>
                    <ScrollView style={{ maxHeight: 250 }} nestedScrollEnabled keyboardShouldPersistTaps="always">
                        {loading && <ActivityIndicator style={{ padding: 20 }} />}
                        {!loading && products.map((prod) => (
                            <View
                                key={prod.id}
                                style={[styles.option, { borderBottomColor: colors.borderColor, backgroundColor: selectedProduct?.id === prod.id ? 'rgba(30, 58, 138, 0.05)' : 'transparent' }]}
                            >
                                <TouchableOpacity
                                    style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 16 }}
                                    onPress={() => {
                                        onSelect(prod);
                                        setDropdownVisible(false);
                                    }}
                                >
                                    <View>
                                        <Text style={[styles.optionText, { color: colors.textColor }]}>{prod.display_name}</Text>
                                        <View style={{ flexDirection: 'row', gap: 8 }}>
                                          <Text style={{ color: colors.textSecondary, fontSize: 12 }}>K{prod.price}</Text>
                                          {prod.stock_quantity != null && (
                                            <Text style={{ color: '#10b981', fontSize: 12, fontWeight: '600' }}>
                                              {prod.stock_quantity} in stock
                                            </Text>
                                          )}
                                        </View>
                                    </View>
                                    {selectedProduct?.id === prod.id && <Check size={18} color="#1e3a8a" />}
                                </TouchableOpacity>
                            </View>
                        ))}
                        {!loading && products.length === 0 && (
                            <View style={styles.option}>
                                <Text style={[styles.optionText, { color: colors.textSecondary }]}>No products found. Add one!</Text>
                            </View>
                        )}
                    </ScrollView>
                </View>
            )}

            {/* Add Product Modal */}
            <Modal visible={modalVisible} animationType="slide" transparent>
                <View style={styles.modalOverlay}>
                    <View style={[styles.modalContent, { backgroundColor: colors.cardBackground }]}>
                        <Text style={[styles.modalTitle, { color: colors.textColor }]}>New Product</Text>

                        <Text style={[styles.modalLabel, { color: colors.textSecondary }]}>Product Name</Text>
                        <TextInput
                            style={[styles.input, { color: colors.textColor, borderColor: colors.borderColor, backgroundColor: colors.inputBackground }]}
                            value={newProductName}
                            onChangeText={t => { setNewProductName(t); setErrorText(''); }}
                            placeholder="e.g. Shoes, Rice"
                            placeholderTextColor={colors.textSecondary}
                        />

                        <Text style={[styles.modalLabel, { color: colors.textSecondary }]}>Selling Price (K)</Text>
                        <TextInput
                            style={[styles.input, { color: colors.textColor, borderColor: colors.borderColor, backgroundColor: colors.inputBackground }]}
                            value={newProductPrice}
                            onChangeText={t => { setNewProductPrice(t); setErrorText(''); }}
                            keyboardType="decimal-pad"
                            placeholder="0.00"
                            placeholderTextColor={colors.textSecondary}
                        />

                        <Text style={[styles.modalLabel, { color: colors.textSecondary }]}>Category</Text>
                        <View style={{ zIndex: 999 }}>
                            <CategorySelector 
                                selectedCategoryName={newProductCategory} 
                                onSelect={setNewProductCategory} 
                                type="income" 
                            />
                        </View>

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
                                    <Text style={styles.saveText}>Save Product</Text>
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
    modalLabel: { fontSize: 14, fontWeight: '600', marginBottom: 6 },
    input: { borderWidth: 2, padding: 16, borderRadius: 12, fontSize: 16, marginBottom: 12 },
    errorText: { color: 'red', fontSize: 14, marginTop: 8, fontWeight: '500' },
    modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12, marginTop: 16 },
    button: { paddingVertical: 12, paddingHorizontal: 24, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
    cancelBtn: { backgroundColor: '#e5e5ea' },
    saveBtn: { backgroundColor: '#1e3a8a', minWidth: 100 },
    disabledBtn: { opacity: 0.5 },
    cancelText: { color: '#333', fontSize: 16, fontWeight: '600' },
    saveText: { color: '#FFF', fontSize: 16, fontWeight: '700' }
});
