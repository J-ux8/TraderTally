import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Product } from '../lib/products';

const CART_STORAGE_KEY = '@tradertally_cart';
const CART_EXPIRATION_MS = 24 * 60 * 60 * 1000; // 24 hours

export interface CartItem {
  product_id: string;
  name: string;
  price: number;
  quantity: number;
}

interface CartState {
  items: CartItem[];
  total_amount: number;
  last_updated: number;
}

interface CartContextType {
  cart: CartState;
  addItem: (product: Product) => void;
  increaseQty: (productId: string) => void;
  decreaseQty: (productId: string) => void;
  removeItem: (productId: string) => void;
  clearCart: () => void;
  loading: boolean;
}

const CartContext = createContext<CartContextType | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = useState<CartState>({
    items: [],
    total_amount: 0,
    last_updated: Date.now(),
  });
  const [loading, setLoading] = useState(true);

  // Load cart from AsyncStorage
  useEffect(() => {
    const loadCart = async () => {
      try {
        const savedCart = await AsyncStorage.getItem(CART_STORAGE_KEY);
        if (savedCart) {
          const parsedCart: CartState = JSON.parse(savedCart);
          const now = Date.now();
          
          // Check for expiration
          if (now - parsedCart.last_updated > CART_EXPIRATION_MS) {
            console.log('[CartContext] Cart expired, clearing...');
            await AsyncStorage.removeItem(CART_STORAGE_KEY);
          } else {
            setCart(parsedCart);
          }
        }
      } catch (error) {
        console.error('[CartContext] Failed to load cart:', error);
      } finally {
        setLoading(false);
      }
    };
    loadCart();
  }, []);

  // Save cart to AsyncStorage whenever it changes
  useEffect(() => {
    if (!loading) {
      AsyncStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart))
        .catch(err => console.error('[CartContext] Failed to save cart:', err));
    }
  }, [cart, loading]);

  const updateCartState = useCallback((newItems: CartItem[]) => {
    const total = newItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    setCart({
      items: newItems,
      total_amount: total,
      last_updated: Date.now(),
    });
  }, []);

  const addItem = useCallback((product: Product) => {
    setCart(prev => {
      const existingItemIndex = prev.items.findIndex(item => item.product_id === product.id);
      let newItems = [...prev.items];

      if (existingItemIndex > -1) {
        newItems[existingItemIndex] = {
          ...newItems[existingItemIndex],
          quantity: newItems[existingItemIndex].quantity + 1,
        };
      } else {
        newItems.push({
          product_id: product.id,
          name: product.display_name,
          price: product.price,
          quantity: 1,
        });
      }

      const total = newItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      return {
        items: newItems,
        total_amount: total,
        last_updated: Date.now(),
      };
    });
  }, []);

  const increaseQty = useCallback((productId: string) => {
    setCart(prev => {
      const newItems = prev.items.map(item => 
        item.product_id === productId 
          ? { ...item, quantity: item.quantity + 1 }
          : item
      );
      const total = newItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      return { ...prev, items: newItems, total_amount: total, last_updated: Date.now() };
    });
  }, []);

  const decreaseQty = useCallback((productId: string) => {
    setCart(prev => {
      const item = prev.items.find(i => i.product_id === productId);
      if (!item) return prev;

      let newItems: CartItem[];
      if (item.quantity <= 1) {
        newItems = prev.items.filter(i => i.product_id !== productId);
      } else {
        newItems = prev.items.map(i => 
          i.product_id === productId 
            ? { ...i, quantity: i.quantity - 1 }
            : i
        );
      }

      const total = newItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      return { ...prev, items: newItems, total_amount: total, last_updated: Date.now() };
    });
  }, []);

  const removeItem = useCallback((productId: string) => {
    setCart(prev => {
      const newItems = prev.items.filter(item => item.product_id !== productId);
      const total = newItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
      return { ...prev, items: newItems, total_amount: total, last_updated: Date.now() };
    });
  }, []);

  const clearCart = useCallback(() => {
    setCart({
      items: [],
      total_amount: 0,
      last_updated: Date.now(),
    });
    AsyncStorage.removeItem(CART_STORAGE_KEY).catch(console.error);
  }, []);

  return (
    <CartContext.Provider value={{ cart, addItem, increaseQty, decreaseQty, removeItem, clearCart, loading }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}
