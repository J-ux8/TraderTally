import React, { createContext, useContext } from 'react';
import { Template, TemplateInput } from '@/lib/templates';
import { useTemplates } from '@/hooks/useTemplates';

export interface TemplatesContextType {
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

const TemplatesContext = createContext<TemplatesContextType | undefined>(undefined);

export const TemplatesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const templatesHook = useTemplates();

  return (
    <TemplatesContext.Provider value={templatesHook}>
      {children}
    </TemplatesContext.Provider>
  );
};

export const useTemplatesContext = (): TemplatesContextType => {
  const context = useContext(TemplatesContext);
  if (!context) {
    throw new Error('useTemplatesContext must be used within TemplatesProvider');
  }
  return context;
};
