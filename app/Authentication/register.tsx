import { registerWithProfile } from "@/lib/auth";
import { router } from "expo-router";
import { ArrowRight, Briefcase, Check, ChevronDown, Lock, Mail, Phone, Store, User } from "lucide-react-native";
import { useState } from "react";
import { Alert, KeyboardAvoidingView, Modal, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { Image } from "expo-image";
import { SafeAreaView } from 'react-native-safe-area-context';

const BUSINESS_TYPES = [
  "Tutemba Shop",
  "Market Stall Vendor",
  "Grocery Store",
  "Street Vendor",
  "Service Provider",
  "Small Trader",
  "Other",
];

export default function RegisterScreen() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [businessType, setBusinessType] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showBusinessTypes, setShowBusinessTypes] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function handleRegister() {
    // Validation
    if (!fullName.trim() || !email.trim() || !phoneNumber.trim() || !businessType.trim() || !password.trim()) {
      Alert.alert("Error", "Please fill in all fields");
      return;
    }

    if (password.length < 6) {
      Alert.alert("Error", "Password must be at least 6 characters");
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      Alert.alert("Error", "Please enter a valid email address");
      return;
    }

    // Basic phone validation
    if (phoneNumber.length < 10) {
      Alert.alert("Error", "Please enter a valid phone number");
      return;
    }

    try {
      setLoading(true);
      const result = await registerWithProfile(email, password, fullName, phoneNumber, businessType);

      // ALWAYS navigate to OTP verification screen IMMEDIATELY
      // Use replace instead of push to prevent back navigation
      // This ensures all users go through our custom OTP flow
      if ((result as any)?.user?.id) {
        // Navigate immediately before any auth state changes can redirect
        router.replace({
          pathname: "/Authentication/verify-email",
          params: {
            email: email,
            userId: (result as any).user.id,
            fullName: fullName,
            phoneNumber: phoneNumber,
            businessType: businessType,
          },
        });
        // Don't set loading to false here - let verify-email screen handle it
        return;
      } else {
        // Fallback: if user creation failed, show error
        Alert.alert("Error", "Failed to create account. Please try again.");
      }
    } catch (error: any) {
      Alert.alert("Error", error.message || "Failed to create account. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const selectedBusinessType = BUSINESS_TYPES.find(type => type === businessType);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        {/* Hero Header */}
        <View style={styles.header}>
          <View style={styles.decorativeCircle1} />
          <View style={styles.decorativeCircle2} />

          <View style={styles.heroContent}>
            <View style={styles.heroTop}>
              <View style={styles.heroLeft}>
                <View style={styles.iconContainer}>
                  <Image
                    source={require('../../assets/images/icon.png')}
                    style={{ width: 32, height: 32 }}
                    contentFit="contain"
                  />
                </View>
                <View>
                  <Text style={styles.headerTitle}>TraderTally</Text>
                </View>
              </View>
            </View>

            <View style={styles.headerGreeting}>
              <Text style={styles.greetingText}>Create Account 👋</Text>
              <Text style={styles.greetingSubtext}>Start managing your business</Text>
            </View>
          </View>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Registration Form */}
          <View style={styles.formContainer}>
            {/* Full Name Input */}
            <View style={styles.inputCard}>
              <Text style={styles.label}>Full Name</Text>
              <View style={styles.inputContainer}>
                <User size={20} color="#666" style={styles.inputIcon} />
                <TextInput
                  placeholder="Enter your full name"
                  value={fullName}
                  onChangeText={setFullName}
                  placeholderTextColor="#999"
                  style={styles.input}
                  autoCapitalize="words"
                  autoComplete="name"
                />
              </View>
            </View>

            {/* Email Input */}
            <View style={styles.inputCard}>
              <Text style={styles.label}>Email</Text>
              <View style={styles.inputContainer}>
                <Mail size={20} color="#666" style={styles.inputIcon} />
                <TextInput
                  placeholder="Enter your email"
                  value={email}
                  onChangeText={setEmail}
                  placeholderTextColor="#999"
                  style={styles.input}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  autoComplete="email"
                />
              </View>
            </View>

            {/* Phone Number Input */}
            <View style={styles.inputCard}>
              <Text style={styles.label}>Phone Number</Text>
              <View style={styles.inputContainer}>
                <Phone size={20} color="#666" style={styles.inputIcon} />
                <TextInput
                  placeholder="Enter your phone number"
                  value={phoneNumber}
                  onChangeText={setPhoneNumber}
                  placeholderTextColor="#999"
                  style={styles.input}
                  keyboardType="phone-pad"
                  autoComplete="tel"
                />
              </View>
            </View>

            {/* Business Type Selector */}
            <View style={styles.inputCard}>
              <Text style={styles.label}>Business Type</Text>
              <View style={styles.categoryWrapper}>
                <TouchableOpacity
                  style={styles.businessTypeButton}
                  onPress={() => setShowBusinessTypes(!showBusinessTypes)}
                  activeOpacity={0.7}
                >
                  <View style={styles.businessTypeButtonContent}>
                    <Briefcase size={20} color="#666" style={styles.inputIcon} />
                    <Text style={[styles.businessTypeText, !selectedBusinessType && styles.placeholder]}>
                      {selectedBusinessType || "Select business type"}
                    </Text>
                  </View>
                  <ChevronDown
                    size={20}
                    color="#666"
                    style={[styles.chevron, showBusinessTypes && styles.chevronRotated]}
                  />
                </TouchableOpacity>

                {showBusinessTypes && (
                  <Modal
                    visible={showBusinessTypes}
                    transparent
                    animationType="fade"
                    onRequestClose={() => setShowBusinessTypes(false)}
                  >
                    <TouchableOpacity
                      style={styles.categoryOverlay}
                      activeOpacity={1}
                      onPress={() => setShowBusinessTypes(false)}
                    >
                      <View style={styles.categoryDropdownContainer}>
                        <View style={styles.categoryDropdown}>
                          <ScrollView
                            style={styles.categoryScrollView}
                            nestedScrollEnabled
                            showsVerticalScrollIndicator={false}
                          >
                            {BUSINESS_TYPES.map((type) => (
                              <TouchableOpacity
                                key={type}
                                style={styles.categoryOption}
                                onPress={() => {
                                  setBusinessType(type);
                                  setShowBusinessTypes(false);
                                }}
                                activeOpacity={0.7}
                              >
                                <Text style={styles.categoryOptionText}>{type}</Text>
                                {businessType === type && (
                                  <Check size={20} color="#1e3a8a" />
                                )}
                              </TouchableOpacity>
                            ))}
                          </ScrollView>
                        </View>
                      </View>
                    </TouchableOpacity>
                  </Modal>
                )}
              </View>
            </View>

            {/* Password Input */}
            <View style={styles.inputCard}>
              <Text style={styles.label}>PIN / Password</Text>
              <View style={styles.inputContainer}>
                <Lock size={20} color="#666" style={styles.inputIcon} />
                <TextInput
                  placeholder="Enter your password"
                  value={password}
                  onChangeText={setPassword}
                  placeholderTextColor="#999"
                  secureTextEntry={!showPassword}
                  style={styles.input}
                  autoComplete="password"
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  style={styles.eyeIcon}
                  activeOpacity={0.7}
                >
                  <Text style={styles.eyeIconText}>{showPassword ? "Hide" : "Show"}</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Register Button */}
            <TouchableOpacity
              onPress={handleRegister}
              disabled={loading || !fullName.trim() || !email.trim() || !phoneNumber.trim() || !businessType.trim() || !password.trim()}
              style={[styles.registerButton, (loading || !fullName.trim() || !email.trim() || !phoneNumber.trim() || !businessType.trim() || !password.trim()) && styles.registerButtonDisabled]}
              activeOpacity={0.8}
            >
              <Text style={styles.registerButtonText}>
                {loading ? "Creating Account..." : "Create Account"}
              </Text>
              {!loading && <ArrowRight size={20} color="#ffffff" style={styles.buttonIcon} />}
            </TouchableOpacity>

            {/* Login Link */}
            <View style={styles.loginContainer}>
              <Text style={styles.loginText}>Already have an account? </Text>
              <TouchableOpacity onPress={() => router.replace("/Authentication/login")} activeOpacity={0.7}>
                <Text style={styles.loginLink}>Sign In</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  header: {
    backgroundColor: "#ffffff",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    position: "relative",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 12,
    elevation: 2,
  },
  decorativeCircle1: {
    position: "absolute",
    top: -40,
    right: -40,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "rgba(30, 58, 138, 0.04)",
  },
  decorativeCircle2: {
    position: "absolute",
    bottom: -20,
    left: -20,
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(30, 58, 138, 0.03)",
  },
  heroContent: {
    position: "relative",
    zIndex: 10,
  },
  heroTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  heroLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  iconContainer: {
    width: 48,
    height: 48,
    backgroundColor: "rgba(30, 58, 138, 0.08)",
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#1e293b",
  },
  headerSubtitle: {
    fontSize: 13,
    color: "#94a3b8",
    fontWeight: "500",
    marginTop: 2,
  },
  headerGreeting: {
    marginTop: 4,
  },
  greetingText: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1e293b",
    marginBottom: 4,
  },
  greetingSubtext: {
    fontSize: 14,
    color: "#64748b",
    fontWeight: "500",
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingTop: 32,
    paddingBottom: 40,
  },
  formContainer: {
    gap: 20,
  },
  inputCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  label: {
    fontSize: 14,
    fontWeight: "700",
    color: "#666",
    marginBottom: 12,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f9fafb",
    borderWidth: 2,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    paddingHorizontal: 16,
    minHeight: 56,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 16,
    fontWeight: "500",
    color: "#333",
    paddingVertical: 0,
  },
  eyeIcon: {
    paddingLeft: 12,
  },
  eyeIconText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#1e3a8a",
  },
  categoryWrapper: {
    position: "relative",
    zIndex: 10,
  },
  businessTypeButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#f9fafb",
    borderWidth: 2,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    paddingHorizontal: 16,
    minHeight: 56,
  },
  businessTypeButtonContent: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  businessTypeText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
  },
  placeholder: {
    color: "#999",
    fontWeight: "500",
  },
  chevron: {
    transform: [{ rotate: '0deg' }],
  },
  chevronRotated: {
    transform: [{ rotate: '180deg' }],
  },
  categoryOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  categoryDropdownContainer: {
    width: "100%",
    maxWidth: 400,
  },
  categoryDropdown: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 12,
    maxHeight: 300,
    overflow: "hidden",
  },
  categoryScrollView: {
    maxHeight: 300,
  },
  categoryOption: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#ffffff",
  },
  categoryOptionText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
  },
  registerButton: {
    backgroundColor: "#1e3a8a",
    borderRadius: 12,
    paddingVertical: 18,
    paddingHorizontal: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
    shadowColor: "#1e3a8a",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  registerButtonDisabled: {
    opacity: 0.6,
  },
  registerButtonText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#ffffff",
  },
  buttonIcon: {
    marginLeft: 8,
  },
  loginContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 24,
    paddingVertical: 16,
  },
  loginText: {
    fontSize: 16,
    color: "#666",
  },
  loginLink: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1e3a8a",
  },
});
