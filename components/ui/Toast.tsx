import React, { useEffect, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { Check, AlertCircle } from 'lucide-react-native';

export type ToastType = 'success' | 'error' | 'info';

export interface ToastMessage {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  amount?: number;
  category?: string;
  duration?: number;
}

interface ToastProps {
  message: ToastMessage;
  onDismiss: (id: string) => void;
}

const Toast: React.FC<ToastProps> = ({ message, onDismiss }) => {
  const [slideAnim] = useState(new Animated.Value(-150));
  const [fadeAnim] = useState(new Animated.Value(0));

  useEffect(() => {
    // Slide down and fade in
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start();

    // Auto dismiss
    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: -150,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
        }),
      ]).start(() => onDismiss(message.id));
    }, message.duration || 3000);

    return () => clearTimeout(timer);
  }, [message.id, message.duration, slideAnim, fadeAnim, onDismiss]);

  const getColors = () => {
    switch (message.type) {
      case 'success':
        return { bg: '#1e3a8a', icon: '#ffffff', text: '#ffffff' };
      case 'error':
        return { bg: '#ef4444', icon: '#ffffff', text: '#ffffff' };
      case 'info':
        return { bg: '#1e3a8a', icon: '#ffffff', text: '#ffffff' };
      default:
        return { bg: '#1e3a8a', icon: '#ffffff', text: '#ffffff' };
    }
  };

  const getIcon = () => {
    switch (message.type) {
      case 'success':
        return <Check size={24} color={getColors().icon} />;
      case 'error':
        return <AlertCircle size={24} color={getColors().icon} />;
      case 'info':
        return <Check size={24} color={getColors().icon} />;
      default:
        return null;
    }
  };

  const colors = getColors();

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        },
      ]}
    >
      <View style={[styles.toast, { backgroundColor: colors.bg }]}>
        <View style={styles.iconContainer}>{getIcon()}</View>

        <View style={styles.content}>
          <Text style={[styles.title, { color: colors.text }]}>{message.title}</Text>
          {message.message && (
            <Text style={[styles.message, { color: colors.text }]}>{message.message}</Text>
          )}
          {message.amount && (
            <View style={styles.detailsRow}>
              <Text style={[styles.amount, { color: colors.text }]}>
                K{message.amount.toFixed(2)}
              </Text>
              {message.category && (
                <Text style={[styles.category, { color: colors.text }]}>
                  • {message.category}
                </Text>
              )}
            </View>
          )}
        </View>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 0,
    zIndex: 9999,
  },
  toast: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    gap: 12,
  },
  iconContainer: {
    marginTop: 2,
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  message: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 4,
    opacity: 0.9,
  },
  detailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  amount: {
    fontSize: 14,
    fontWeight: '700',
  },
  category: {
    fontSize: 13,
    fontWeight: '500',
    opacity: 0.85,
  },
});

export default Toast;
