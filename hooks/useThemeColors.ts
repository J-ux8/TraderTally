import { useTheme } from '@/contexts/ThemeContext';

export function useThemeColors() {
  const { theme } = useTheme();

  return {
    backgroundColor: theme === 'dark' ? '#0f172a' : '#f5f5f5',
    cardBackground: theme === 'dark' ? '#1e293b' : '#ffffff',
    textColor: theme === 'dark' ? '#e2e8f0' : '#1e293b',
    textSecondary: theme === 'dark' ? '#94a3b8' : '#64748b',
    borderColor: theme === 'dark' ? '#334155' : '#e2e8f0',
    inputBackground: theme === 'dark' ? '#0f172a' : '#f8fafc',
    headerBackground: theme === 'dark' ? '#1e293b' : '#1e3a8a',
    primaryColor: '#1e3a8a',
    primaryLight: '#3b82f6',
    accentColor: '#1d4ed8',
  };
}
