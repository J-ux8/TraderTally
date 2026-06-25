import { OfflineIndicator } from '@/components/ui/OfflineIndicator';
import { useTransactionsContext } from '@/contexts/TransactionsContext';
import { useDebts } from '@/hooks/useDebts';
import { useThemeColors } from '@/hooks/useThemeColors';
import { Customer, getCustomers } from '@/lib/customers';
import { LocalDB } from '@/database/localDb';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Calendar, MessageSquare, Phone, User, CheckCircle2, ShoppingBag } from 'lucide-react-native';
import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View, Linking, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function CustomerProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const colors = useThemeColors();
  const { debts } = useDebts();
  const { transactions } = useTransactionsContext();
  
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadCustomer() {
      try {
        const all = await getCustomers();
        const found = all.find(c => c.id === id);
        setCustomer(found || null);
      } catch (e) {
        console.error('Error loading customer:', e);
      } finally {
        setLoading(false);
      }
    }
    loadCustomer();
  }, [id]);

  const customerDebts = useMemo(() => 
    debts.filter(d => d.customer_id === id || (d.customer_name === customer?.name && !d.customer_id)), 
  [debts, id, customer]);

  const customerTransactions = useMemo(() => 
    transactions.filter(t => (t as any).customer_id === id),
  [transactions, id]);

  const stats = useMemo(() => {
    const owing = customerDebts.filter(d => !d.is_settled).reduce((sum, d) => sum + d.amount, 0);
    const paid = customerDebts.filter(d => d.is_settled).reduce((sum, d) => sum + d.amount, 0);
    const purchases = customerTransactions.reduce((sum, t) => sum + Math.max(0, t.amount), 0);
    
    return { owing, paid, totalValue: paid + purchases };
  }, [customerDebts, customerTransactions]);

  const timeline = useMemo(() => {
    const items = [
      ...customerDebts.map(d => ({
        id: d.id,
        date: new Date(d.created_at),
        type: 'debt' as const,
        amount: d.amount,
        status: d.is_settled ? 'settled' : 'owing',
        description: d.note || 'Recorded Credit'
      })),
      ...customerTransactions.map(t => ({
        id: t.id,
        date: new Date(t.transaction_date),
        type: 'purchase' as const,
        amount: t.amount,
        status: 'paid',
        description: t.description || 'Quick Sale'
      }))
    ];
    return items.sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [customerDebts, customerTransactions]);

  const formatCurrency = (amt: number) => `K ${amt.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.backgroundColor }]}>
        <ActivityIndicator size="large" color="#1e3a8a" />
      </View>
    );
  }

  if (!customer) {
    return (
      <View style={[styles.errorContainer, { backgroundColor: colors.backgroundColor }]}>
        <Text style={{ color: colors.textColor }}>Customer not found</Text>
        <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace("/(tabs)")} style={styles.backButton}>
          <Text style={{ color: '#fff' }}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.backgroundColor }]} edges={['top']}>
      <View style={[styles.header, { backgroundColor: colors.headerBackground }]}>
        <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace("/(tabs)")} style={styles.headerBack}>
          <ArrowLeft color="#fff" size={24} />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle}>{customer.name}</Text>
          <Text style={styles.headerSubtitle}>{customer.phone || 'No phone number'}</Text>
        </View>
        <OfflineIndicator compact />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Stats Cards */}
        <View style={styles.statsRow}>
          <View style={[styles.statCard, { backgroundColor: colors.cardBackground }]}>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Currently Owing</Text>
            <Text style={[styles.statValue, { color: '#ef4444' }]}>{formatCurrency(stats.owing)}</Text>
          </View>
          <View style={[styles.statCard, { backgroundColor: colors.cardBackground }]}>
            <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Total Paid</Text>
            <Text style={[styles.statValue, { color: '#10b981' }]}>{formatCurrency(stats.paid)}</Text>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionRow}>
          <TouchableOpacity 
            style={[styles.actionBtn, { backgroundColor: '#25D366' }]}
            onPress={async () => {
              if (!customer.phone) return;
              try {
                await Linking.openURL(`whatsapp://send?phone=${customer.phone.replace(/[^0-9]/g, '')}`);
              } catch (e) {
                console.warn('WhatsApp not available:', e);
              }
            }}
            disabled={!customer.phone}
          >
            <MessageSquare color="#fff" size={20} />
            <Text style={styles.actionBtnText}>WhatsApp</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.actionBtn, { backgroundColor: '#1e3a8a' }]}
            onPress={async () => {
              if (!customer.phone) return;
              try {
                await Linking.openURL(`tel:${customer.phone}`);
              } catch (e) {
                console.warn('Phone dial not available:', e);
              }
            }}
            disabled={!customer.phone}
          >
            <Phone color="#fff" size={20} />
            <Text style={styles.actionBtnText}>Call</Text>
          </TouchableOpacity>
        </View>

        {/* Timeline */}
        <Text style={[styles.sectionTitle, { color: colors.textColor }]}>Activity Timeline</Text>
        {timeline.map((item, idx) => (
          <View key={`${item.type}-${item.id}`} style={styles.timelineItem}>
            <View style={styles.timelineIconContainer}>
              <View style={[styles.timelineIcon, { backgroundColor: item.type === 'purchase' ? 'rgba(30, 58, 138, 0.1)' : 'rgba(245, 158, 11, 0.1)' }]}>
                {item.type === 'purchase' ? <ShoppingBag size={16} color="#1e3a8a" /> : <Calendar size={16} color="#f59e0b" />}
              </View>
              {idx !== timeline.length - 1 && <View style={styles.timelineLine} />}
            </View>
            <View style={[styles.timelineContent, { backgroundColor: colors.cardBackground }]}>
              <View style={styles.timelineHeader}>
                <Text style={[styles.timelineDate, { color: colors.textSecondary }]}>
                  {item.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </Text>
                <View style={[styles.tag, { backgroundColor: item.status === 'settled' || item.status === 'paid' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)' }]}>
                   <Text style={[styles.tagText, { color: item.status === 'settled' || item.status === 'paid' ? '#10b981' : '#ef4444' }]}>
                     {item.status.toUpperCase()}
                   </Text>
                </View>
              </View>
              <Text style={[styles.timelineDesc, { color: colors.textColor }]}>{item.description}</Text>
              <Text style={[styles.timelineAmount, { color: item.type === 'purchase' ? '#10b981' : '#f59e0b' }]}>
                {item.type === 'purchase' ? '+' : ''}{formatCurrency(item.amount)}
              </Text>
            </View>
          </View>
        ))}

        {timeline.length === 0 && (
          <View style={styles.emptyTimeline}>
            <Text style={{ color: colors.textSecondary }}>No activity recorded yet</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 20 },
  header: { padding: 20, paddingTop: 40, flexDirection: 'row', alignItems: 'center', borderBottomLeftRadius: 24, borderBottomRightRadius: 24 },
  headerBack: { padding: 8, marginRight: 12, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 12 },
  headerInfo: { flex: 1 },
  headerTitle: { fontSize: 24, fontWeight: '800', color: '#fff' },
  headerSubtitle: { fontSize: 14, color: 'rgba(255,255,255,0.8)' },
  content: { padding: 20, paddingBottom: 40 },
  statsRow: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  statCard: { flex: 1, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(0,0,0,0.05)' },
  statLabel: { fontSize: 12, fontWeight: '600', marginBottom: 4 },
  statValue: { fontSize: 18, fontWeight: '800' },
  actionRow: { flexDirection: 'row', gap: 12, marginBottom: 32 },
  actionBtn: { flex: 1, height: 48, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  actionBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  sectionTitle: { fontSize: 18, fontWeight: '800', marginBottom: 20 },
  timelineItem: { flexDirection: 'row', gap: 16, marginBottom: 20 },
  timelineIconContainer: { alignItems: 'center', width: 32 },
  timelineIcon: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center', zIndex: 1 },
  timelineLine: { width: 2, flex: 1, backgroundColor: 'rgba(0,0,0,0.05)', position: 'absolute', top: 32, bottom: -20 },
  timelineContent: { flex: 1, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(0,0,0,0.05)' },
  timelineHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  timelineDate: { fontSize: 11, fontWeight: '600' },
  tag: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  tagText: { fontSize: 10, fontWeight: '800' },
  timelineDesc: { fontSize: 14, fontWeight: '600', marginBottom: 8 },
  timelineAmount: { fontSize: 16, fontWeight: '800' },
  emptyTimeline: { alignItems: 'center', marginTop: 40 },
  backButton: { backgroundColor: '#1e3a8a', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12 },
});
