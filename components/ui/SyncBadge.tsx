import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { CheckCircle, CloudOff, RefreshCw, AlertCircle, Cloud } from 'lucide-react-native';

export type SyncBadgeStatus = 'synced' | 'syncing' | 'offline' | 'failed' | 'pending';

interface SyncBadgeProps {
    status: SyncBadgeStatus;
}

const SYNC_CONFIG: Record<SyncBadgeStatus, { label: string; bg: string; icon: any; color: string }> = {
    synced: { label: 'Synced', bg: 'rgba(16, 185, 129, 0.25)', icon: CheckCircle, color: '#6ee7b7' },
    syncing: { label: 'Syncing', bg: 'rgba(96, 165, 250, 0.25)', icon: RefreshCw, color: '#93c5fd' },
    pending: { label: 'Pending', bg: 'rgba(251, 191, 36, 0.25)', icon: Cloud, color: '#fcd34d' },
    offline: { label: 'Offline', bg: 'rgba(239, 68, 68, 0.25)', icon: CloudOff, color: '#fca5a5' },
    failed: { label: 'Failed', bg: 'rgba(239, 68, 68, 0.3)', icon: AlertCircle, color: '#fca5a5' },
};

export const SyncBadge: React.FC<SyncBadgeProps> = ({ status }) => {
    const spinAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (status === 'syncing') {
            const animation = Animated.loop(
                Animated.timing(spinAnim, {
                    toValue: 1,
                    duration: 1200,
                    easing: Easing.linear,
                    useNativeDriver: true,
                })
            );
            animation.start();
            return () => animation.stop();
        } else {
            spinAnim.setValue(0);
        }
    }, [status]);

    const config = SYNC_CONFIG[status];
    const IconComponent = config.icon;

    const spin = spinAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '360deg'],
    });

    return (
        <View style={[styles.statusBadge, { backgroundColor: config.bg }]}>
            {status === 'syncing' ? (
                <Animated.View style={{ transform: [{ rotate: spin }] }}>
                    <IconComponent size={14} color={config.color} />
                </Animated.View>
            ) : (
                <IconComponent size={14} color={config.color} />
            )}
            <Text style={[styles.statusText, { color: config.color }]}>{config.label}</Text>
        </View>
    );
};

const styles = StyleSheet.create({
    statusBadge: {
        flexDirection: "row",
        alignItems: "center",
        gap: 5,
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 20,
    },
    statusText: {
        fontSize: 11,
        fontWeight: "700",
        letterSpacing: 0.3,
    },
});
