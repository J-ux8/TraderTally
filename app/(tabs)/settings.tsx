import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/contexts/ThemeContext';
import { signOut, deleteAccount } from '@/lib/auth';
import { getUserProfile, updatePassword, updateUserProfile, UserProfile, createUserProfile } from '@/lib/profile';
import { LocalDB } from '@/database/localDb';
import { supabase } from '@/lib/supabase';

import { router, useFocusEffect } from 'expo-router';
import {
  Bell,
  Briefcase,
  ChevronRight,
  Lock,
  LogOut,
  Mail,
  Moon,
  Phone,
  Settings as SettingsIcon,
  Sun,
  Trash2,
  User,
  UserCircle,
  ShieldCheck,
  RefreshCcw,
  Database,
  Download,
  AlertTriangle,
  FileText,
  Eye,
  EyeOff,
  Info,
  ExternalLink
} from 'lucide-react-native';
import { useTransactionsContext } from '@/contexts/TransactionsContext';
import { getDatabase, wipeDatabase } from '@/lib/database';
import * as FileSystem from 'expo-file-system/legacy';
// documentDirectory is available on the legacy API
const { documentDirectory } = FileSystem;
import * as WebBrowser from 'expo-web-browser';
import * as Sharing from 'expo-sharing';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

const BUSINESS_TYPES = [
  'Tutemba Shop',
  'Market Stall Vendor',
  'Grocery Store',
  'Street Vendor',
  'Service Provider',
  'Small Trader',
  'Other'
];

import { useCustomAlert } from '@/components/ui/CustomAlertContext';

export default function SettingsScreen() {
  const { showAlert } = useCustomAlert();
  const Alert = { alert: showAlert };
  const insets = useSafeAreaInsets();
  const { theme, themeMode, setThemeMode } = useTheme();
  const { user, loading: authLoading } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  // Edit Profile Modal
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [fullName, setFullName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [businessType, setBusinessType] = useState('');
  const [showBusinessTypeDropdown, setShowBusinessTypeDropdown] = useState(false);
  const [saving, setSaving] = useState(false);

  // Change Password Modal
  const [passwordModalVisible, setPasswordModalVisible] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  const [recoveryModalVisible, setRecoveryModalVisible] = useState(false);
  const [isRecovering, setIsRecovering] = useState(false);

  // Legal Modal
  const [legalModalVisible, setLegalModalVisible] = useState(false);
  const [legalModalType, setLegalModalType] = useState<'terms' | 'privacy'>('terms');

  const { transactions, refresh } = useTransactionsContext();

  useEffect(() => {
    if (user) {
      // Load profile in background, don't block UI
      loadProfile();
    }
  }, [user]);

  // Don't reload profile on every focus - it's cached in memory
  // User can manually refresh if needed via the UI
  useFocusEffect(
    useCallback(() => {
      // Profile is cached, no need to reload on focus
      return () => {};
    }, [])
  );

  async function loadProfile() {
    try {
      // Don't show loading spinner - load in background
      const profileData = await getUserProfile();
      setProfile(profileData);
      if (profileData) {
        setFullName(profileData.full_name || '');
        setPhoneNumber(profileData.phone_number || '');
        setBusinessType(profileData.business_type || 'Other');
        
        // If profile was found in metadata but NOT in local DB, save it locally now
        const local = await LocalDB.getById('profiles', user.id);
        if (!local && profileData.full_name) {
          await createUserProfile(user.id, user.id, profileData.full_name, profileData.phone_number, profileData.business_type);
        }
      }

    } catch (error) {
      console.error("Error loading profile:", error);
    }
  }

  async function handleSaveProfile() {
    if (!fullName.trim() || !phoneNumber.trim() || !businessType.trim()) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    setSaving(true);
    try {
      await updateUserProfile(fullName, phoneNumber, businessType);
      await loadProfile();
      setEditModalVisible(false);
      Alert.alert('Success', 'Profile updated successfully! 🎉');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  }

  async function handleChangePassword() {
    if (!currentPassword || !newPassword || !confirmPassword) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if (newPassword.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }

    if (newPassword !== confirmPassword) {
      Alert.alert('Error', 'New passwords do not match');
      return;
    }

    setChangingPassword(true);
    try {
      await updatePassword(currentPassword, newPassword);
      setPasswordModalVisible(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      Alert.alert('Success', 'Password changed successfully! 🔒');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to change password');
    } finally {
      setChangingPassword(false);
    }
  }

  async function handleOpenUrl(url: string) {
    if (url.includes('terms')) {
      setLegalModalType('terms');
      setLegalModalVisible(true);
    } else if (url.includes('privacy')) {
      setLegalModalType('privacy');
      setLegalModalVisible(true);
    } else {
      try {
        await WebBrowser.openBrowserAsync(url);
      } catch (error) {
        Alert.alert('Error', 'Unable to open the link. Please check your internet connection.');
      }
    }
  }

  async function handleLogout() {
    Alert.alert(
      "Logout",
      "Are you sure you want to logout?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Logout",
          style: "destructive",
          onPress: async () => {
            try {
              await signOut();
              // Redirect is now handled globally by useNavigationGuard
            } catch (error: any) {
              Alert.alert("Error", error.message || "Failed to logout");
            }
          },
        },
      ]
    );
  }

  async function handleDeleteAccount() {
    Alert.alert(
      "Delete Account",
      "Are you sure you want to delete your account? This action cannot be undone and will erase all your synced data.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setIsDeletingAccount(true);
            try {
              await deleteAccount();
              await wipeDatabase();
              // No need to redirect manually, global guard will catch the signout
              Alert.alert("Account Deleted", "Your account and all associated data have been deleted.");
            } catch (err: any) {
              Alert.alert("Error", err.message || "Failed to delete account. Please try again.");
            } finally {
              setIsDeletingAccount(false);
            }
          },
        },
      ]
    );
  }

  async function handleForceResync() {

    Alert.alert(
      "Force Re-sync",
      "This will clear your local sync markers and pull ALL data from the cloud. Continue?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Sync Now",
          onPress: async () => {
            setIsRecovering(true);
            try {
              const db = await getDatabase();
              await db.runAsync('DELETE FROM sync_metadata WHERE user_id = ?', [user.id]);
              await refresh();
              Alert.alert("Success", "Full re-sync completed successfully! 🔄");
              setRecoveryModalVisible(false);
            } catch (err) {
              Alert.alert("Error", "Re-sync failed. Please try again.");
            } finally {
              setIsRecovering(false);
            }
          }
        }
      ]
    );
  }

  async function handleExportData() {
    try {
      const fileName = `mobibooks_export_${new Date().getTime()}.json`;
      const filePath = `${documentDirectory}${fileName}`;
      await FileSystem.writeAsStringAsync(filePath, JSON.stringify(transactions, null, 2));

      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(filePath);
      } else {
        Alert.alert("Success", `Data exported to your device storage.\nFile: ${fileName}`);
      }
    } catch (err) {
      console.error("Export error:", err);
      Alert.alert("Error", "Failed to export data.");
    }
  }

  async function handleDatabaseRepair() {
    setIsRecovering(true);
    try {
      const db = await getDatabase();
      const result = await db.getFirstAsync('PRAGMA integrity_check') as any;
      if (result['integrity_check'] === 'ok') {
        Alert.alert("Healthy", "Your local database is healthy! ✅");
      } else {
        Alert.alert("Issue Found", "Database integrity issue detected. Please contact support or try a full re-sync.");
      }
    } catch (err) {
      Alert.alert("Error", "Integrity check failed.");
    } finally {
      setIsRecovering(false);
    }
  }

  // Dynamic colors
  const backgroundColor = theme === 'dark' ? '#151718' : '#f5f5f5';
  const cardBackground = theme === 'dark' ? '#1f2937' : '#ffffff';
  const textColor = theme === 'dark' ? '#ECEDEE' : '#333';
  const textSecondary = theme === 'dark' ? '#9BA1A6' : '#666';
  const borderColor = theme === 'dark' ? '#374151' : '#e5e7eb';

  if (!user) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor }]}>
        <Text style={[styles.loadingText, { color: textSecondary }]}>Please log in</Text>
      </View>
    );
  }

  const dynamicStyles = {
    safeArea: { ...styles.safeArea, backgroundColor },
    container: { ...styles.container, backgroundColor },
    header: { ...styles.header },
    settingItem: { ...styles.settingItem, backgroundColor: cardBackground, borderColor },
    infoItem: { ...styles.infoItem, backgroundColor: cardBackground, borderColor },
    sectionTitle: { ...styles.sectionTitle, color: textSecondary },
    settingLabel: { ...styles.settingLabel, color: textColor },
    settingValue: { ...styles.settingValue, color: textSecondary },
    infoLabel: { ...styles.infoLabel, color: textSecondary },
    infoValue: { ...styles.infoValue, color: textColor },
    modalContent: { ...styles.modalContent, backgroundColor: cardBackground },
    modalHeader: { ...styles.modalHeader, borderBottomColor: borderColor },
    modalTitle: { ...styles.modalTitle, color: textColor },
    modalScroll: { ...styles.modalScroll },
    inputContainer: { ...styles.inputContainer, backgroundColor: theme === 'dark' ? '#111827' : '#f9fafb', borderColor },
    input: { ...styles.input, color: textColor },
    dropdown: { ...styles.dropdown, backgroundColor: cardBackground, borderColor },
    dropdownOption: { ...styles.dropdownOption, borderBottomColor: theme === 'dark' ? '#374151' : '#f5f5f5' },
    dropdownOptionText: { ...styles.dropdownOptionText, color: textColor },
    dropdownText: { ...styles.dropdownText, color: textColor },
    dropdownPlaceholder: { ...styles.dropdownPlaceholder, color: textSecondary },
    inputLabel: { ...styles.inputLabel, color: textSecondary },
    modalActions: { ...styles.modalActions, borderTopColor: borderColor },
  };

  return (
    <View style={dynamicStyles.safeArea}>
      <ScrollView style={dynamicStyles.container} showsVerticalScrollIndicator={false}>
        <View style={[dynamicStyles.header, { backgroundColor: cardBackground, paddingTop: Math.max(10, insets.top + 4) }]}>
          <View style={styles.headerDecoration1} />
          <View style={styles.headerDecoration2} />
          <View style={styles.headerContent}>
            <View style={styles.headerLeft}>
              <View style={styles.headerIcon}>
                <SettingsIcon size={22} color="#1e3a8a" />
              </View>
              <View style={styles.headerTextContainer}>
                <Text style={[styles.headerTitle, { color: textColor }]}>Settings</Text>
                <Text style={[styles.headerSubtitle, { color: textSecondary }]}>Manage your account</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.content}>
          <View style={styles.section}>
            <Text style={dynamicStyles.sectionTitle}>Profile</Text>
            <TouchableOpacity
              style={dynamicStyles.settingItem}
              onPress={() => setEditModalVisible(true)}
              activeOpacity={0.7}
            >
              <View style={styles.settingLeft}>
                <View style={styles.settingIcon}>
                  <UserCircle size={20} color="#1e3a8a" />
                </View>
                <View style={styles.settingContent}>
                  <Text style={dynamicStyles.settingLabel}>Edit Profile</Text>
                  <Text style={dynamicStyles.settingValue}>
                    {profile?.full_name || 'Not set'}
                  </Text>
                </View>
              </View>
              <ChevronRight size={20} color="#999" />
            </TouchableOpacity>

            <View style={dynamicStyles.infoItem}>
              <View style={styles.infoLeft}>
                <Mail size={18} color={textSecondary} />
                <Text style={dynamicStyles.infoLabel}>Email</Text>
              </View>
              <Text style={dynamicStyles.infoValue}>{user.email}</Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={dynamicStyles.sectionTitle}>Account</Text>
            <TouchableOpacity
              style={dynamicStyles.settingItem}
              onPress={() => setPasswordModalVisible(true)}
              activeOpacity={0.7}
            >
              <View style={styles.settingLeft}>
                <View style={styles.settingIcon}>
                  <Lock size={20} color="#1e3a8a" />
                </View>
                <Text style={dynamicStyles.settingLabel}>Change Password</Text>
              </View>
              <ChevronRight size={20} color="#999" />
            </TouchableOpacity>
          </View>

          <View style={styles.section}>
            <Text style={dynamicStyles.sectionTitle}>Preferences</Text>
            <View style={dynamicStyles.settingItem}>
              <View style={styles.settingLeft}>
                <View style={styles.settingIcon}>
                  <Bell size={20} color="#1e3a8a" />
                </View>
                <Text style={dynamicStyles.settingLabel}>Notifications</Text>
              </View>
              <Switch
                value={notificationsEnabled}
                onValueChange={setNotificationsEnabled}
                trackColor={{ false: '#e5e7eb', true: '#1e3a8a' }}
                thumbColor="#ffffff"
              />
            </View>

            <View style={dynamicStyles.settingItem}>
              <View style={styles.settingLeft}>
                <View style={styles.settingIcon}>
                  {theme === 'dark' ? <Moon size={20} color="#1e3a8a" /> : <Sun size={20} color="#1e3a8a" />}
                </View>
                <Text style={dynamicStyles.settingLabel}>Dark Mode</Text>
              </View>
              <Switch
                value={theme === 'dark'}
                onValueChange={(isDark) => setThemeMode(isDark ? 'dark' : 'light')}
                disabled={themeMode === 'system'}
                trackColor={{ false: '#e5e7eb', true: '#1e3a8a' }}
                thumbColor="#ffffff"
              />
            </View>

            <View style={dynamicStyles.settingItem}>
              <View style={styles.settingLeft}>
                <View style={styles.settingIcon}>
                  <RefreshCcw size={20} color="#1e3a8a" />
                </View>
                <View style={styles.settingContent}>
                  <Text style={dynamicStyles.settingLabel}>Follow System</Text>
                  <Text style={dynamicStyles.settingValue}>Match your device theme</Text>
                </View>
              </View>
              <Switch
                value={themeMode === 'system'}
                onValueChange={(useSystem) => setThemeMode(useSystem ? 'system' : theme)}
                trackColor={{ false: '#e5e7eb', true: '#1e3a8a' }}
                thumbColor="#ffffff"
              />
            </View>
          </View>

          <View style={styles.section}>
            <Text style={dynamicStyles.sectionTitle}>Backup & Recovery</Text>
            <TouchableOpacity
              style={dynamicStyles.settingItem}
              onPress={() => setRecoveryModalVisible(true)}
              activeOpacity={0.7}
            >
              <View style={styles.settingLeft}>
                <View style={styles.settingIcon}>
                  <ShieldCheck size={20} color="#1e3a8a" />
                </View>
                <View style={styles.settingContent}>
                  <Text style={dynamicStyles.settingLabel}>Data Recovery</Text>
                  <Text style={dynamicStyles.settingValue}>Fix sync or database issues</Text>
                </View>
              </View>
              <ChevronRight size={20} color="#999" />
            </TouchableOpacity>
          </View>

          <View style={styles.section}>
            <Text style={dynamicStyles.sectionTitle}>Legal & About</Text>
            <TouchableOpacity
              style={dynamicStyles.settingItem}
              onPress={() => handleOpenUrl('https://mobibooks.app/terms')}
              activeOpacity={0.7}
            >
              <View style={styles.settingLeft}>
                <View style={styles.settingIcon}>
                  <FileText size={20} color="#1e3a8a" />
                </View>
                <Text style={dynamicStyles.settingLabel}>Terms of Service</Text>
              </View>
              <ExternalLink size={18} color="#999" />
            </TouchableOpacity>

            <TouchableOpacity
              style={dynamicStyles.settingItem}
              onPress={() => handleOpenUrl('https://mobibooks.app/privacy')}
              activeOpacity={0.7}
            >
              <View style={styles.settingLeft}>
                <View style={styles.settingIcon}>
                  <Info size={20} color="#1e3a8a" />
                </View>
                <Text style={dynamicStyles.settingLabel}>Privacy Policy</Text>
              </View>
              <ExternalLink size={18} color="#999" />
            </TouchableOpacity>
          </View>

          <View style={styles.section}>
            <Text style={dynamicStyles.sectionTitle}>Danger Zone</Text>
            <TouchableOpacity
              style={[dynamicStyles.settingItem, styles.dangerItem]}
              onPress={handleLogout}
              activeOpacity={0.7}
            >
              <View style={styles.settingLeft}>
                <View style={[styles.settingIcon, styles.dangerIcon]}>
                  <LogOut size={20} color="#ef4444" />
                </View>
                <Text style={[dynamicStyles.settingLabel, styles.dangerText]}>Logout</Text>
              </View>
              <ChevronRight size={20} color="#ef4444" />
            </TouchableOpacity>

            <TouchableOpacity
              style={[dynamicStyles.settingItem, styles.dangerItem]}
              onPress={handleDeleteAccount}
              activeOpacity={0.7}
              disabled={isDeletingAccount}
            >
              <View style={styles.settingLeft}>
                <View style={[styles.settingIcon, styles.dangerIcon]}>
                  {isDeletingAccount ? (
                    <ActivityIndicator size="small" color="#ef4444" />
                  ) : (
                    <Trash2 size={20} color="#ef4444" />
                  )}
                </View>
                <Text style={[dynamicStyles.settingLabel, styles.dangerText]}>
                  {isDeletingAccount ? 'Deleting...' : 'Delete Account'}
                </Text>
              </View>
            {!isDeletingAccount && <ChevronRight size={20} color="#ef4444" />}
            </TouchableOpacity>
          </View>

          <View style={styles.footer}>
            <Text style={[styles.footerText, { color: textSecondary }]}>MobiBooks Version 1.0.0</Text>
            <Text style={[styles.footerText, { color: textSecondary }]}>Made with ❤️ for Small Businesses</Text>
          </View>
        </View>
      </ScrollView>

      {/* Edit Profile Modal */}
      <Modal visible={editModalVisible} transparent animationType="slide">
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setEditModalVisible(false)} />
          <View style={dynamicStyles.modalContent}>
            <View style={dynamicStyles.modalHeader}>
              <Text style={dynamicStyles.modalTitle}>Edit Profile</Text>
              <TouchableOpacity onPress={() => setEditModalVisible(false)}><Text style={styles.modalCloseText}>Cancel</Text></TouchableOpacity>
            </View>
            <ScrollView style={dynamicStyles.modalScroll}>
              <View style={styles.inputCard}>
                <Text style={dynamicStyles.inputLabel}>Full Name</Text>
                <View style={dynamicStyles.inputContainer}>
                  <User size={20} color={textSecondary} style={styles.inputIcon} />
                  <TextInput style={dynamicStyles.input} value={fullName} onChangeText={setFullName} />
                </View>
              </View>
              <View style={styles.inputCard}>
                <Text style={dynamicStyles.inputLabel}>Phone Number</Text>
                <View style={dynamicStyles.inputContainer}>
                  <Phone size={20} color={textSecondary} style={styles.inputIcon} />
                  <TextInput style={dynamicStyles.input} value={phoneNumber} onChangeText={setPhoneNumber} keyboardType="phone-pad" />
                </View>
              </View>
              <View style={styles.inputCard}>
                <Text style={dynamicStyles.inputLabel}>Business Type</Text>
                <TouchableOpacity style={styles.dropdownButton} onPress={() => setShowBusinessTypeDropdown(!showBusinessTypeDropdown)}>
                  <View style={dynamicStyles.inputContainer}>
                    <Briefcase size={20} color={textSecondary} style={styles.inputIcon} />
                    <Text style={dynamicStyles.dropdownText}>{businessType || 'Select type'}</Text>
                  </View>
                </TouchableOpacity>
                {showBusinessTypeDropdown && (
                  <View style={dynamicStyles.dropdown}>
                    {BUSINESS_TYPES.map(t => (
                      <TouchableOpacity key={t} style={dynamicStyles.dropdownOption} onPress={() => { setBusinessType(t); setShowBusinessTypeDropdown(false); }}>
                        <Text style={dynamicStyles.dropdownOptionText}>{t}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            </ScrollView>
            <View style={dynamicStyles.modalActions}>
              <TouchableOpacity style={[styles.modalButton, styles.saveButton]} onPress={handleSaveProfile} disabled={saving}>
                <Text style={styles.saveButtonText}>{saving ? 'Saving...' : 'Save Changes'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Change Password Modal */}
      <Modal visible={passwordModalVisible} transparent animationType="slide">
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setPasswordModalVisible(false)} />
          <View style={dynamicStyles.modalContent}>
            <View style={dynamicStyles.modalHeader}>
              <Text style={dynamicStyles.modalTitle}>Change Password</Text>
              <TouchableOpacity onPress={() => setPasswordModalVisible(false)}><Text style={styles.modalCloseText}>Cancel</Text></TouchableOpacity>
            </View>
            <ScrollView style={dynamicStyles.modalScroll}>
              <View style={styles.inputCard}>
                <Text style={dynamicStyles.inputLabel}>Current Password</Text>
                <View style={dynamicStyles.inputContainer}>
                  <Lock size={20} color={textSecondary} style={styles.inputIcon} />
                  <TextInput 
                    style={dynamicStyles.input} 
                    value={currentPassword} 
                    onChangeText={setCurrentPassword} 
                    placeholder="Enter current password" 
                    placeholderTextColor={textSecondary}
                    secureTextEntry={!showCurrentPassword} 
                  />
                  <TouchableOpacity onPress={() => setShowCurrentPassword(!showCurrentPassword)} style={styles.eyeButton}>
                    {showCurrentPassword ? <EyeOff size={20} color={textSecondary} /> : <Eye size={20} color={textSecondary} />}
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.inputCard}>
                <Text style={dynamicStyles.inputLabel}>New Password</Text>
                <View style={dynamicStyles.inputContainer}>
                  <Lock size={20} color={textSecondary} style={styles.inputIcon} />
                  <TextInput 
                    style={dynamicStyles.input} 
                    value={newPassword} 
                    onChangeText={setNewPassword} 
                    placeholder="Enter new password" 
                    placeholderTextColor={textSecondary}
                    secureTextEntry={!showNewPassword} 
                  />
                  <TouchableOpacity onPress={() => setShowNewPassword(!showNewPassword)} style={styles.eyeButton}>
                    {showNewPassword ? <EyeOff size={20} color={textSecondary} /> : <Eye size={20} color={textSecondary} />}
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.inputCard}>
                <Text style={dynamicStyles.inputLabel}>Confirm New Password</Text>
                <View style={dynamicStyles.inputContainer}>
                  <Lock size={20} color={textSecondary} style={styles.inputIcon} />
                  <TextInput 
                    style={dynamicStyles.input} 
                    value={confirmPassword} 
                    onChangeText={setConfirmPassword} 
                    placeholder="Confirm new password" 
                    placeholderTextColor={textSecondary}
                    secureTextEntry={!showConfirmPassword} 
                  />
                  <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)} style={styles.eyeButton}>
                    {showConfirmPassword ? <EyeOff size={20} color={textSecondary} /> : <Eye size={20} color={textSecondary} />}
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>
            <View style={dynamicStyles.modalActions}>
              <TouchableOpacity style={[styles.modalButton, styles.saveButton]} onPress={handleChangePassword} disabled={changingPassword}>
                <Text style={styles.saveButtonText}>{changingPassword ? 'Changing...' : 'Change Password'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
      {/* Data Recovery Modal */}
      <Modal visible={recoveryModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => !isRecovering && setRecoveryModalVisible(false)} />
          <View style={dynamicStyles.modalContent}>
            <View style={dynamicStyles.modalHeader}>
              <Text style={dynamicStyles.modalTitle}>Data Recovery</Text>
              <TouchableOpacity onPress={() => setRecoveryModalVisible(false)} disabled={isRecovering}>
                <Text style={styles.modalCloseText}>Close</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={dynamicStyles.modalScroll}>
              <Text style={[styles.recoveryDesc, { color: textSecondary }]}>
                Options to help you recover your data if you encounter issues.
              </Text>

              <TouchableOpacity style={styles.recoveryOption} onPress={handleForceResync} disabled={isRecovering}>
                <View style={[styles.settingIcon, { backgroundColor: 'rgba(30, 58, 138, 0.1)' }]}>
                  <RefreshCcw size={20} color="#1e3a8a" />
                </View>
                <View style={styles.recoveryText}>
                  <Text style={[styles.recoveryTitle, { color: textColor }]}>Force Full Re-sync</Text>
                  <Text style={[styles.recoverySubtitle, { color: textSecondary }]}>Ignores last sync markers and pulls everything from cloud.</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity style={styles.recoveryOption} onPress={handleDatabaseRepair} disabled={isRecovering}>
                <View style={[styles.settingIcon, { backgroundColor: 'rgba(16, 185, 129, 0.1)' }]}>
                  <Database size={20} color="#10b981" />
                </View>
                <View style={styles.recoveryText}>
                  <Text style={[styles.recoveryTitle, { color: textColor }]}>Database Health Check</Text>
                  <Text style={[styles.recoverySubtitle, { color: textSecondary }]}>Checks local database for structural errors.</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity style={styles.recoveryOption} onPress={handleExportData} disabled={isRecovering}>
                <View style={[styles.settingIcon, { backgroundColor: 'rgba(245, 158, 11, 0.1)' }]}>
                  <Download size={20} color="#f59e0b" />
                </View>
                <View style={styles.recoveryText}>
                  <Text style={[styles.recoveryTitle, { color: textColor }]}>Export as JSON</Text>
                  <Text style={[styles.recoverySubtitle, { color: textSecondary }]}>Save a copy of your local data to your phone.</Text>
                </View>
              </TouchableOpacity>

              {isRecovering && (
                <View style={styles.recoveringIndicator}>
                  <ActivityIndicator size="small" color="#1e3a8a" />
                  <Text style={{ color: textSecondary, marginLeft: 10 }}>Processing...</Text>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
      {/* Legal & About Modal */}
      <Modal visible={legalModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setLegalModalVisible(false)} />
          <View style={dynamicStyles.modalContent}>
            <View style={dynamicStyles.modalHeader}>
              <Text style={dynamicStyles.modalTitle}>
                {legalModalType === 'terms' ? 'Terms of Service' : 'Privacy Policy'}
              </Text>
              <TouchableOpacity onPress={() => setLegalModalVisible(false)}>
                <Text style={styles.modalCloseText}>Close</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={dynamicStyles.modalScroll}>
              {legalModalType === 'terms' ? (
                <View style={styles.legalContent}>
                  <Text style={[styles.legalTitle, { color: textColor }]}>1. Acceptance of Terms</Text>
                  <Text style={[styles.legalText, { color: textSecondary }]}>By using MobiBooks, you agree to these terms. MobiBooks is a record-keeping tool for small businesses and independent traders.</Text>
                  
                  <Text style={[styles.legalTitle, { color: textColor }]}>2. User Accounts</Text>
                  <Text style={[styles.legalText, { color: textSecondary }]}>You are responsible for maintaining the confidentiality of your account credentials. MobiBooks is not liable for any loss resulting from unauthorized access to your account.</Text>
                  
                  <Text style={[styles.legalTitle, { color: textColor }]}>3. Data Ownership</Text>
                  <Text style={[styles.legalText, { color: textSecondary }]}>You retain all ownership rights to the data you enter. By using the sync feature, you authorize MobiBooks to store this data on our secure cloud servers.</Text>
                  
                  <Text style={[styles.legalTitle, { color: textColor }]}>4. Limitation of Liability</Text>
                  <Text style={[styles.legalText, { color: textSecondary }]}>MobiBooks is provided "as is" without warranties of any kind. We are not responsible for any financial errors or business losses resulting from the use of the application.</Text>
                </View>
              ) : (
                <View style={styles.legalContent}>
                  <Text style={[styles.legalTitle, { color: textColor }]}>1. Information Collection</Text>
                  <Text style={[styles.legalText, { color: textSecondary }]}>We collect your email address and profile information (name, business type) to provide and improve the MobiBooks service.</Text>
                  
                  <Text style={[styles.legalTitle, { color: textColor }]}>2. Data Storage</Text>
                  <Text style={[styles.legalText, { color: textSecondary }]}>Your business records are stored locally on your device and, if synced, on our secure encrypted cloud database.</Text>
                  
                  <Text style={[styles.legalTitle, { color: textColor }]}>3. Third Parties</Text>
                  <Text style={[styles.legalText, { color: textSecondary }]}>We do not sell your personal data or business records to third parties. Data is only shared with service providers (like Supabase) as necessary to provide the application functionality.</Text>
                  
                  <Text style={[styles.legalTitle, { color: textColor }]}>4. Security</Text>
                  <Text style={[styles.legalText, { color: textSecondary }]}>We use industry-standard security measures to protect your data. However, no method of transmission or storage is 100% secure.</Text>
                </View>
              )}
              <View style={{ height: 40 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 10, fontSize: 16 },
  header: { paddingBottom: 24, paddingHorizontal: 20, borderBottomLeftRadius: 24, borderBottomRightRadius: 24, position: 'relative', overflow: 'hidden' },
  headerDecoration1: { position: 'absolute', top: -50, right: -50, width: 150, height: 150, borderRadius: 75, backgroundColor: 'rgba(30, 58, 138, 0.03)' },
  headerDecoration2: { position: 'absolute', bottom: -30, left: -30, width: 100, height: 100, borderRadius: 50, backgroundColor: 'rgba(30, 58, 138, 0.03)' },
  headerContent: { zIndex: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 16 },
  headerIcon: { width: 48, height: 48, backgroundColor: 'rgba(30, 58, 138, 0.08)', borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  headerTextContainer: { flex: 1 },
  headerTitle: { fontSize: 22, fontWeight: '800', marginBottom: 2 },
  headerSubtitle: { fontSize: 13, fontWeight: '500' },
  content: { padding: 20 },
  section: { marginBottom: 32 },
  sectionTitle: { fontSize: 14, fontWeight: '700', marginBottom: 12, textTransform: 'uppercase' },
  settingItem: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 16, marginBottom: 12, borderWidth: 1 },
  settingLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  settingIcon: { width: 40, height: 40, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  settingContent: { flex: 1 },
  settingLabel: { fontSize: 16, fontWeight: '600' },
  settingValue: { fontSize: 14 },
  infoItem: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 16, marginBottom: 12, borderWidth: 1 },
  infoLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  infoLabel: { fontSize: 16, fontWeight: '500' },
  infoValue: { fontSize: 16, fontWeight: '600' },
  dangerItem: { borderColor: 'rgba(239, 68, 68, 0.2)' },
  dangerIcon: { backgroundColor: 'rgba(239, 68, 68, 0.1)' },
  dangerText: { color: '#ef4444' },
  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  modalContent: { borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '90%' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, borderBottomWidth: 1 },
  modalTitle: { fontSize: 20, fontWeight: '700' },
  modalCloseText: { fontSize: 16, fontWeight: '600', color: '#1e3a8a' },
  modalScroll: { padding: 20 },
  inputCard: { marginBottom: 20 },
  inputLabel: { fontSize: 14, fontWeight: '700', marginBottom: 12 },
  inputContainer: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, borderWidth: 2, paddingHorizontal: 16, minHeight: 56 },
  inputIcon: { marginRight: 12 },
  input: { flex: 1, fontSize: 16, paddingVertical: 12 },
  eyeButton: { padding: 4 },
  eyeButtonText: { fontSize: 14, fontWeight: '600', color: '#1e3a8a' },
  dropdownButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dropdownText: { flex: 1, fontSize: 16 },
  dropdownPlaceholder: { color: '#999' },
  chevron: { marginLeft: 12 },
  chevronRotated: { transform: [{ rotate: '180deg' }] },
  dropdown: { marginTop: 8, borderRadius: 12, borderWidth: 1, overflow: 'hidden' },
  dropdownOption: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1 },
  dropdownOptionText: { fontSize: 16 },
  checkmark: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#1e3a8a', justifyContent: 'center', alignItems: 'center' },
  checkmarkText: { color: '#ffffff', fontSize: 14, fontWeight: '700' },
  modalActions: { padding: 20, borderTopWidth: 1 },
  modalButton: { height: 56, justifyContent: 'center', alignItems: 'center', borderRadius: 12 },
  saveButton: { backgroundColor: '#1e3a8a' },
  saveButtonText: { fontSize: 18, fontWeight: '700', color: '#ffffff' },
  buttonDisabled: { opacity: 0.6 },
  themeToggle: { width: 48, height: 48, borderRadius: 12, backgroundColor: 'rgba(16, 185, 129, 0.1)', justifyContent: 'center', alignItems: 'center' },
  systemIcon: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  recoveryDesc: { fontSize: 14, marginBottom: 20, lineHeight: 20 },
  recoveryOption: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.05)' },
  recoveryText: { flex: 1, marginLeft: 12 },
  recoveryTitle: { fontSize: 16, fontWeight: '700', marginBottom: 2 },
  recoverySubtitle: { fontSize: 12, lineHeight: 16 },
  recoveringIndicator: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 20 },
  footer: { marginTop: 8, marginBottom: 40, alignItems: 'center', gap: 4 },
  footerText: { fontSize: 12, fontWeight: '500', opacity: 0.8 },
  legalContent: { paddingBottom: 20 },
  legalTitle: { fontSize: 18, fontWeight: '700', marginTop: 20, marginBottom: 8 },
  legalText: { fontSize: 15, lineHeight: 22, marginBottom: 16 },
});
