import { supabase } from '@/lib/supabase';
import { router } from 'expo-router';
import { BookOpen, PieChart, ShoppingBag } from 'lucide-react-native';
import React, { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Animated,
    Dimensions,
    FlatList,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';


const { width, height } = Dimensions.get('window');

const SLIDES = [
    {
        id: '1',
        icon: BookOpen,
        title: 'Welcome to MobiBooks',
        subtitle: 'Your simple business companion',
        description:
            'Built for micro-entrepreneurs like street vendors, grocery shops, salons, and more. Manage your money with ease.',
        accent: '#2563eb',
        bg: '#1e3a8a',
    },
    {
        id: '2',
        icon: ShoppingBag,
        title: 'Record Sales & Expenses',
        subtitle: 'Track every kwacha',
        description:
            'Log your daily sales and expenses in seconds. Know exactly what comes in and what goes out of your business.',
        accent: '#3b82f6',
        bg: '#1e40af',
    },
    {
        id: '3',
        icon: BookOpen,
        title: 'Credit Book',
        subtitle: 'Never lose track of debts',
        description:
            'Record who owes you and what you owe. Keep your credit relationships clear and organized.',
        accent: '#60a5fa',
        bg: '#1d4ed8',
    },
    {
        id: '4',
        icon: PieChart,
        title: 'Reports & Insights',
        subtitle: 'Understand your business',
        description:
            'See daily, weekly, and monthly summaries at a glance. Make smarter decisions with clear financial reports.',
        accent: '#93c5fd',
        bg: '#2563eb',
    },
];

export default function WelcomeScreen() {
    const [isCheckingAuth, setIsCheckingAuth] = useState(true);
    const [currentIndex, setCurrentIndex] = useState(0);
    const flatListRef = useRef<FlatList>(null);
    const scrollX = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        const checkAuth = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession();
                if (session?.user) {
                    // Small delay to ensure navigation system is ready
                    setTimeout(() => {
                        router.replace('/(tabs)');
                    }, 500);
                } else {
                    setIsCheckingAuth(false);
                }
            } catch (error) {
                console.error('Auth check error:', error);
                setIsCheckingAuth(false);
            }
        };

        checkAuth();
    }, []);

    if (isCheckingAuth) {
        return (
            <View style={{ flex: 1, backgroundColor: '#1e3a8a', justifyContent: 'center', alignItems: 'center' }}>
                <ActivityIndicator size="large" color="#ffffff" />
            </View>
        );
    }

    const handleNext = () => {
        if (currentIndex < SLIDES.length - 1) {
            const nextIndex = currentIndex + 1;
            flatListRef.current?.scrollToIndex({ index: nextIndex, animated: true });
            setCurrentIndex(nextIndex);
        }
    };

    const handleSkip = () => {
        router.replace('/Authentication/login');
    };

    const handleGetStarted = () => {
        router.replace('/Authentication/register');
    };

    const handleSignIn = () => {
        router.replace('/Authentication/login');
    };

    const onMomentumScrollEnd = (event: any) => {
        const index = Math.round(event.nativeEvent.contentOffset.x / width);
        setCurrentIndex(index);
    };

    const isLast = currentIndex === SLIDES.length - 1;

    return (
        <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
            {!isLast && (
                <TouchableOpacity style={styles.skipButton} onPress={handleSkip} activeOpacity={0.7}>
                    <Text style={styles.skipText}>Skip</Text>
                </TouchableOpacity>
            )}

            <Animated.FlatList
                ref={flatListRef}
                data={SLIDES}
                keyExtractor={(item) => item.id}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                bounces={false}
                onMomentumScrollEnd={onMomentumScrollEnd}
                onScroll={Animated.event(
                    [{ nativeEvent: { contentOffset: { x: scrollX } } }],
                    { useNativeDriver: false }
                )}
                renderItem={({ item }) => {
                    const IconComponent = item.icon;
                    return (
                        <View style={[styles.slide, { width }]}>
                            <View style={[styles.slideBackground, { backgroundColor: item.bg }]}>
                                <View style={styles.decorCircle1} />
                                <View style={styles.decorCircle2} />
                                <View style={styles.decorCircle3} />
                                <View style={[styles.iconContainer, 
                                    { borderColor: 'rgba(255,255,255,0.3)', backgroundColor: item.id === '1' ? 'transparent' : 'rgba(255,255,255,0.15)' }]}>
                                    {item.id === '1' ? (
                                        <Image
                                            source={require('../assets/images/icon.png')}
                                            style={{ width: 100, height: 100 }}
                                            contentFit="contain"
                                        />
                                    ) : (
                                        <IconComponent size={56} color="#ffffff" />
                                    )}
                                </View>


                                <Text style={styles.slideSubtitle}>{item.subtitle}</Text>
                            </View>
                            <View style={styles.slideContent}>
                                <Text style={styles.slideTitle}>{item.title}</Text>
                                <Text style={styles.slideDescription}>{item.description}</Text>
                            </View>
                        </View>
                    );
                }}
            />

            <View style={styles.dotsContainer}>
                {SLIDES.map((_, index) => {
                    const inputRange = [(index - 1) * width, index * width, (index + 1) * width];
                    const dotWidth = scrollX.interpolate({
                        inputRange,
                        outputRange: [8, 24, 8],
                        extrapolate: 'clamp',
                    });
                    const opacity = scrollX.interpolate({
                        inputRange,
                        outputRange: [0.3, 1, 0.3],
                        extrapolate: 'clamp',
                    });
                    return (
                        <Animated.View
                            key={index}
                            style={[styles.dot, { width: dotWidth, opacity }]}
                        />
                    );
                })}
            </View>

            <View style={styles.bottomActions}>
                {isLast ? (
                    <>
                        <TouchableOpacity
                            style={styles.getStartedButton}
                            onPress={handleGetStarted}
                            activeOpacity={0.85}
                        >
                            <Text style={styles.getStartedText}>Get Started</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.signInRow} onPress={handleSignIn} activeOpacity={0.7}>
                            <Text style={styles.signInPrompt}>Already have an account? </Text>
                            <Text style={styles.signInLink}>Sign In</Text>
                        </TouchableOpacity>
                    </>
                ) : (
                    <TouchableOpacity
                        style={styles.nextButton}
                        onPress={handleNext}
                        activeOpacity={0.85}
                    >
                        <Text style={styles.nextButtonText}>Next →</Text>
                    </TouchableOpacity>
                )}
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: '#ffffff',
    },
    skipButton: {
        position: 'absolute',
        top: 56,
        right: 24,
        zIndex: 10,
        paddingHorizontal: 14,
        paddingVertical: 7,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.25)',
    },
    skipText: {
        color: '#ffffff',
        fontSize: 14,
        fontWeight: '600',
    },
    slide: {
        flex: 1,
    },
    slideBackground: {
        height: height * 0.52,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 24,
        paddingTop: 48,
        paddingBottom: 32,
        overflow: 'hidden',
    },
    decorCircle1: {
        position: 'absolute',
        top: -60,
        right: -60,
        width: 200,
        height: 200,
        borderRadius: 100,
        backgroundColor: 'rgba(255,255,255,0.08)',
    },
    decorCircle2: {
        position: 'absolute',
        bottom: -40,
        left: -40,
        width: 150,
        height: 150,
        borderRadius: 75,
        backgroundColor: 'rgba(255,255,255,0.06)',
    },
    decorCircle3: {
        position: 'absolute',
        top: '30%',
        left: -30,
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: 'rgba(255,255,255,0.05)',
    },
    iconContainer: {
        width: 120,
        height: 120,
        borderRadius: 32,
        backgroundColor: 'rgba(255,255,255,0.15)',
        borderWidth: 2,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 24,
    },
    slideSubtitle: {
        fontSize: 18,
        fontWeight: '700',
        color: 'rgba(255,255,255,0.9)',
        textAlign: 'center',
        letterSpacing: 0.5,
    },
    slideContent: {
        flex: 1,
        paddingHorizontal: 28,
        paddingTop: 32,
        backgroundColor: '#ffffff',
    },
    slideTitle: {
        fontSize: 26,
        fontWeight: '800',
        color: '#1e3a8a',
        textAlign: 'center',
        marginBottom: 16,
        lineHeight: 34,
    },
    slideDescription: {
        fontSize: 16,
        color: '#4b5563',
        textAlign: 'center',
        lineHeight: 26,
        fontWeight: '400',
    },
    dotsContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 16,
        gap: 6,
        backgroundColor: '#ffffff',
    },
    dot: {
        height: 8,
        borderRadius: 4,
        backgroundColor: '#1e3a8a',
    },
    bottomActions: {
        paddingHorizontal: 24,
        paddingBottom: 24,
        paddingTop: 8,
        backgroundColor: '#ffffff',
        gap: 12,
    },
    nextButton: {
        backgroundColor: '#1e3a8a',
        borderRadius: 14,
        paddingVertical: 18,
        alignItems: 'center',
        shadowColor: '#1e3a8a',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    nextButtonText: {
        color: '#ffffff',
        fontSize: 18,
        fontWeight: '700',
        letterSpacing: 0.5,
    },
    getStartedButton: {
        backgroundColor: '#1e3a8a',
        borderRadius: 14,
        paddingVertical: 18,
        alignItems: 'center',
        shadowColor: '#1e3a8a',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    getStartedText: {
        color: '#ffffff',
        fontSize: 18,
        fontWeight: '700',
        letterSpacing: 0.5,
    },
    signInRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 8,
    },
    signInPrompt: {
        fontSize: 15,
        color: '#6b7280',
        fontWeight: '500',
    },
    signInLink: {
        fontSize: 15,
        fontWeight: '700',
        color: '#1e3a8a',
    },
});
