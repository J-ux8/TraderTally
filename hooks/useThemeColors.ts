import { useTheme } from '@/contexts/ThemeContext';

export function useThemeColors() {
  const { theme } = useTheme();
  
  return {
    backgroundColor: theme === 'dark' ? '#151718' : '#f5f5f5',
    cardBackground: theme === 'dark' ? '#1f2937' : '#ffffff',
    textColor: theme === 'dark' ? '#ECEDEE' : '#333',
    textSecondary: theme === 'dark' ? '#9BA1A6' : '#666',
    borderColor: theme === 'dark' ? '#374151' : '#e5e7eb',
    inputBackground: theme === 'dark' ? '#111827' : '#f9fafb',
    headerBackground: theme === 'dark' ? '#065f46' : '#10b981',
  };
}

