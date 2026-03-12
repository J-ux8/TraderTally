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

  // Load templates on mount
  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getTemplatesLib();
      setTemplates(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load templates';
      setError(message);
      console.error('Error loading templates:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const refresh = useCallback(async () => {
    await loadTemplates();
  }, [loadTemplates]);

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
