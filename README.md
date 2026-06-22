# 📱 TraderTally — Offline-First Point of Sale

An offline-first mobile POS app built with React Native and Expo. Tracks per-product cost and profit, supports split payments (cash + credit), and syncs to Supabase when online.

## ✨ Features

- 💰 **Sales** — Category-first product browsing, add to cart, complete sale with cash/credit/partial payment
- 📊 **Profit tracking** — Per-product cost price set during stock ordering; profit computed per sale as (selling_price − cost_price) × quantity
- 💳 **Three payment paths** — Full cash (transaction only), full credit (debt only), or partial (transaction + debt)
- 🧾 **Expenses** — Record operating costs; all outflows count as expenses
- 📈 **Reports** — Performance overview, category performance, product profitability, credit & debt, business health
- 🏷️ **Categories** — Required for every product, category-first browsing
- 📴 **Offline-first** — Local SQLite is the primary store; UI updates instantly, syncs to cloud in background
- ☁️ **Cloud sync** — Supabase for authentication and cloud backup
- 👥 **Customer debts** — Track receivables, settle against original sale without double-counting profit
- 📁 **Stock orders** — Set both cost price and selling price in one screen, date-pickable

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Set up environment — create .env with:
EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# Start the app
npx expo start
```

## 🏗️ Architecture

### Tech Stack
- **Frontend:** React Native + Expo
- **Routing:** Expo Router (file-based)
- **Database:** SQLite (local) + Supabase (cloud)
- **Authentication:** Supabase Auth
- **State Management:** React Context + custom hooks

### Data Flow
```
User Action → Local SQLite (instant) → UI Update → Background Sync → Supabase
```

### Offline-First Strategy
1. Save to SQLite first (always)
2. Update UI immediately
3. Sync to Supabase in background
4. Conflict resolution: latest `updated_at` wins

## 📁 Project Structure

```
├── app/                    # Screens and navigation (Expo Router)
│   ├── (tabs)/            # Main tab screens (dashboard, records, reports, debts, settings)
│   ├── modals/            # Modal screens (new sale, record sale, orders, expenses, debt)
│   ├── Authentication/    # Login, register, verify email
│   └── _layout.tsx        # Root layout with Stack navigator
├── components/            # Reusable components
│   ├── dashboard/         # SummaryCard, QuickActions, RecentTransactions
│   ├── debts/             # Debt list, settlement sheet
│   ├── transactions/      # TransactionGroupDetail
│   └── ui/                # Collapsible, OfflineIndicator
├── contexts/              # React contexts (Cart, Categories, Theme, Toast, Transactions)
├── context/               # SyncContext, ErrorMonitoringContext
├── hooks/                 # Custom hooks (useSummary, useDebts, useTransactions, etc.)
├── lib/                   # Core business logic (sales, orders, debts, grouping, profit calc)
├── database/              # SQLite schema and migrations
├── sync/                  # Sync engine + NetworkMonitor
├── supabase_migrations/   # SQL migration scripts for Supabase
├── supabase_functions/    # Edge functions (send-otp-email)
└── types/                 # TypeScript type definitions
```

## 🔧 Development

```bash
# Start on different platforms
npx expo start --ios
npx expo start --android

# Clear cache
npx expo start --clear

# Build for production
eas build --platform android
eas build --platform ios
```

## 🧪 Testing

- **Offline:** Turn off WiFi → record sales/expenses → verify no errors → reconnect → verify sync
- **Payment paths:** Test full cash, full credit, and partial cash+credit
- **Profit accuracy:** Verify profit displays correctly in Records and Reports
- **Sync:** Record data, watch sync indicator, verify data in Supabase dashboard

## 🔐 Security

- Row Level Security (RLS) in Supabase
- Secure session management
- User data isolation

---

**Version:** 2.0  
**Last Updated:** June 2026
