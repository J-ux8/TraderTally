import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Animated,
  Modal,
  Alert,
} from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ArrowLeft, Search, Plus, Minus, ShoppingCart, Trash2, X, CheckCircle2, Package } from 'lucide-react-native';
import { useThemeColors } from '@/hooks/useThemeColors';
import { useTheme } from '@/contexts/ThemeContext';
import { useCart } from '@/contexts/CartContext';
import { useCategoriesContext } from '@/contexts/CategoriesContext';
import { getProducts, searchProducts, Product, upsertProduct, deleteProduct } from '@/lib/products';
import { completeSale } from '@/lib/sales';
import { useToastContext } from '@/contexts/ToastContext';
import { useTransactionsContext } from '@/contexts/TransactionsContext';
import { OfflineIndicator } from '@/components/ui/OfflineIndicator';

export default function NewSaleScreen() {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const { theme } = useTheme();
  const { cart, addItem, increaseQty, decreaseQty, clearCart, loading: cartLoading } = useCart();
  const { categories } = useCategoriesContext();
  const { success: showSuccess, error: showError } = useToastContext();
  const { refresh: refreshTransactions } = useTransactionsContext();

  const [view, setView] = useState<'categories' | 'products'>('categories');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedCategoryName, setSelectedCategoryName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const [paymentMode, setPaymentMode] = useState<'Paid' | 'Credit'>('Paid');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  
  const [isAddingProduct, setIsAddingProduct] = useState(false);
  const [newProductName, setNewProductName] = useState('');
  const [newProductPrice, setNewProductPrice] = useState('');

  const searchInputRef = useRef<TextInput>(null);
  const priceInputRef = useRef<TextInput>(null);

  // Cart animation
  const cartScale = useRef(new Animated.Value(1)).current;

  // Load products
  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    setLoading(true);
    try {
      const allProducts = await getProducts();
      setProducts(allProducts);
    } catch (error) {
      console.error('Failed to load products:', error);
      showError('Failed to load products');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (text: string) => {
    setSearchQuery(text);
    if (text.trim().length > 0) {
      const results = await searchProducts(text);
      setProducts(results);
    } else {
      const allProducts = await getProducts();
      setProducts(allProducts);
    }
  };

  const handleCompleteSale = async () => {
    if (cart.items.length === 0) return;
    
    if (paymentMode === 'Credit' && !customerName.trim()) {
      showError('Customer Required', { message: 'Please enter a customer name for credit sales.' });
      return;
    }

    setCompleting(true);
    try {
      await completeSale(
        cart.items, 
        cart.total_amount, 
        paymentMode, 
        undefined, 
        customerName.trim() || undefined, 
        customerPhone.trim() || undefined
      );
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const itemSummary = cart.items.map(i => `${i.quantity}x ${i.name}`).join(', ');
      const totalQty = cart.items.reduce((s, i) => s + i.quantity, 0);
      showSuccess(
        `Sold ${totalQty} item${totalQty > 1 ? 's' : ''}`,
        { amount: cart.total_amount, message: `${itemSummary} — K${cart.total_amount.toLocaleString()} revenue` }
      );
      clearCart();
      setShowCheckout(false);
      setPaymentMode('Paid');
      setCustomerName('');
      setCustomerPhone('');
      refreshTransactions(); 
      router.back();
    } catch (error: any) {
      showError('Failed to record sale', { message: error.message });
    } finally {
      setCompleting(false);
    }
  };

  // Products in the selected category
  const categoryProducts = useMemo(() => {
    if (!selectedCategory) return [];
    return products.filter(p => p.category_id === selectedCategory);
  }, [products, selectedCategory]);

  // Product count per category
  const categoryProductCount = useCallback((categoryId: string) => {
    return products.filter(p => p.category_id === categoryId).length;
  }, [products]);

  const animateCart = () => {
    Animated.sequence([
      Animated.timing(cartScale, { toValue: 1.1, duration: 100, useNativeDriver: true }),
      Animated.timing(cartScale, { toValue: 1, duration: 100, useNativeDriver: true }),
    ]).start();
  };

  const onAddPress = (product: Product) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    addItem(product);
    animateCart();
  };

  const handleAddNewProduct = async () => {
    const price = parseFloat(newProductPrice);
    if (!newProductName || isNaN(price) || price <= 0) {
      showError('Please enter a valid name and price');
      return;
    }

    try {
      setLoading(true);
      const product = await upsertProduct(newProductName, price, selectedCategory || undefined);
      addItem(product);
      setIsAddingProduct(false);
      setNewProductName('');
      setNewProductPrice('');
      loadProducts();
    } catch (error) {
      showError('Failed to add product');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectCategory = (catId: string, catName: string) => {
    setSelectedCategory(catId);
    setSelectedCategoryName(catName);
    setView('products');
    setSearchQuery('');
  };

  const handleBackToCategories = () => {
    setView('categories');
    setSelectedCategory(null);
    setSelectedCategoryName('');
    setSearchQuery('');
    loadProducts();
  };

  const renderProductItem = ({ item }: { item: Product }) => {
    const cartItem = cart.items.find(i => i.product_id === item.id);
    const quantity = cartItem?.quantity || 0;

    return (
      <View style={[styles.productItem, { backgroundColor: colors.cardBackground, borderColor: colors.borderColor }]}>
        <View style={styles.productInfo}>
          <Text style={[styles.productName, { color: colors.textColor }]}>{item.display_name}</Text>
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <Text style={[styles.productPrice, { color: colors.textSecondary }]}>K{item.price.toLocaleString()}</Text>
            {item.stock_quantity != null && (
              <Text style={{ color: '#10b981', fontSize: 11, fontWeight: '700' }}>
                {item.stock_quantity} in stock
              </Text>
            )}
          </View>
        </View>
        
        {quantity > 0 ? (
          <View style={styles.quantityControls}>
            <TouchableOpacity 
              style={[styles.qtyButton, { backgroundColor: colors.inputBackground }]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                decreaseQty(item.id);
              }}
            >
              <Minus size={18} color={quantity === 0 ? colors.textSecondary : colors.primaryColor} />
            </TouchableOpacity>
            <Text style={[styles.quantityText, { color: colors.textColor }]}>{quantity}</Text>
            <TouchableOpacity 
              style={[styles.qtyButton, { backgroundColor: colors.inputBackground }]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                increaseQty(item.id);
              }}
            >
              <Plus size={18} color={colors.primaryColor} />
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity 
            style={[styles.addButton, { backgroundColor: colors.primaryColor }]}
            onPress={() => onAddPress(item)}
            activeOpacity={0.7}
          >
            <Plus size={20} color="#ffffff" />
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const renderCategoryCard = ({ item }: { item: any }) => {
    const count = categoryProductCount(item.id);
    return (
      <TouchableOpacity
        style={[styles.categoryCard, { backgroundColor: colors.cardBackground, borderColor: colors.borderColor }]}
        onPress={() => handleSelectCategory(item.id, item.name)}
        activeOpacity={0.7}
      >
        <View style={styles.categoryCardIcon}>
          <Package size={28} color="#1e3a8a" />
        </View>
        <Text style={[styles.categoryCardName, { color: colors.textColor }]} numberOfLines={1}>{item.name}</Text>
        <Text style={[styles.categoryCardCount, { color: colors.textSecondary }]}>
          {count} product{count !== 1 ? 's' : ''}
        </Text>
      </TouchableOpacity>
    );
  };

  const renderCategoryGrid = () => (
    <View style={styles.categoryGridContainer}>
      <Text style={[styles.sectionTitle, { color: colors.textColor }]}>Product Categories</Text>
      {categories.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            No categories yet.{'\n'}Create products through Orders first.
          </Text>
        </View>
      ) : (
        <FlatList
          key="categories-grid"
          data={categories}
          renderItem={renderCategoryCard}
          keyExtractor={item => item.id}
          numColumns={2}
          columnWrapperStyle={styles.categoryRow}
          contentContainerStyle={styles.categoryList}
        />
      )}
    </View>
  );

  const renderProductList = () => {
    const filtered = searchQuery.trim()
      ? categoryProducts.filter(p =>
          p.display_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.name.toLowerCase().includes(searchQuery.toLowerCase())
        )
      : categoryProducts;

    return (
      <View style={{ flex: 1 }}>
        {/* Sub-header with back button */}
        <View style={styles.subHeader}>
          <TouchableOpacity onPress={handleBackToCategories} style={styles.subHeaderBack}>
            <ArrowLeft size={20} color={colors.primaryColor} />
            <Text style={[styles.subHeaderBackText, { color: colors.primaryColor }]}>Categories</Text>
          </TouchableOpacity>
          <Text style={[styles.subHeaderTitle, { color: colors.textColor }]}>{selectedCategoryName}</Text>
          <TouchableOpacity 
            onPress={() => setIsAddingProduct(true)}
            style={styles.subHeaderAdd}
          >
            <Plus size={20} color={colors.primaryColor} />
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primaryColor} />
          </View>
        ) : (
          <FlatList
            key="products-list"
            data={filtered}
            renderItem={renderProductItem}
            keyExtractor={item => item.id}
            contentContainerStyle={styles.productList}
            ListEmptyComponent={
              <View style={styles.emptyContainer}>
                {searchQuery.trim() ? (
                  <>
                    <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No matches for "{searchQuery}"</Text>
                    <TouchableOpacity 
                      style={[styles.legacyButton, { borderColor: colors.primaryColor }]} 
                      onPress={() => {
                        setNewProductName(searchQuery);
                        setIsAddingProduct(true);
                        setSearchQuery('');
                      }}
                    >
                      <Text style={{ color: colors.primaryColor, fontWeight: '700' }}>Add "{searchQuery}" as New Product</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <>
                    <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                      No products in {selectedCategoryName}.{'\n'}Add them through Orders.
                    </Text>
                  </>
                )}
              </View>
            }
          />
        )}
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.backgroundColor }]}>
      <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
      
      {/* Header */}
      <View style={[styles.header, { paddingTop: Math.max(10, insets.top + 4), backgroundColor: colors.cardBackground }]}>
        <View style={styles.headerDecoration1} />
        <View style={styles.headerDecoration2} />
        <View style={styles.headerContent}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <ArrowLeft size={22} color="#1e3a8a" />
          </TouchableOpacity>
          <View style={styles.headerIconContainer}>
            <View style={styles.headerIcon}>
              <ShoppingCart size={22} color="#1e3a8a" />
            </View>
            <View style={styles.headerTextContainer}>
              <Text style={[styles.headerTitle, { color: colors.textColor }]}>Multi-Item Sale</Text>
              <Text style={[styles.headerSubtitle, { color: colors.textSecondary }]}>
                {view === 'categories' ? 'Select a category to browse products' : `Selling from ${selectedCategoryName}`}
              </Text>
            </View>
          </View>
          {view === 'products' && (
            <TouchableOpacity 
              style={styles.headerAddButton} 
              onPress={() => setIsAddingProduct(true)}
            >
              <Plus size={20} color="#1e3a8a" />
            </TouchableOpacity>
          )}
        </View>

        {/* Search Bar (only in products view) */}
        {view === 'products' && (
          <View style={[styles.searchContainer, { backgroundColor: colors.inputBackground, marginTop: 16, borderWidth: 1, borderColor: colors.borderColor }]}>
            <Search size={20} color={colors.textSecondary} style={styles.searchIcon} />
            <TextInput
              ref={searchInputRef}
              style={[styles.searchInput, { color: colors.textColor }]}
              placeholder="Search products..."
              placeholderTextColor={colors.textSecondary}
              value={searchQuery}
              onChangeText={handleSearch}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => handleSearch('')}>
                <X size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>

      <View style={styles.content}>
        {view === 'categories' ? renderCategoryGrid() : renderProductList()}
      </View>

      {/* Add New Product Modal */}
      <Modal visible={isAddingProduct} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={[styles.modalContent, { backgroundColor: colors.cardBackground }]}
          >
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.textColor }]}>Add New Product</Text>
              <TouchableOpacity onPress={() => setIsAddingProduct(false)}>
                <X size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={styles.formGroup}>
              <Text style={[styles.modalLabel, { color: colors.textSecondary }]}>Product Name</Text>
              <TextInput
                style={[styles.modalInput, { color: colors.textColor, borderColor: colors.borderColor }]}
                placeholder="Enter name (e.g. Rice 1kg)"
                value={newProductName}
                onChangeText={setNewProductName}
                placeholderTextColor={colors.textSecondary}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={[styles.modalLabel, { color: colors.textSecondary }]}>Selling Price (K)</Text>
              <TextInput
                ref={priceInputRef}
                style={[styles.modalInput, { color: colors.textColor, borderColor: colors.borderColor }]}
                placeholder="0.00"
                keyboardType="decimal-pad"
                value={newProductPrice}
                onChangeText={setNewProductPrice}
                placeholderTextColor={colors.textSecondary}
              />
            </View>

            <TouchableOpacity 
              style={[styles.saveProductButton, { backgroundColor: colors.primaryColor }]}
              onPress={handleAddNewProduct}
              disabled={loading}
            >
              <Text style={styles.saveProductText}>Add to Inventory & Cart</Text>
            </TouchableOpacity>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* Checkout Modal */}
      <Modal visible={showCheckout} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={[styles.modalContent, { backgroundColor: colors.cardBackground }]}
          >
            <View style={styles.modalHeader}>
              <View>
                <Text style={[styles.modalTitle, { color: colors.textColor, marginBottom: 4 }]}>Complete Sale</Text>
                <Text style={{ color: colors.textSecondary, fontSize: 14 }}>Total: K{cart.total_amount.toLocaleString()}</Text>
              </View>
              <TouchableOpacity onPress={() => setShowCheckout(false)}>
                <X size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={styles.formGroup}>
              <Text style={[styles.modalLabel, { color: colors.textSecondary }]}>Payment Status</Text>
              <View style={styles.segmentedContainer}>
                <TouchableOpacity
                  style={[styles.segment, paymentMode === 'Paid' && { backgroundColor: colors.primaryColor }]}
                  onPress={() => setPaymentMode('Paid')}
                >
                  <Text style={[styles.segmentText, paymentMode === 'Paid' && { color: '#fff' }]}>Paid Full</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.segment, paymentMode === 'Credit' && { backgroundColor: '#ef4444' }]}
                  onPress={() => setPaymentMode('Credit')}
                >
                  <Text style={[styles.segmentText, paymentMode === 'Credit' && { color: '#fff' }]}>On Credit</Text>
                </TouchableOpacity>
              </View>
            </View>

            {paymentMode === 'Credit' && (
              <>
                <View style={styles.formGroup}>
                  <Text style={[styles.modalLabel, { color: colors.textSecondary }]}>Customer Name (Required)</Text>
                  <TextInput
                    style={[styles.modalInput, { color: colors.textColor, borderColor: colors.borderColor }]}
                    placeholder="Enter customer name"
                    value={customerName}
                    onChangeText={setCustomerName}
                    placeholderTextColor={colors.textSecondary}
                  />
                </View>
                <View style={styles.formGroup}>
                  <Text style={[styles.modalLabel, { color: colors.textSecondary }]}>Customer Phone (Optional)</Text>
                  <TextInput
                    style={[styles.modalInput, { color: colors.textColor, borderColor: colors.borderColor }]}
                    placeholder="e.g. 0970000000"
                    keyboardType="phone-pad"
                    value={customerPhone}
                    onChangeText={setCustomerPhone}
                    placeholderTextColor={colors.textSecondary}
                  />
                </View>
              </>
            )}

            <TouchableOpacity 
              style={[
                styles.saveProductButton, 
                { backgroundColor: paymentMode === 'Credit' ? '#ef4444' : colors.primaryColor },
                (paymentMode === 'Credit' && !customerName.trim()) && { opacity: 0.5 }
              ]}
              onPress={handleCompleteSale}
              disabled={completing || (paymentMode === 'Credit' && !customerName.trim())}
            >
              {completing ? (
                <ActivityIndicator color="#ffffff" size="small" />
              ) : (
                <Text style={styles.saveProductText}>Confirm {paymentMode === 'Credit' ? 'Credit' : 'Payment'}</Text>
              )}
            </TouchableOpacity>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* Persistent Cart Footer */}
      <View style={[styles.footer, { backgroundColor: colors.cardBackground, borderTopColor: colors.borderColor, paddingBottom: Math.max(20, insets.bottom + 10) }]}>
        <Animated.View style={[styles.footerContent, { transform: [{ scale: cartScale }] }]}>
          <View style={styles.cartSummary}>
            <View style={styles.cartIconBadge}>
              <ShoppingCart size={24} color={colors.primaryColor} />
              {cart.items.length > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{cart.items.reduce((a, b) => a + b.quantity, 0)}</Text>
                </View>
              )}
            </View>
            <View>
              <Text style={[styles.footerTotalLabel, { color: colors.textSecondary }]}>Grand Total</Text>
              <Text style={[styles.footerTotal, { color: colors.textColor }]}>K{cart.total_amount.toLocaleString()}</Text>
            </View>
          </View>

          <TouchableOpacity 
            style={[
              styles.completeButton, 
              { backgroundColor: cart.items.length > 0 ? colors.primaryColor : colors.borderColor }
            ]}
            onPress={() => setShowCheckout(true)}
            disabled={cart.items.length === 0 || completing}
            activeOpacity={0.8}
          >
            {completing ? (
              <ActivityIndicator color="#ffffff" size="small" />
            ) : (
              <>
                <Text style={styles.completeButtonText}>Complete Sale</Text>
                <CheckCircle2 size={20} color="#ffffff" style={{ marginLeft: 8 }} />
              </>
            )}
          </TouchableOpacity>
        </Animated.View>
        
        {cart.items.length > 0 && (
          <TouchableOpacity onPress={clearCart} style={styles.clearCartButton}>
            <Trash2 size={14} color="#ef4444" />
            <Text style={styles.clearCartText}>Clear Cart</Text>
          </TouchableOpacity>
        )}
      </View>
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
  headerAddButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(30, 58, 138, 0.08)',
    borderRadius: 12,
    marginLeft: 16,
  },
  searchContainer: { flexDirection: 'row', alignItems: 'center', height: 50, borderRadius: 16, paddingHorizontal: 15 },
  searchIcon: { marginRight: 10 },
  searchInput: { flex: 1, fontSize: 16, fontWeight: '500' },
  content: { flex: 1 },
  sectionTitle: { fontSize: 18, fontWeight: '800', marginBottom: 16, paddingHorizontal: 20, marginTop: 20 },

  // Category grid
  categoryGridContainer: { flex: 1 },
  categoryList: { padding: 20, paddingBottom: 120 },
  categoryRow: { gap: 12, marginBottom: 12 },
  categoryCard: {
    flex: 1,
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: 'center',
    gap: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
  },
  categoryCardIcon: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: 'rgba(30, 58, 138, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryCardName: { fontSize: 16, fontWeight: '700', textAlign: 'center' },
  categoryCardCount: { fontSize: 13, fontWeight: '500' },

  // Sub-header for products view
  subHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  subHeaderBack: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  subHeaderBackText: { fontSize: 14, fontWeight: '600' },
  subHeaderTitle: { fontSize: 16, fontWeight: '800', flex: 1, textAlign: 'center' },
  subHeaderAdd: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: 'rgba(30, 58, 138, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Product list
  productList: { padding: 20, paddingBottom: 120 },
  productItem: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    padding: 16, 
    borderRadius: 20, 
    marginBottom: 12, 
    borderWidth: 1,
  },
  productInfo: { flex: 1 },
  productName: { fontSize: 16, fontWeight: '700', marginBottom: 4 },
  productPrice: { fontSize: 14, fontWeight: '600' },
  addButton: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  quantityControls: { flexDirection: 'row', alignItems: 'center', gap: 15 },
  qtyButton: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  quantityText: { fontSize: 16, fontWeight: '900', minWidth: 20, textAlign: 'center' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyContainer: { alignItems: 'center', marginTop: 60, paddingHorizontal: 20 },
  emptyText: { fontSize: 15, textAlign: 'center', marginBottom: 20, lineHeight: 22 },
  refreshButton: { padding: 10 },
  legacyButton: { paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12, borderWidth: 1 },
  footer: { 
    position: 'absolute', 
    bottom: 0, 
    left: 0, 
    right: 0, 
    paddingHorizontal: 20, 
    paddingTop: 15,
    borderTopWidth: 1, 
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    elevation: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.1,
    shadowRadius: 15,
  },
  footerContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cartSummary: { flexDirection: 'row', alignItems: 'center', gap: 15 },
  cartIconBadge: { position: 'relative', padding: 5 },
  badge: { 
    position: 'absolute', 
    top: -5, 
    right: -5, 
    backgroundColor: '#ef4444', 
    borderRadius: 10, 
    minWidth: 20, 
    height: 20, 
    justifyContent: 'center', 
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  badgeText: { color: '#ffffff', fontSize: 10, fontWeight: '900' },
  footerTotalLabel: { fontSize: 12, fontWeight: '700' },
  footerTotal: { fontSize: 20, fontWeight: '900' },
  completeButton: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    paddingHorizontal: 24, 
    paddingVertical: 14, 
    borderRadius: 16,
    minWidth: 160,
    justifyContent: 'center',
  },
  completeButtonText: { color: '#ffffff', fontSize: 16, fontWeight: '800' },
  clearCartButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, marginTop: 10 },
  clearCartText: { color: "#ef4444", fontSize: 12, fontWeight: "600" },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, paddingBottom: 40 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  modalTitle: { fontSize: 20, fontWeight: '800' },
  formGroup: { marginBottom: 20 },
  modalLabel: { fontSize: 14, fontWeight: '700', marginBottom: 8 },
  modalInput: { height: 56, borderWidth: 1, borderRadius: 12, paddingHorizontal: 16, fontSize: 16 },
  saveProductButton: { height: 56, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginTop: 10 },
  saveProductText: { color: '#ffffff', fontSize: 16, fontWeight: '800' },
  segmentedContainer: { flexDirection: 'row', backgroundColor: 'rgba(0,0,0,0.05)', borderRadius: 12, padding: 4 },
  segment: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 10 },
  segmentText: { fontSize: 14, fontWeight: '700', color: '#666' },
});
