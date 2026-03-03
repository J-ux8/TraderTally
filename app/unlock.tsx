import { signOut } from "@/lib/auth";
import { authenticateBiometric, getSecuritySettings, verifyPin } from "@/lib/security";
import { supabase } from "@/lib/supabase";
import { router } from "expo-router";
import { Lock, LogOut } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Alert, StyleSheet, Text, TouchableOpacity, View } from "react-native";

export default function UnlockScreen() {
    const [pin, setPin] = useState("");
    const [showPin, setShowPin] = useState(false);
    const [failedAttempts, setFailedAttempts] = useState(0);

    useEffect(() => {
        checkBiometrics();
    }, []);

    async function checkBiometrics() {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const settings = await getSecuritySettings(user.id);
        if (settings.biometricEnabled) {
            const success = await authenticateBiometric();
            if (success) {
                router.replace("/(tabs)");
            }
        }
    }

    async function handlePinSubmit() {
        if (pin.length < 4) return;

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const success = await verifyPin(user.id, pin);
        if (success) {
            router.replace("/(tabs)");
        } else {
            const newAttempts = failedAttempts + 1;
            setFailedAttempts(newAttempts);
            setPin("");

            if (newAttempts >= 5) {
                Alert.alert("Too Many Attempts", "For security, you have been logged out.");
                await signOut();
                router.replace("/welcome");
            } else {
                Alert.alert("Incorrect PIN", `You have ${5 - newAttempts} attempts left.`);
            }
        }
    }

    const renderPinDigits = () => {
        const digits = [];
        for (let i = 0; i < 4; i++) {
            digits.push(
                <View
                    key={i}
                    style={[
                        styles.pinDot,
                        pin.length > i ? styles.pinDotFilled : null
                    ]}
                />
            );
        }
        return digits;
    };

    const pressDigit = (digit: string) => {
        if (pin.length < 4) {
            setPin(pin + digit);
        }
    };

    const deleteDigit = () => {
        setPin(pin.slice(0, -1));
    };

    useEffect(() => {
        if (pin.length === 4) {
            handlePinSubmit();
        }
    }, [pin]);

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <View style={styles.iconContainer}>
                    <Lock size={48} color="#1e3a8a" />
                </View>
                <Text style={styles.title}>Welcome Back</Text>
                <Text style={styles.subtitle}>Enter your PIN to unlock MobiBooks</Text>
            </View>

            <View style={styles.pinDisplay}>
                {renderPinDigits()}
            </View>

            <View style={styles.keypad}>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, "", 0, "⌫"].map((item, index) => (
                    <TouchableOpacity
                        key={index}
                        style={[styles.key, !item && styles.emptyKey]}
                        onPress={() => {
                            if (item === "⌫") deleteDigit();
                            else if (item !== "") pressDigit(item.toString());
                        }}
                        disabled={!item && item !== 0}
                    >
                        <Text style={styles.keyText}>{item}</Text>
                    </TouchableOpacity>
                ))}
            </View>

            <TouchableOpacity
                style={styles.logoutButton}
                onPress={async () => {
                    await signOut();
                    router.replace("/welcome");
                }}
            >
                <LogOut size={20} color="#ef4444" />
                <Text style={styles.logoutText}>Logout</Text>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#ffffff",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
    },
    header: {
        alignItems: "center",
        marginBottom: 40,
    },
    iconContainer: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: "rgba(16, 185, 129, 0.1)",
        justifyContent: "center",
        alignItems: "center",
        marginBottom: 16,
    },
    title: {
        fontSize: 24,
        fontWeight: "800",
        color: "#333",
    },
    subtitle: {
        fontSize: 14,
        color: "#666",
        marginTop: 8,
    },
    pinDisplay: {
        flexDirection: "row",
        gap: 20,
        marginBottom: 60,
    },
    pinDot: {
        width: 20,
        height: 20,
        borderRadius: 10,
        borderWidth: 2,
        borderColor: "#e5e7eb",
    },
    pinDotFilled: {
        backgroundColor: "#1e3a8a",
        borderColor: "#1e3a8a",
    },
    keypad: {
        flexDirection: "row",
        flexWrap: "wrap",
        justifyContent: "center",
        width: "100%",
        maxWidth: 300,
    },
    key: {
        width: 80,
        height: 80,
        borderRadius: 40,
        justifyContent: "center",
        alignItems: "center",
        margin: 5,
        backgroundColor: "#f9fafb",
    },
    emptyKey: {
        backgroundColor: "transparent",
    },
    keyText: {
        fontSize: 24,
        fontWeight: "600",
        color: "#333",
    },
    logoutButton: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        marginTop: 40,
        padding: 12,
    },
    logoutText: {
        color: "#ef4444",
        fontSize: 16,
        fontWeight: "600",
    },
});
