import { createUserProfile } from "@/lib/profile";
import { supabase } from "@/lib/supabase";
import { resendVerificationOTP, sendVerificationOTP, verifyOTP } from "@/lib/verification-production";
import { router, useLocalSearchParams } from "expo-router";
import { ArrowLeft, CheckCircle, Mail, RefreshCw } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, Keyboard, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from 'react-native-safe-area-context';

export default function VerifyEmailScreen() {
  const params = useLocalSearchParams();
  const [email, setEmail] = useState<string>("");
  const [userId, setUserId] = useState<string>("");
  const [profileData, setProfileData] = useState<{
    fullName?: string;
    phoneNumber?: string;
    businessType?: string;
  }>({});
  const [otpCode, setOtpCode] = useState<string[]>(["", "", "", "", "", ""]);
  const [resending, setResending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [otpSent, setOtpSent] = useState(false);
  const [displayOtp, setDisplayOtp] = useState<string>(""); // Store OTP to always display
  const inputRefs = useRef<(TextInput | null)[]>([]);

  useEffect(() => {
    getEmailFromSession();

    // Start countdown timer for resend button
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  useEffect(() => {
    // Auto-send OTP when screen loads (only if countdown is not active)
    if (email && userId && !otpSent && countdown === 0) {
      sendOTP();
    }
  }, [email, userId, countdown]);

  async function getEmailFromSession() {
    try {
      // First try to get from route params
      if (params?.email && typeof params.email === 'string') {
        setEmail(params.email);
      }

      if (params?.userId && typeof params.userId === 'string') {
        setUserId(params.userId);
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

  async function sendOTP() {
    if (!email || !userId) {
      Alert.alert("Error", "Email or user ID not found");
      return;
    }

    // Prevent sending if countdown is active
    if (countdown > 0) {
      Alert.alert(
        "Please Wait",
        `Please wait ${countdown} seconds before requesting a new code.`
      );
      return;
    }

    try {
      // This always returns the OTP code, even if email fails
      const otpCode = await sendVerificationOTP(email, userId);
      setDisplayOtp(otpCode); // Store OTP to display in UI
      setOtpSent(true);
      setCountdown(60); // 60 second cooldown

      Alert.alert(
        "Code Generated! ✅",
        `Your verification code is displayed below in the yellow box.${"\n\n"}Enter this code to verify your email.`,
        [{ text: "OK" }]
      );
    } catch (error: any) {
      console.error("Error sending OTP:", error);
      const errorMessage = error.message || "Failed to generate verification code. Please try again.";
      Alert.alert(
        "Error ⚠️",
        errorMessage,
        [{ text: "OK" }]
      );
    }
  }

  async function handleResendOTP() {
    if (!email || !userId) {
      Alert.alert("Error", "Email or user ID not found");
      return;
    }

    if (countdown > 0) {
      Alert.alert(
        "Please Wait",
        `Please wait ${countdown} seconds before requesting a new code.`
      );
      return;
    }

    try {
      setResending(true);
      // This always returns the OTP code
      const newOtp = await resendVerificationOTP(email, userId);
      setDisplayOtp(newOtp); // Store new OTP to display
      setCountdown(60); // 60 second cooldown
      Alert.alert(
        "New Code Generated! ✅",
        "A new verification code is displayed below in the yellow box.",
        [{ text: "OK" }]
      );
    } catch (error: any) {
      console.error("Error resending OTP:", error);
      Alert.alert(
        "Error",
        error.message || "Failed to generate new verification code. Please try again."
      );
    } finally {
      setResending(false);
    }
  }

  async function handleVerifyOTP() {
    const code = otpCode.join("");

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
      const isValid = await verifyOTP(email, code, userId);

      if (isValid) {
        // Code is verified, now create profile and sign in user
        // First, check if we have a session
        let sessionUser = null;
        try {
          const { data: { session } } = await supabase.auth.getSession();
          sessionUser = session?.user;
        } catch (sessionError) {
          console.error("Error getting session:", sessionError);
        }

        // If no session, try to get user from auth
        if (!sessionUser && userId) {
          try {
            const { data: { user } } = await supabase.auth.getUser();
            sessionUser = user;
          } catch (userError) {
            console.error("Error getting user:", userError);
          }
        }

        // Create user profile after email verification
        let profileCreated = false;
        if (userId && profileData.fullName && profileData.phoneNumber && profileData.businessType) {
          try {
            const profile = await createUserProfile(
              userId,
              email,
              profileData.fullName,
              profileData.phoneNumber,
              profileData.businessType
            );
            if (profile) {
              console.log("Profile created successfully");
              profileCreated = true;
            } else {
              console.warn("Profile creation returned null");
              // Try to verify if profile exists
              const { data: existingProfile } = await supabase
                .from("profiles")
                .select("*")
                .eq("id", userId)
                .single();
              if (existingProfile) {
                profileCreated = true;
                console.log("Profile already exists");
              }
            }
          } catch (profileError: any) {
            console.error("Error creating profile:", profileError);
            const errorMsg = profileError.message || "Failed to create profile";

            // Check if it's an RLS error
            if (errorMsg.includes("RLS") || errorMsg.includes("42501")) {
              Alert.alert(
                "Setup Required ⚠️",
                "Profile creation failed. Please run the SQL migration 'fix_profiles_rls.sql' in Supabase Dashboard.\n\nYou can complete your profile later in Settings.",
                [
                  {
                    text: "Continue Anyway",
                    onPress: () => router.replace("/(tabs)"),
                  },
                ]
              );
              return;
            }

            // For other errors, show alert but allow continuation
            Alert.alert(
              "Profile Creation Failed",
              `Unable to create profile: ${errorMsg}\n\nYou can complete your profile later in Settings.`,
              [
                {
                  text: "Continue",
                  onPress: () => router.replace("/(tabs)"),
                },
              ]
            );
            return;
          }
        } else {
          // Missing profile data
          console.warn("Missing profile data, cannot create profile");
          Alert.alert(
            "Incomplete Profile Data",
            "Some profile information is missing. You can complete your profile later in Settings.",
            [
              {
                text: "Continue",
                onPress: () => router.replace("/(tabs)"),
              },
            ]
          );
          return;
        }

        // Email is verified and profile is created, redirect to app
        Alert.alert(
          "Success! 🎉",
          profileCreated
            ? "Your email has been verified and profile created successfully!"
            : "Your email has been verified successfully!",
          [
            {
              text: "Continue",
              onPress: () => router.replace("/(tabs)"),
            },
          ]
        );
      } else {
        Alert.alert(
          "Invalid Code",
          "The verification code is incorrect or has expired. Please check the code displayed above and try again, or request a new code."
        );
        // Clear OTP inputs
        setOtpCode(["", "", "", "", "", ""]);
        inputRefs.current[0]?.focus();
      }
    } catch (error: any) {
      console.error("Error verifying OTP:", error);
      Alert.alert("Error", error.message || "Failed to verify code. Please try again.");
    } finally {
      setVerifying(false);
    }
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
        setTimeout(() => handleVerifyOTP(), 500); // Slightly longer delay to ensure state is updated
      }
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
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerDecoration1} />
            <View style={styles.headerDecoration2} />
            <View style={styles.headerContent}>
              <TouchableOpacity
                onPress={() => router.back()}
                style={styles.backButton}
                activeOpacity={0.7}
              >
                <ArrowLeft size={24} color="#ffffff" />
              </TouchableOpacity>
              <View style={styles.headerIconContainer}>
                <View style={styles.headerIcon}>
                  <Mail size={28} color="#ffffff" />
                </View>
                <View style={styles.headerTextContainer}>
                  <Text style={styles.headerTitle}>Verify Your Email</Text>
                  <Text style={styles.headerSubtitle}>Enter the code we sent you</Text>
                </View>
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
              {displayOtp ? (
                <>
                  Your verification code is displayed below in the yellow box.{"\n\n"}
                  Please enter the code below to verify your email.
                </>
              ) : (
                <>
                  A verification code will be displayed below.{"\n\n"}
                  Please enter the code to verify your email.
                </>
              )}
            </Text>

            {/* Always display OTP code if available */}
            {displayOtp && (
              <View style={styles.otpDisplayContainer}>
                <Text style={styles.otpDisplayLabel}>Your Verification Code:</Text>
                <View style={styles.otpDisplayBox}>
                  <Text style={styles.otpDisplayCode}>{displayOtp}</Text>
                </View>
                <Text style={styles.otpDisplayHint}>
                  Enter this code in the boxes below
                </Text>
              </View>
            )}

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
                  autoFocus={index === 0 && !displayOtp}
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
    backgroundColor: "#1e3a8a",
    paddingTop: 60,
    paddingBottom: 40,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    position: "relative",
    overflow: "hidden",
  },
  headerDecoration1: {
    position: "absolute",
    top: -50,
    right: -50,
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
  },
  headerDecoration2: {
    position: "absolute",
    bottom: -30,
    left: -30,
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
  },
  headerContent: {
    zIndex: 10,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  headerIconContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  headerIcon: {
    width: 64,
    height: 64,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTextContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: "#ffffff",
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 16,
    color: "rgba(255, 255, 255, 0.9)",
    fontWeight: "500",
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
  otpDisplayContainer: {
    marginBottom: 24,
    padding: 20,
    backgroundColor: "#fef3c7",
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#f59e0b",
    alignItems: "center",
  },
  otpDisplayLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: "#92400e",
    marginBottom: 12,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  otpDisplayBox: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderWidth: 2,
    borderColor: "#f59e0b",
    marginBottom: 8,
    minWidth: 200,
  },
  otpDisplayCode: {
    fontSize: 32,
    fontWeight: "800",
    color: "#f59e0b",
    textAlign: "center",
    letterSpacing: 8,
    fontFamily: "monospace",
  },
  otpDisplayHint: {
    fontSize: 12,
    color: "#92400e",
    textAlign: "center",
    marginTop: 8,
  },
  copyButton: {
    marginTop: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: "#f59e0b",
    borderRadius: 8,
  },
  copyButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#ffffff",
    textAlign: "center",
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
