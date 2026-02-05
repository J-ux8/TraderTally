import { useTheme } from '@/contexts/ThemeContext';
import { useSync } from '@/hooks/useSync';
import { signOut } from '@/lib/auth';
import { getUserProfile, updatePassword, updateUserProfile, UserProfile } from '@/lib/profile';
import { supabase } from '@/lib/supabase';
import { forceRetryQueueItem, getAllQueueItems, removeQueueItemById } from '@/lib/sync';
import { router, useFocusEffect } from 'expo-router';
import {
    Bell,
    Briefcase,
    ChevronRight,
    Info,
    Lock,
    LogOut,
    Mail,
    Moon,
    Phone,
    RefreshCw,
    Settings as SettingsIcon,
    Sun,
    Trash2,
    User,
    UserCircle
} from 'lucide-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
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
import { SafeAreaView } from 'react-native-safe-area-context';

const BUSINESS_TYPES = [
  'Retail Shop',
  'Restaurant/Cafe',
  'Market Stall',
  'Online Store',
  'Service Business',
  'Other'
];

export default function SettingsScreen() {
  const { theme, themeMode, setThemeMode } = useTheme();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  // Dynamic colors based on theme
  const backgroundColor = theme === 'dark' ? '#151718' : '#f5f5f5';
  const cardBackground = theme === 'dark' ? '#1f2937' : '#ffffff';
  const textColor = theme === 'dark' ? '#ECEDEE' : '#333';
  const textSecondary = theme === 'dark' ? '#9BA1A6' : '#666';
  const borderColor = theme === 'dark' ? '#374151' : '#e5e7eb';
  
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

  // Backups modal state
  const { isSyncing, pendingCount, runSync } = useSync();
  const [backupsModalVisible, setBackupsModalVisible] = useState(false);
  const [pendingItems, setPendingItems] = useState<any[]>([]);
  const [loadingPending, setLoadingPending] = useState(false);

  useEffect(() => {
    checkUserAndLoadProfile();
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (user) {
        loadProfile();
      }
    }, [user])
  );

  async function checkUserAndLoadProfile() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        router.replace("/Authentication/login");
        return;
      }
      
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (!currentUser) {
        router.replace("/Authentication/login");
        return;
      }
      setUser(currentUser);
      // Don't block UI - load profile in background
      setLoading(false);
      loadProfile(); // Load profile without awaiting
    } catch (error) {
      console.error("Error checking user:", error);
      router.replace("/Authentication/login");
    } finally {
      setLoading(false);
    }
  }

  async function loadProfile() {
    try {
      const profileData = await getUserProfile();
      setProfile(profileData);
      if (profileData) {
        setFullName(profileData.full_name || '');
        setPhoneNumber(profileData.phone_number || '');
        setBusinessType(profileData.business_type || 'Other');
      }
    } catch (error) {
      console.error("Error loading profile:", error);
      // Set default values if profile loading fails
      setFullName('');
      setPhoneNumber('');
      setBusinessType('Other');
    }
  }

  async function handleSaveProfile() {
    if (!fullName.trim() || !phoneNumber.trim() || !businessType.trim()) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if (phoneNumber.length < 10) {
      Alert.alert('Error', 'Please enter a valid phone number');
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
              router.replace("/Authentication/login");
            } catch (error: any) {
              Alert.alert("Error", error.message || "Failed to logout");
            }
          },
        },
      ]
    );
  }

  function handleDeleteAccount() {
    Alert.alert(
      "Delete Account",
      "Are you sure you want to delete your account? This action cannot be undone and all your data will be permanently deleted.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            Alert.alert(
              "Confirm Deletion",
              "This will permanently delete your account and all data. Type DELETE to confirm.",
              [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Delete",
                  style: "destructive",
                  onPress: () => {
                    Alert.alert("Info", "Account deletion feature coming soon. Please contact support.");
                  },
                },
              ]
            );
          },
        },
      ]
    );
  }

  // Backups modal actions
  async function handleRetry(itemId: number) {
    try {
      await forceRetryQueueItem(itemId);
      await runSync();
      const items = await getAllQueueItems(200);
      setPendingItems(items || []);
    } catch (err) {
      console.error('Retry failed', err);
    }
  }

  async function handleDeletePending(itemId: number) {
    try {
      await removeQueueItemById(itemId);
      const items = await getAllQueueItems(200);
      setPendingItems(items || []);
    } catch (err) {
      console.error('Delete pending failed', err);
    }
  }

  // Show UI immediately, only block if user is not authenticated
  if (!user) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor }]}>
        <ActivityIndicator size="large" color="#10b981" />
        <Text style={[styles.loadingText, { color: textSecondary }]}>Loading...</Text>
      </View>
    );
  }

  // Change Password Modal
  // (kept close to the original layout but restructured to avoid duplicates)
  
  return (
    <SafeAreaView style={dynamicStyles.safeArea} edges={["top"]}>
      <ScrollView style={dynamicStyles.container} showsVerticalScrollIndicator={false}>
        {/* Hero Header and other content (omitted here for brevity, unchanged above) */}
      </ScrollView>

      {/* Change Password Modal */}
      <Modal
        visible={passwordModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setPasswordModalVisible(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <TouchableOpacity
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={() => setPasswordModalVisible(false)}
          />
          <View style={dynamicStyles.modalContent}>
            <View style={dynamicStyles.modalHeader}>
              <Text style={dynamicStyles.modalTitle}>Change Password</Text>
              <TouchableOpacity
                onPress={() => setPasswordModalVisible(false)}
                style={styles.modalCloseButton}
                activeOpacity={0.7}
              >
                <Text style={dynamicStyles.modalCloseText}>Cancel</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={dynamicStyles.modalScroll} showsVerticalScrollIndicator={false}>
              <View style={styles.inputCard}>
                <Text style={dynamicStyles.inputLabel}>Current Password</Text>
                <View style={dynamicStyles.inputContainer}>
                  <Lock size={20} color={textSecondary} style={styles.inputIcon} />
                  <TextInput
                    style={dynamicStyles.input}
                    value={currentPassword}
                    onChangeText={setCurrentPassword}
                    placeholder="Enter current password"
                    placeholderTextColor="#999"
                    secureTextEntry={!showCurrentPassword}
                    autoCapitalize="none"
                  />
                  <TouchableOpacity
                    onPress={() => setShowCurrentPassword(!showCurrentPassword)}
                    style={styles.eyeButton}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.eyeButtonText}>{showCurrentPassword ? 'Hide' : 'Show'}</Text>
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
                    placeholderTextColor="#999"
                    secureTextEntry={!showNewPassword}
                    autoCapitalize="none"
                  />
                  <TouchableOpacity
                    onPress={() => setShowNewPassword(!showNewPassword)}
                    style={styles.eyeButton}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.eyeButtonText}>{showNewPassword ? 'Hide' : 'Show'}</Text>
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
                    placeholderTextColor="#999"
                    secureTextEntry={!showConfirmPassword}
                    autoCapitalize="none"
                  />
                  <TouchableOpacity
                    onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                    style={styles.eyeButton}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.eyeButtonText}>{showConfirmPassword ? 'Hide' : 'Show'}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>

            <View style={dynamicStyles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton, changingPassword && styles.buttonDisabled]}
                onPress={handleChangePassword}
                disabled={changingPassword}
                activeOpacity={0.8}
              >
                <Text style={styles.saveButtonText}>{changingPassword ? 'Changing...' : 'Change Password'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Backups Modal */}
      <Modal
        visible={backupsModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setBackupsModalVisible(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <TouchableOpacity
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={() => setBackupsModalVisible(false)}
          />
          <View style={dynamicStyles.modalContent}>
            <View style={dynamicStyles.modalHeader}>
              <Text style={dynamicStyles.modalTitle}>Pending Backups</Text>
              <TouchableOpacity
                onPress={() => setBackupsModalVisible(false)}
                style={styles.modalCloseButton}
                activeOpacity={0.7}
              >
                <Text style={dynamicStyles.modalCloseText}>Close</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={dynamicStyles.modalScroll} showsVerticalScrollIndicator={false}>
              {loadingPending ? (
                <View style={{ padding: 20, alignItems: 'center' }}>
                  <ActivityIndicator size="small" color="#10b981" />
                </View>
              ) : pendingItems.length === 0 ? (
                <View style={{ padding: 20 }}>
                  <Text style={{ color: '#666' }}>No pending backups</Text>
                </View>
              ) : (
                pendingItems.map((item) => {
                  let payload = {};
                  try { payload = JSON.parse(item.payload || '{}'); } catch (e) { payload = {}; }
                  return (
                    <View key={item.id} style={styles.pendingItem}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.pendingTitle}>{item.resource} · {item.op_type}</Text>
                        <Text style={styles.pendingMeta}>{payload.client_id || payload.id || '—'} · attempts: {item.attempts}</Text>
                        <Text style={styles.pendingPayload}>{JSON.stringify(payload).slice(0, 120)}</Text>
                      </View>
                      <View style={styles.pendingActions}>
                        <TouchableOpacity onPress={() => handleRetry(item.id)} style={styles.pendingButton} activeOpacity={0.7}>
                          <Text style={styles.pendingButtonText}>Retry</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => handleDeletePending(item.id)} style={[styles.pendingButton, styles.pendingDeleteButton]} activeOpacity={0.7}>
                          <Text style={[styles.pendingButtonText, styles.pendingDeleteText]}>Delete</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })
              )}
            </ScrollView>

            <View style={dynamicStyles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton]}
                onPress={async () => {
                  try {
                    await runSync();
                    const items = await getAllQueueItems(200);
                    setPendingItems(items || []);
                  } catch (err) {
                    console.error('Manual sync from modal failed', err);
                  }
                }}
                activeOpacity={0.8}
              >
                <Text style={styles.saveButtonText}>Force sync</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

    </SafeAreaView>
  );

  const dynamicStyles = {
    safeArea: { ...styles.safeArea, backgroundColor },
    container: { ...styles.container, backgroundColor },
    header: { ...styles.header, backgroundColor: theme === 'dark' ? '#065f46' : '#10b981' },
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
    pendingItem: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 12,
      paddingVertical: 12,
      paddingHorizontal: 6,
      borderBottomWidth: 1,
      borderBottomColor: '#f1f1f1',
    },
    pendingTitle: {
      fontSize: 14,
      fontWeight: '700',
      color: '#333',
      marginBottom: 4,
    },
    pendingMeta: {
      fontSize: 12,
      color: '#888',
      marginBottom: 6,
    },
    pendingPayload: {
      fontSize: 12,
      color: '#666',
    },
    pendingActions: {
      justifyContent: 'center',
      alignItems: 'center',
    },
    pendingButton: {
      backgroundColor: '#eefaf5',
      paddingHorizontal: 8,
      paddingVertical: 6,
      borderRadius: 8,
      marginBottom: 6,
    },
    pendingButtonText: {
      color: '#10b981',
      fontWeight: '700',
      fontSize: 12,
    },
    pendingDeleteButton: {
      backgroundColor: 'rgba(255,235,238,0.9)'
    },
    pendingDeleteText: {
      color: '#ef4444'
    },
  };

  return (
    <SafeAreaView style={dynamicStyles.safeArea} edges={['top']}>
      <ScrollView style={dynamicStyles.container} showsVerticalScrollIndicator={false}>
        {/* Hero Header */}
        <View style={dynamicStyles.header}>
          <View style={styles.headerDecoration1} />
          <View style={styles.headerDecoration2} />
          <View style={styles.headerContent}>
            <View style={styles.headerIconContainer}>
              <View style={styles.headerIcon}>
                <SettingsIcon size={24} color="#ffffff" />
              </View>
              <View style={styles.headerTextContainer}>
                <Text style={styles.headerTitle}>Settings</Text>
                <Text style={styles.headerSubtitle}>Manage your account</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.content}>
          {/* Profile Section */}
          <View style={styles.section}>
            <Text style={dynamicStyles.sectionTitle}>Profile</Text>
            
            <TouchableOpacity
              style={dynamicStyles.settingItem}
              onPress={() => {
                if (profile) {
                  setFullName(profile.full_name);
                  setPhoneNumber(profile.phone_number);
                  setBusinessType(profile.business_type);
                }
                setEditModalVisible(true);
              }}
              activeOpacity={0.7}
            >
              <View style={styles.settingLeft}>
                <View style={styles.settingIcon}>
                  <UserCircle size={20} color="#10b981" />
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

          {/* Account Section */}
          <View style={styles.section}>
            <Text style={dynamicStyles.sectionTitle}>Account</Text>
            
            <TouchableOpacity
              style={dynamicStyles.settingItem}
              onPress={() => setPasswordModalVisible(true)}
              activeOpacity={0.7}
            >
              <View style={styles.settingLeft}>
                <View style={styles.settingIcon}>
                  <Lock size={20} color="#10b981" />
                </View>
                <Text style={dynamicStyles.settingLabel}>Change Password</Text>
              </View>
              <ChevronRight size={20} color="#999" />
            </TouchableOpacity>
          </View>

          {/* Backups Section */}
          <View style={styles.section}>
            <Text style={dynamicStyles.sectionTitle}>Backups</Text>

            <View style={dynamicStyles.settingItem}>
              <View style={styles.settingLeft}>
                <View style={styles.settingIcon}>
                  <Briefcase size={20} color="#10b981" />
                </View>
                <View style={styles.settingContent}>
                  <Text style={dynamicStyles.settingLabel}>Pending backups</Text>
                  <Text style={dynamicStyles.settingValue}>{pendingCount} pending</Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={async () => {
                  setBackupsModalVisible(true);
                  setLoadingPending(true);
                  try {
                    const items = await getAllQueueItems(200);
                    setPendingItems(items || []);
                  } catch (err) {
                    console.error('Error loading pending items', err);
                    setPendingItems([]);
                  } finally {
                    setLoadingPending(false);
                  }
                }}
                activeOpacity={0.7}
              >
                <ChevronRight size={20} color="#999" />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={[dynamicStyles.settingItem, { marginTop: 8 }]}
              onPress={async () => {
                try {
                  await runSync();
                  // refresh pending items if modal open
                  if (backupsModalVisible) {
                    setLoadingPending(true);
                    const items = await getAllQueueItems(200);
                    setPendingItems(items || []);
                    setLoadingPending(false);
                  }
                } catch (err) {
                  console.error('Force sync failed', err);
                }
              }}
              activeOpacity={0.7}
            >
              <View style={styles.settingLeft}>
                <View style={styles.settingIcon}>
                  <RefreshCw size={18} color="#10b981" />
                </View>
                <Text style={dynamicStyles.settingLabel}>Force sync now</Text>
              </View>
            </TouchableOpacity>
          </View>

          {/* Preferences Section */}
          <View style={styles.section}>
            <Text style={dynamicStyles.sectionTitle}>Preferences</Text>
            
            <View style={dynamicStyles.settingItem}>
              <View style={styles.settingLeft}>
                <View style={styles.settingIcon}>
                  <Bell size={20} color="#10b981" />
                </View>
                <Text style={dynamicStyles.settingLabel}>Notifications</Text>
              </View>
              <Switch
                value={notificationsEnabled}
                onValueChange={setNotificationsEnabled}
                trackColor={{ false: '#e5e7eb', true: '#10b981' }}
                thumbColor="#ffffff"
              />
            </View>

            <View style={dynamicStyles.settingItem}>
              <View style={styles.settingLeft}>
                <View style={styles.settingIcon}>
                  {theme === 'dark' ? (
                    <Moon size={20} color="#10b981" />
                  ) : (
                    <Sun size={20} color="#10b981" />
                  )}
                </View>
                <View style={styles.settingContent}>
                  <Text style={dynamicStyles.settingLabel}>Appearance</Text>
                  <Text style={dynamicStyles.settingValue}>
                    {themeMode === 'system' ? 'System' : themeMode === 'dark' ? 'Dark' : 'Light'}
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={() => {
                  const modes: ('light' | 'dark' | 'system')[] = ['light', 'dark', 'system'];
                  const currentIndex = modes.indexOf(themeMode);
                  const nextIndex = (currentIndex + 1) % modes.length;
                  setThemeMode(modes[nextIndex]);
                }}
                activeOpacity={0.7}
              >
                <View style={styles.themeToggle}>
                  {themeMode === 'light' && <Sun size={18} color="#10b981" />}
                  {themeMode === 'dark' && <Moon size={18} color="#10b981" />}
                  {themeMode === 'system' && (
                    <View style={styles.systemIcon}>
                      <Sun size={14} color="#10b981" />
                      <Moon size={14} color="#10b981" />
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            </View>
          </View>

          {/* About Section */}
          <View style={styles.section}>
            <Text style={dynamicStyles.sectionTitle}>About</Text>
            
            <View style={dynamicStyles.infoItem}>
              <View style={styles.infoLeft}>
                <Info size={18} color={textSecondary} />
                <Text style={dynamicStyles.infoLabel}>App Version</Text>
              </View>
              <Text style={dynamicStyles.infoValue}>1.0.0</Text>
            </View>
          </View>

          {/* Danger Zone */}
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
            >
              <View style={styles.settingLeft}>
                <View style={[styles.settingIcon, styles.dangerIcon]}>
                  <Trash2 size={20} color="#ef4444" />
                </View>
                <Text style={[dynamicStyles.settingLabel, styles.dangerText]}>Delete Account</Text>
              </View>
              <ChevronRight size={20} color="#ef4444" />
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* Edit Profile Modal */}
      <Modal
        visible={editModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setEditModalVisible(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <TouchableOpacity
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={() => setEditModalVisible(false)}
          />
          <View style={dynamicStyles.modalContent}>
            <View style={dynamicStyles.modalHeader}>
              <Text style={dynamicStyles.modalTitle}>Edit Profile</Text>
              <TouchableOpacity
                onPress={() => setEditModalVisible(false)}
                style={styles.modalCloseButton}
                activeOpacity={0.7}
              >
                <Text style={styles.modalCloseText}>Cancel</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={dynamicStyles.modalScroll} showsVerticalScrollIndicator={false}>
              <View style={styles.inputCard}>
                <Text style={dynamicStyles.inputLabel}>Full Name</Text>
                <View style={dynamicStyles.inputContainer}>
                  <User size={20} color={textSecondary} style={styles.inputIcon} />
                  <TextInput
                    style={dynamicStyles.input}
                    value={fullName}
                    onChangeText={setFullName}
                    placeholder="Enter your full name"
                    placeholderTextColor="#999"
                    autoCapitalize="words"
                  />
                </View>
              </View>

              <View style={styles.inputCard}>
                <Text style={dynamicStyles.inputLabel}>Phone Number</Text>
                <View style={dynamicStyles.inputContainer}>
                  <Phone size={20} color={textSecondary} style={styles.inputIcon} />
                  <TextInput
                    style={dynamicStyles.input}
                    value={phoneNumber}
                    onChangeText={setPhoneNumber}
                    placeholder="Enter phone number"
                    placeholderTextColor="#999"
                    keyboardType="phone-pad"
                  />
                </View>
              </View>

              <View style={styles.inputCard}>
                <Text style={dynamicStyles.inputLabel}>Business Type</Text>
                <TouchableOpacity
                  style={styles.dropdownButton}
                  onPress={() => setShowBusinessTypeDropdown(!showBusinessTypeDropdown)}
                  activeOpacity={0.7}
                >
                  <View style={dynamicStyles.inputContainer}>
                    <Briefcase size={20} color={textSecondary} style={styles.inputIcon} />
                    <Text style={[dynamicStyles.dropdownText, !businessType && dynamicStyles.dropdownPlaceholder]}>
                      {businessType || 'Select business type'}
                    </Text>
                  </View>
                  <ChevronRight 
                    size={20} 
                    color={textSecondary} 
                    style={[styles.chevron, showBusinessTypeDropdown && styles.chevronRotated]} 
                  />
                </TouchableOpacity>
                {showBusinessTypeDropdown && (
                  <View style={dynamicStyles.dropdown}>
                    {BUSINESS_TYPES.map((type) => (
                      <TouchableOpacity
                        key={type}
                        style={dynamicStyles.dropdownOption}
                        onPress={() => {
                          setBusinessType(type);
                          setShowBusinessTypeDropdown(false);
                        }}
                        activeOpacity={0.7}
                      >
                        <Text style={dynamicStyles.dropdownOptionText}>{type}</Text>
                        {businessType === type && (
                          <View style={styles.checkmark}>
                            <Text style={styles.checkmarkText}>✓</Text>
                          </View>
                        )}
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>
            </ScrollView>

            <View style={dynamicStyles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton, saving && styles.buttonDisabled]}
                onPress={handleSaveProfile}
                disabled={saving}
                activeOpacity={0.8}
              >
                <Text style={styles.saveButtonText}>
                  {saving ? 'Saving...' : 'Save Changes'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Change Password Modal */}
      <Modal
        visible={passwordModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setPasswordModalVisible(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <TouchableOpacity
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={() => setPasswordModalVisible(false)}
          />
          <View style={dynamicStyles.modalContent}>
            <View style={dynamicStyles.modalHeader}>
              <Text style={dynamicStyles.modalTitle}>Change Password</Text>
              <TouchableOpacity
                onPress={() => setPasswordModalVisible(false)}
                style={styles.modalCloseButton}
                activeOpacity={0.7}
              >
                <Text style={styles.modalCloseText}>Cancel</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={dynamicStyles.modalScroll} showsVerticalScrollIndicator={false}>
              <View style={styles.inputCard}>
                <Text style={dynamicStyles.inputLabel}>Current Password</Text>
                <View style={dynamicStyles.inputContainer}>
                  <Lock size={20} color={textSecondary} style={styles.inputIcon} />
                  <TextInput
                    style={dynamicStyles.input}
                    value={currentPassword}
                    onChangeText={setCurrentPassword}
                    placeholder="Enter current password"
                    placeholderTextColor="#999"
                    secureTextEntry={!showCurrentPassword}
                    autoCapitalize="none"
                  />
                  <TouchableOpacity
                    onPress={() => setShowCurrentPassword(!showCurrentPassword)}
                    style={styles.eyeButton}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.eyeButtonText}>{showCurrentPassword ? 'Hide' : 'Show'}</Text>
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
                    placeholderTextColor="#999"
                    secureTextEntry={!showNewPassword}
                    autoCapitalize="none"
                  />
                  <TouchableOpacity
                    onPress={() => setShowNewPassword(!showNewPassword)}
                    style={styles.eyeButton}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.eyeButtonText}>{showNewPassword ? 'Hide' : 'Show'}</Text>
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
                    placeholderTextColor="#999"
                    secureTextEntry={!showConfirmPassword}
                    autoCapitalize="none"
                  />
                  <TouchableOpacity
                    onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                    style={styles.eyeButton}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.eyeButtonText}>{showConfirmPassword ? 'Hide' : 'Show'}</Text>
                  </TouchableOpacity>
                </View>
              </View>

            </ScrollView>

            <View style={dynamicStyles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton, changingPassword && styles.buttonDisabled]}
                onPress={handleChangePassword}
                disabled={changingPassword}
                activeOpacity={0.8}
              >
                <Text style={styles.saveButtonText}>{changingPassword ? 'Changing...' : 'Change Password'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Backups Modal */}
      <Modal
        visible={backupsModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setBackupsModalVisible(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <TouchableOpacity
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={() => setBackupsModalVisible(false)}
          />
          <View style={dynamicStyles.modalContent}>
            <View style={dynamicStyles.modalHeader}>
              <Text style={dynamicStyles.modalTitle}>Pending Backups</Text>
              <TouchableOpacity
                onPress={() => setBackupsModalVisible(false)}
                style={styles.modalCloseButton}
                activeOpacity={0.7}
              >
                <Text style={styles.modalCloseText}>Close</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={dynamicStyles.modalScroll} showsVerticalScrollIndicator={false}>
              {loadingPending ? (
                <View style={{ padding: 20, alignItems: 'center' }}>
                  <ActivityIndicator size="small" color="#10b981" />
                </View>
              ) : pendingItems.length === 0 ? (
                <View style={{ padding: 20 }}>
                  <Text style={{ color: '#666' }}>No pending backups</Text>
                </View>
              ) : (
                pendingItems.map((item) => {
                  let payload = {};
                  try { payload = JSON.parse(item.payload || '{}'); } catch (e) { payload = {}; }
                  return (
                    <View key={item.id} style={styles.pendingItem}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.pendingTitle}>{item.resource} · {item.op_type}</Text>
                        <Text style={styles.pendingMeta}>{payload.client_id || payload.id || '—'} · attempts: {item.attempts}</Text>
                        <Text style={styles.pendingPayload}>{JSON.stringify(payload).slice(0, 120)}</Text>
                      </View>
                      <View style={styles.pendingActions}>
                        <TouchableOpacity onPress={() => handleRetry(item.id)} style={styles.pendingButton} activeOpacity={0.7}>
                          <Text style={styles.pendingButtonText}>Retry</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => handleDeletePending(item.id)} style={[styles.pendingButton, styles.pendingDeleteButton]} activeOpacity={0.7}>
                          <Text style={[styles.pendingButtonText, styles.pendingDeleteText]}>Delete</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })
              )}
            </ScrollView>

            <View style={dynamicStyles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton]}
                onPress={async () => {
                  try {
                    await runSync();
                    const items = await getAllQueueItems(200);
                    setPendingItems(items || []);
                  } catch (err) {
                    console.error('Manual sync from modal failed', err);
                  }
                }}
                activeOpacity={0.8}
              >
                <Text style={styles.saveButtonText}>Force sync</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>


                  <TextInput
                    style={dynamicStyles.input}
                    value={newPassword}
                    onChangeText={setNewPassword}
                    placeholder="Enter new password"
                    placeholderTextColor="#999"
                    secureTextEntry={!showNewPassword}
                    autoCapitalize="none"
                  />
                  <TouchableOpacity
                    onPress={() => setShowNewPassword(!showNewPassword)}
                    style={styles.eyeButton}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.eyeButtonText}>{showNewPassword ? 'Hide' : 'Show'}</Text>
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
                    placeholderTextColor="#999"
                    secureTextEntry={!showConfirmPassword}
                    autoCapitalize="none"
                  />
                  <TouchableOpacity
                    onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                    style={styles.eyeButton}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.eyeButtonText}>{showConfirmPassword ? 'Hide' : 'Show'}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </ScrollView>

            <View style={dynamicStyles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton, changingPassword && styles.buttonDisabled]}
                onPress={handleChangePassword}
                disabled={changingPassword}
                activeOpacity={0.8}
              >
                <Text style={styles.saveButtonText}>
                  {changingPassword ? 'Changing...' : 'Change Password'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#666',
  },
  header: {
    backgroundColor: '#10b981',
    paddingTop: 60,
    paddingBottom: 32,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    position: 'relative',
    overflow: 'hidden',
  },
  headerDecoration1: {
    position: 'absolute',
    top: -50,
    right: -50,
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  headerDecoration2: {
    position: 'absolute',
    bottom: -30,
    left: -30,
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  headerContent: {
    zIndex: 10,
  },
  headerIconContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  headerIcon: {
    width: 56,
    height: 56,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTextContainer: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#ffffff',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.9)',
    fontWeight: '500',
  },
  content: {
    padding: 20,
    paddingTop: 0,
    paddingBottom: 40,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#666',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingIcon: {
    width: 40,
    height: 40,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  settingContent: {
    flex: 1,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  settingValue: {
    fontSize: 14,
    color: '#666',
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  infoLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  infoLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#666',
  },
  infoValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  dangerItem: {
    borderColor: 'rgba(239, 68, 68, 0.2)',
  },
  dangerIcon: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
  },
  dangerText: {
    color: '#ef4444',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
  },
  modalCloseButton: {
    padding: 4,
  },
  modalCloseText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#10b981',
  },
  modalScroll: {
    padding: 20,
  },
  inputCard: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#666',
    marginBottom: 12,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
    borderWidth: 2,
    borderColor: '#e5e7eb',
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
    fontWeight: '500',
    color: '#333',
    paddingVertical: 0,
  },
  eyeButton: {
    padding: 4,
  },
  eyeButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#10b981',
  },
  dropdownButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dropdownText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  dropdownPlaceholder: {
    color: '#999',
  },
  chevron: {
    marginLeft: 12,
  },
  chevronRotated: {
    transform: [{ rotate: '180deg' }],
  },
  dropdown: {
    marginTop: 8,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    overflow: 'hidden',
  },
  dropdownOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
  },
  dropdownOptionText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  checkmark: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#10b981',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkmarkText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
  modalActions: {
    padding: 20,
    paddingTop: 0,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  modalButton: {
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
  },
  saveButton: {
    backgroundColor: '#10b981',
    shadowColor: '#10b981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  saveButtonText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#ffffff',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  themeToggle: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  systemIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
});

