import { getUserCategories, addCategory, deleteCategory } from '@/lib/categories';
import { useSync } from '@/context/SyncContext';
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

export interface Category {
  id: string;
  user_id: string;
  name: string;
  normalized_name: string;
  created_at: string;
  updated_at: string;
  is_deleted: number;
}

interface CategoriesContextType {
  categories: Category[];
  loading: boolean;
  refresh: () => Promise<void>;
  addCategory: (name: string) => Promise<Category>;
  removeCategory: (id: string) => Promise<void>;
}

const CategoriesContext = createContext<CategoriesContextType | null>(null);

export function CategoriesProvider({ children }: { children: React.ReactNode }) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const { triggerSync } = useSync();

  const loadCategories = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getUserCategories();
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
    loadCategories();
  }, [loadCategories]);

  const refresh = useCallback(async () => {
    await loadCategories();
    triggerSync().catch(console.error);
  }, [loadCategories, triggerSync]);

  const handleAddCategory = async (name: string): Promise<Category> => {
    const result = await addCategory(name);
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
