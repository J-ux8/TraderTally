import React, { createContext, useContext, useState, ReactNode } from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { useThemeColors } from '../../hooks/useThemeColors';
import { CheckCircle2, AlertCircle, AlertTriangle, Info } from 'lucide-react-native';

export type AlertButtonStyle = 'default' | 'cancel' | 'destructive';

export interface AlertButton {
  text: string;
  onPress?: () => void;
  style?: AlertButtonStyle;
}

interface AlertOptions {
  title: string;
  message?: string;
  buttons?: AlertButton[];
  type?: 'success' | 'error' | 'warning' | 'info';
}

interface CustomAlertContextType {
  showAlert: (title: string, message?: string, buttons?: AlertButton[], options?: { type?: 'success' | 'error' | 'warning' | 'info' }) => void;
}

const CustomAlertContext = createContext<CustomAlertContextType | undefined>(undefined);

export function CustomAlertProvider({ children }: { children: ReactNode }) {
  const colors = useThemeColors();
  const [visible, setVisible] = useState(false);
  const [alertConfig, setAlertConfig] = useState<AlertOptions | null>(null);

  // Default type inference based on title
  const inferType = (title: string, optionsType?: string) => {
    if (optionsType) return optionsType as any;
    const lowerTitle = title.toLowerCase();
    if (lowerTitle.includes('error') || lowerTitle.includes('fail')) return 'error';
    if (lowerTitle.includes('success')) return 'success';
    if (lowerTitle.includes('warning') || lowerTitle.includes('delete') || lowerTitle.includes('logout')) return 'warning';
    return 'info';
  };

  const showAlert = (
    title: string,
    message?: string,
    buttons?: AlertButton[],
    options?: { type?: 'success' | 'error' | 'warning' | 'info' }
  ) => {
    // If no buttons provided, provide a default OK button
    const defaultButtons: AlertButton[] = [{ text: 'OK' }];
    
    setAlertConfig({
      title,
      message,
      buttons: buttons && buttons.length > 0 ? buttons : defaultButtons,
      type: inferType(title, options?.type),
    });
    setVisible(true);
  };

  const handleClose = () => {
    setVisible(false);
  };

  const handlePress = (button: AlertButton) => {
    handleClose();
    // Allow state to update and modal to close before executing callback
    setTimeout(() => {
      if (button.onPress) {
        button.onPress();
      }
    }, 100);
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'success':
        return <CheckCircle2 size={40} color="#10b981" />;
      case 'error':
        return <AlertCircle size={40} color="#ef4444" />;
      case 'warning':
        return <AlertTriangle size={40} color="#f59e0b" />;
      default:
        return <Info size={40} color="#3b82f6" />;
    }
  };

  return (
    <CustomAlertContext.Provider value={{ showAlert }}>
      {children}
      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={handleClose}
      >
        <View style={styles.overlay}>
          <View style={[styles.alertBox, { backgroundColor: colors.cardBackground }]}>
            {alertConfig && (
              <>
                <View style={styles.iconContainer}>
                  {getIcon(alertConfig.type || 'info')}
                </View>
                
                <Text style={[styles.title, { color: colors.textColor }]}>
                  {alertConfig.title}
                </Text>
                
                {alertConfig.message && (
                  <Text style={[styles.message, { color: colors.textSecondary }]}>
                    {alertConfig.message}
                  </Text>
                )}

                <View style={styles.buttonContainer}>
                  {alertConfig.buttons?.map((btn, index) => {
                    // Determine button styles based on its 'style' property
                    const isDestructive = btn.style === 'destructive';
                    const isCancel = btn.style === 'cancel';
                    
                    const btnBgColor = isDestructive 
                      ? 'rgba(239, 68, 68, 0.1)' 
                      : isCancel 
                        ? 'rgba(107, 114, 128, 0.1)' 
                        : '#1e3a8a';
                        
                    const btnTextColor = isDestructive 
                      ? '#ef4444' 
                      : isCancel 
                        ? colors.textSecondary 
                        : '#ffffff';

                    return (
                      <TouchableOpacity
                        key={index}
                        style={[
                          styles.button,
                          { backgroundColor: btnBgColor },
                          alertConfig.buttons!.length > 1 && { flex: 1, marginHorizontal: 4 }
                        ]}
                        onPress={() => handlePress(btn)}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.buttonText, { color: btnTextColor, fontWeight: isCancel ? '600' : '700' }]}>
                          {btn.text}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </CustomAlertContext.Provider>
  );
}

export function useCustomAlert() {
  const context = useContext(CustomAlertContext);
  if (context === undefined) {
    throw new Error('useCustomAlert must be used within a CustomAlertProvider');
  }
  return context;
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  alertBox: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 10,
  },
  iconContainer: {
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 8,
  },
  message: {
    fontSize: 15,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    width: '100%',
  },
  button: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 100,
  },
  buttonText: {
    fontSize: 15,
  },
});
