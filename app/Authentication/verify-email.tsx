import { createUserProfile } from "@/lib/profile";
import { supabase } from "@/lib/supabase";
import { resendVerificationOTP, verifyOTP } from "@/lib/verification-supabase";
import { router, useLocalSearchParams } from "expo-router";
import { ArrowLeft, CheckCircle, Mail, RefreshCw } from "lucide-react-native";
import { Image } from "expo-image";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, Keyboard, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from 'react-native-safe-area-context';

export default function VerifyEmailScreen() {
  const params = useLocalSearchParams();
  const [email, setEmail] = useState<string>("");
  const [userId, setUserId] = useState<string>("");
  const [type, setType] = useState<'signup' | 'recovery' | 'email_change'>('signup');
  const [profileData, setProfileData] = useState<{
    fullName?: string;
    phoneNumber?: string;
    businessType?: string;
  }>({});
  const [otpCode, setOtpCode] = useState<string[]>(["", "", "", "", "", ""]);
  const [resending, setResending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [otpSent, setOtpSent] = useState(true); // Assume sent by signup or handled by first load
  const inputRefs = useRef<(TextInput | null)[]>([]);

  useEffect(() => {
    getEmailFromSession();

    // Start countdown timer for resend button
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  // The initial OTP is sent automatically by the signUp call in RegisterScreen
  // We don't need a separate sendOTP on mount anymore, just handle resend if needed

  async function getEmailFromSession() {
    try {
      // First try to get from route params
      if (params?.email && typeof params.email === 'string') {
        setEmail(params.email);
      }

      if (params?.userId && typeof params.userId === 'string') {
        setUserId(params.userId);
      }

      if (params?.type && (params.type === 'signup' || params.type === 'recovery' || params.type === 'email_change')) {
        setType(params.type as any);
      }

      // Get profile data from params
      if (params?.fullName && typeof params.fullName === 'string') {
        setProfileData(prev => ({ ...prev, fullName: params.fullName as string }));
      }
      if (params?.phoneNumber && typeof params.phoneNumber === 'string') {
        setProfileData(prev => ({ ...prev, phoneNumber: params.phoneNumber as string }));
      }
      if (params?.businessType && typeof params.businessType === 'string') {
        setProfileData(prev => ({ ...prev, businessType: params.businessType as string }));
      }

      // Fallback to session
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        if (!email && session.user.email) {
          setEmail(session.user.email);
        }
        if (!userId && session.user.id) {
          setUserId(session.user.id);
        }
        // Try to get profile data from user metadata
        if (session.user.user_metadata) {
          const metadata = session.user.user_metadata;
          if (!profileData.fullName && metadata.full_name) {
            setProfileData(prev => ({ ...prev, fullName: metadata.full_name }));
          }
          if (!profileData.phoneNumber && metadata.phone_number) {
            setProfileData(prev => ({ ...prev, phoneNumber: metadata.phone_number }));
          }
          if (!profileData.businessType && metadata.business_type) {
            setProfileData(prev => ({ ...prev, businessType: metadata.business_type }));
          }
        }
      }
    } catch (error) {
      console.error("Error getting email:", error);
    }
  }

  // Initial OTP is handled by supabase.auth.signUp

  async function handleResendOTP() {
    if (!email) {
      Alert.alert("Error", "Email not found");
      return;
    }

    if (countdown > 0) return;

    try {
      setResending(true);
      await resendVerificationOTP(email, type === 'email_change' ? 'email_change' : 'signup');
      setCountdown(60);
      Alert.alert(
        "Code Sent! 📧",
        "A new verification code has been sent to your email address.",
        [{ text: "OK" }]
      );
    } catch (error: any) {
      console.error("Error resending OTP:", error);
      Alert.alert(
        "Error",
        error.message || "Failed to send new verification code. Please try again."
      );
    } finally {
      setResending(false);
    }
  }

  async function handleVerifyOTP() {
    const code = otpCode.join("");
    await verifyOTPCode(code);
  }

  function handleOtpChange(index: number, value: string) {
    // Only allow numbers
    const numericValue = value.replace(/[^0-9]/g, "");

    if (numericValue.length > 1) {
      // Handle paste
      const pastedCode = numericValue.slice(0, 6).split("");
      const newOtp = [...otpCode];
      pastedCode.forEach((digit, i) => {
        if (index + i < 6) {
          newOtp[index + i] = digit;
        }
      });
      setOtpCode(newOtp);

      // Focus on last filled input or next empty
      const nextIndex = Math.min(index + pastedCode.length, 5);
      inputRefs.current[nextIndex]?.focus();

      // Auto-verify if all 6 digits are now filled
      const fullCode = newOtp.join("");
      if (fullCode.length === 6) {
        Keyboard.dismiss();
        // Use the newOtp directly instead of waiting for state update
        setTimeout(() => verifyOTPCode(fullCode), 300);
      }
    } else {
      // Single digit input
      const newOtp = [...otpCode];
      newOtp[index] = numericValue;
      setOtpCode(newOtp);

      // Auto-focus next input
      if (numericValue && index < 5) {
        inputRefs.current[index + 1]?.focus();
      }

      // Auto-verify when all 6 digits are entered
      const fullCode = newOtp.join("");
      if (fullCode.length === 6) {
        // Dismiss keyboard before verifying
        Keyboard.dismiss();
        // Use the fullCode directly instead of waiting for state update
        setTimeout(() => verifyOTPCode(fullCode), 300);
      }
    }
  }

  async function verifyOTPCode(code: string) {
    if (code.length !== 6) {
      Alert.alert("Error", "Please enter the complete 6-digit code");
      return;
    }

    if (!email) {
      Alert.alert("Error", "Email not found");
      return;
    }

    try {
      setVerifying(true);
      // Map internal types to Supabase verification types
      // 'signup' → 'signup', 'recovery' → 'recovery', 'email_change' → 'email'
      let verifyType: 'signup' | 'email' | 'recovery' | 'invite' = 'signup';
      if (type === 'email_change') {
        verifyType = 'email';
      } else if (type === 'recovery') {
        verifyType = 'recovery';
      } else if (type === 'signup') {
        verifyType = 'signup';
      }
      const isVerified = await verifyOTP(email, code, verifyType);

      if (isVerified) {
        // Wait a bit for session to be established after verification
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Email is verified, retrieve the latest user data including metadata
        const { data: { session } } = await supabase.auth.getSession();
        const user = session?.user;

        if (!user) {
          throw new Error("Session not found after verification");
        }

        if (type === 'signup') {
          // Prepare profile data from current state or user metadata
          const profile = {
            fullName: profileData.fullName || user.user_metadata?.full_name || "",
            phoneNumber: profileData.phoneNumber || user.user_metadata?.phone_number || "",
            businessType: profileData.businessType || user.user_metadata?.business_type || "Other"
          };

          // Create or update user profile after verification
          try {
            const createdProfile = await createUserProfile(
              user.id,
              user.email || email,
              profile.fullName,
              profile.phoneNumber,
              profile.businessType
            );
            
            if (createdProfile) {
              console.log('[VerifyEmail] Profile created successfully');
            }
          } catch (profileError: any) {
            console.error("Non-blocking profile creation error:", profileError);
          }

          Alert.alert(
            "Success! 🎉",
            "Your account is verified. You can now start using TraderBooks!",
            [{ text: "Get Started", onPress: () => router.replace("/(tabs)") }]
          );
        } else if (type === 'recovery') {
          // Password reset flow
          Alert.alert(
            "Verified! 🔒",
            "You can now set a new password.",
            [{ text: "Continue", onPress: () => router.replace("/Authentication/reset-password") }]
          );
        } else {
          router.replace("/(tabs)");
        }
      }
    } catch (error: any) {
      console.error("Error verifying OTP:", error);
      const msg = error.message || "";
      if (msg.includes("invalid") || msg.includes("expired")) {
        Alert.alert("Verification Failed", "The code is invalid or has expired. Please check your email.");
      } else {
        Alert.alert("Error", error.message || "Failed to verify code.");
      }
      setOtpCode(["", "", "", "", "", ""]);
      inputRefs.current[0]?.focus();
    } finally {
      setVerifying(false);
    }
  }

  function handleKeyPress(index: number, key: string) {
    if (key === "Backspace" && !otpCode[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
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
                    <Text style={styles.headerTitle}>TraderBooks</Text>
                  </View>
                </View>

                <TouchableOpacity
                  onPress={() => router.back()}
                  style={styles.backButton}
                  activeOpacity={0.7}
                >
                  <ArrowLeft size={24} color="#1e293b" />
                </TouchableOpacity>
              </View>

              <View style={styles.headerGreeting}>
                <Text style={styles.greetingText}>Verify Account ✉️</Text>
                <Text style={styles.greetingSubtext}>Enter the code sent to your email</Text>
              </View>
            </View>
          </View>

          {/* Content */}
          <View style={styles.content}>
            <View style={styles.iconContainer}>
              <View style={styles.iconCircle}>
                <Mail size={48} color="#1e3a8a" />
              </View>
            </View>

            <Text style={styles.title}>Enter Verification Code</Text>

            <Text style={styles.description}>
              We've sent a 6-digit verification code to{"\n"}
              <Text style={styles.emailText}>{email || "your email"}</Text>
              {"\n\n"}Please enter the code below to verify your account.
            </Text>

            {/* OTP Input */}
            <View style={styles.otpContainer}>
              {otpCode.map((digit, index) => (
                <TextInput
                  key={`otp-${index}`}
                  ref={(ref) => {
                    inputRefs.current[index] = ref;
                  }}
                  style={[styles.otpInput, digit && styles.otpInputFilled]}
                  value={digit}
                  onChangeText={(value) => handleOtpChange(index, value)}
                  onKeyPress={({ nativeEvent }) => handleKeyPress(index, nativeEvent.key)}
                  keyboardType="number-pad"
                  maxLength={1}
                  selectTextOnFocus
                  autoFocus={index === 0}
                  blurOnSubmit={false}
                />
              ))}
            </View>

            {/* Action Buttons */}
            <View style={styles.actionsContainer}>
              <TouchableOpacity
                onPress={handleVerifyOTP}
                disabled={verifying || otpCode.join("").length !== 6}
                style={[
                  styles.primaryButton,
                  (verifying || otpCode.join("").length !== 6) && styles.buttonDisabled
                ]}
                activeOpacity={0.8}
              >
                {verifying ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <>
                    <CheckCircle size={20} color="#ffffff" />
                    <Text style={styles.primaryButtonText}>Verify Email</Text>
                  </>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                onPress={handleResendOTP}
                disabled={resending || countdown > 0}
                style={[
                  styles.secondaryButton,
                  (resending || countdown > 0) && styles.buttonDisabled
                ]}
                activeOpacity={0.8}
              >
                {resending ? (
                  <ActivityIndicator size="small" color="#1e3a8a" />
                ) : (
                  <>
                    <RefreshCw size={20} color="#1e3a8a" />
                    <Text style={styles.secondaryButtonText}>
                      {countdown > 0 ? `Resend in ${countdown}s` : "Resend Code"}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            {/* Help Text */}
            <View style={styles.helpContainer}>
              <Text style={styles.helpText}>
                Didn&apos;t receive the code? Check your spam folder or try resending.
              </Text>
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
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 20,
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
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "rgba(30, 58, 138, 0.04)",
    justifyContent: "center",
    alignItems: "center",
  },
  content: {
    flex: 1,
    padding: 20,
    paddingTop: 32,
  },
  iconContainer: {
    alignItems: "center",
    marginBottom: 24,
  },
  iconCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "rgba(16, 185, 129, 0.1)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 3,
    borderColor: "#1e3a8a",
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: "#333",
    textAlign: "center",
    marginBottom: 16,
  },
  description: {
    fontSize: 16,
    color: "#666",
    textAlign: "center",
    lineHeight: 24,
    marginBottom: 32,
  },
  emailText: {
    fontWeight: "700",
    color: "#1e3a8a",
  },
  otpContainer: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 12,
    marginBottom: 32,
  },
  otpInput: {
    width: 56,
    height: 56,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#e5e7eb",
    backgroundColor: "#ffffff",
    textAlign: "center",
    fontSize: 24,
    fontWeight: "700",
    color: "#333",
  },
  otpInputFilled: {
    borderColor: "#1e3a8a",
    backgroundColor: "#f0fdf4",
  },
  actionsContainer: {
    gap: 12,
    marginBottom: 24,
  },
  primaryButton: {
    backgroundColor: "#1e3a8a",
    borderRadius: 12,
    paddingVertical: 18,
    paddingHorizontal: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    shadowColor: "#1e3a8a",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  secondaryButton: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    paddingVertical: 18,
    paddingHorizontal: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 2,
    borderColor: "#1e3a8a",
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    fontSize: 18,
    fontWeight: "700",
    color: "#ffffff",
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#1e3a8a",
  },
  helpContainer: {
    padding: 16,
    backgroundColor: "#f9fafb",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  helpText: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    lineHeight: 20,
  },
});
