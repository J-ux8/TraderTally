import { useCallback, useState, useEffect } from 'react';
import {
  Template,
  TemplateInput,
  createTemplate as createTemplateLib,
  updateTemplate as updateTemplateLib,
  deleteTemplate as deleteTemplateLib,
  getTemplates as getTemplatesLib,
  useTemplateForTransaction,
} from '@/lib/templates';
import { useSync } from '@/context/SyncContext';
import { supabase } from '@/lib/supabase';

export interface UseTemplatesReturn {
  templates: Template[];
  loading: boolean;
  error: string | null;
  createTemplate: (input: TemplateInput) => Promise<Template>;
  updateTemplate: (id: string, input: TemplateInput) => Promise<Template>;
  deleteTemplate: (id: string) => Promise<void>;
  useTemplate: (id: string) => Promise<Template>;
  refresh: () => Promise<void>;
  getRecentTemplates: (count?: number) => Template[];
}

export function useTemplates(): UseTemplatesReturn {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { triggerSync } = useSync();

  const loadTemplates = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getTemplatesLib();
      setTemplates(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load templates';
      if (!(message.includes('not authenticated') || message.includes('Not authenticated'))) {
        setError(message);
        console.error('Error loading templates:', err);
      } else {
        setTemplates([]);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // Load templates on mount and handle auth changes
  useEffect(() => {
    loadTemplates();

    const { data: { subscription: authSub } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'USER_UPDATED') {
        console.log('[Templates] Auth changed, reloading templates...');
        loadTemplates();
      } else if (event === 'SIGNED_OUT') {
        setTemplates([]);
      }
    });

    return () => authSub.unsubscribe();
  }, [loadTemplates]);

  const refresh = useCallback(async () => {
    await loadTemplates();
    triggerSync().catch(console.error);
  }, [loadTemplates, triggerSync]);

  const handleCreateTemplate = useCallback(async (input: TemplateInput): Promise<Template> => {
    try {
      setError(null);
      const newTemplate = await createTemplateLib(input);
      setTemplates((prev) => [newTemplate, ...prev]);
      return newTemplate;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create template';
      setError(message);
      throw err;
    }
  }, []);

  const handleUpdateTemplate = useCallback(async (id: string, input: TemplateInput): Promise<Template> => {
    try {
      setError(null);
      const updated = await updateTemplateLib(id, input);
      setTemplates((prev) =>
        prev.map((t) => (t.id === id ? updated : t))
      );
      return updated;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update template';
      setError(message);
      throw err;
    }
  }, []);

  const handleDeleteTemplate = useCallback(async (id: string): Promise<void> => {
    try {
      setError(null);
      await deleteTemplateLib(id);
      setTemplates((prev) => prev.filter((t) => t.id !== id));
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete template';
      setError(message);
      throw err;
    }
  }, []);

  const handleUseTemplate = useCallback(async (id: string): Promise<Template> => {
    try {
      setError(null);
      return await useTemplateForTransaction(id);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to use template';
      setError(message);
      throw err;
    }
  }, []);

  const getRecentTemplates = useCallback((count: number = 6): Template[] => {
    return templates.filter((t) => t.is_deleted === 0).slice(0, count);
  }, [templates]);

  return {
    templates,
    loading,
    error,
    createTemplate: handleCreateTemplate,
    updateTemplate: handleUpdateTemplate,
    deleteTemplate: handleDeleteTemplate,
    useTemplate: handleUseTemplate,
    refresh,
    getRecentTemplates,
  };
}