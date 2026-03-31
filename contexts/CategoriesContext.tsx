import { getUserCategories, addCategory, deleteCategory } from '@/lib/categories';
import { useSync } from '@/context/SyncContext';
import { LocalDB } from '@/database/localDb';
import { supabase } from '@/lib/supabase';
import React, { createContext, useCallback, useContext, useEffect, useState, useRef } from 'react';

export interface Category {
  id: string;
  user_id: string;
  name: string;
  normalized_name: string;
  type: 'expense' | 'income';
  created_at: string;
  updated_at: string;
  is_deleted: number;
}

interface CategoriesContextType {
  categories: Category[];
  loading: boolean;
  refresh: () => Promise<void>;
  addCategory: (name: string, type?: 'expense' | 'income') => Promise<Category>;
  removeCategory: (id: string) => Promise<void>;
}

const CategoriesContext = createContext<CategoriesContextType | null>(null);

export function CategoriesProvider({ children }: { children: React.ReactNode }) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const { triggerSync, lastSyncedAt } = useSync();
  const hasInitializedRef = useRef(false);

  const loadCategories = useCallback(async () => {
    try {
      setLoading(true);
      let data = await getUserCategories();
      
      // No automatic seeding. Users start with an empty category list.
      setCategories(data);
    } catch (error) {
      if (error instanceof Error && (error.message.includes('not authenticated') || error.message.includes('Not authenticated'))) {
        setCategories([]);
      } else {
        console.error('Error loading categories:', error);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // 1. Initial load
    if (!hasInitializedRef.current) {
      hasInitializedRef.current = true;
      loadCategories();
    }

    // 2. Listen for auth changes to reload categories
    const { data: { subscription: authSub } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
        console.log('[Categories] Auth changed, reloading categories...');
        loadCategories();
      } else if (event === 'SIGNED_OUT') {
        setCategories([]);
      }
    });

    return () => authSub.unsubscribe();
  }, [loadCategories]);

  // Handle reloads when sync finishes
  useEffect(() => {
    if (lastSyncedAt) {
      console.log('[Categories] Sync detected, reloading data...');
      loadCategories();
    }
  }, [lastSyncedAt, loadCategories]);

  const refresh = useCallback(async () => {
    await loadCategories();
    triggerSync().catch(console.error);
  }, [loadCategories, triggerSync]);

  const handleAddCategory = async (name: string, type?: 'expense' | 'income'): Promise<Category> => {
    const result = await addCategory(name, type);
    await loadCategories();
    return result;
  };

  const handleRemoveCategory = async (id: string): Promise<void> => {
    await deleteCategory(id);
    await loadCategories();
  };

  return (
    <CategoriesContext.Provider
      value={{
        categories,
        loading,
        refresh,
        addCategory: handleAddCategory,
        removeCategory: handleRemoveCategory,
      }}
    >
      {children}
    </CategoriesContext.Provider>
  );
}

export function useCategoriesContext() {
  const context = useContext(CategoriesContext);
  if (!context) {
    throw new Error('useCategoriesContext must be used within CategoriesProvider');
  }
  return context;
}
