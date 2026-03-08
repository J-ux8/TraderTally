# 📱 MobiBooks - Business Accounting App

A modern, offline-first mobile accounting app built with React Native and Expo.

## ✨ Features

- 💰 Record expenses and sales
- 📊 Track customer debts
- 📈 Generate financial reports
- 🏷️ Custom categories
- 📴 Full offline support
- ☁️ Cloud sync with Supabase
- 🔐 Secure authentication
- ⚡ Lightning fast performance

---

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Set Up Environment
Create a `.env` file with your Supabase credentials:
```
EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 3. Start the App
```bash
npx expo start
```

### 4. Enable Cloud Sync (Optional)
See `QUICK_START.md` for 5-minute setup guide.

---

## 📖 Documentation

### Getting Started
- **[QUICK_START.md](QUICK_START.md)** - Get up and running in 5 minutes
- **[CHECKLIST.md](CHECKLIST.md)** - Complete setup checklist

### Setup Guides
- **[SUPABASE_FINAL_SETUP.md](SUPABASE_FINAL_SETUP.md)** - Complete Supabase setup
- **[HOW_TO_FIX_SYNC.md](HOW_TO_FIX_SYNC.md)** - Visual guide to fix sync errors

### Status & Analysis
- **[FINAL_STATUS.md](FINAL_STATUS.md)** - Current app status
- **[COMPREHENSIVE_APP_ANALYSIS.md](COMPREHENSIVE_APP_ANALYSIS.md)** - Full app analysis

### Technical Details
- **[SYNC_STATUS_INDICATOR.md](SYNC_STATUS_INDICATOR.md)** - Sync indicator implementation
- **[SYNC_NOTIFICATION_COMPLETE.md](SYNC_NOTIFICATION_COMPLETE.md)** - Toast notifications
- **[INSTANT_SAVE_FIX.md](INSTANT_SAVE_FIX.md)** - How instant saves work
- **[PERFORMANCE_OPTIMIZATION.md](PERFORMANCE_OPTIMIZATION.md)** - Performance improvements

---

## 🎯 Current Status

✅ **Production Ready** - App is fully functional and ready to use

### Working Features:
- ✅ All core features (expenses, sales, debts, reports)
- ✅ Offline mode (bulletproof)
- ✅ Fast performance (70-80% faster than before)
- ✅ Sync status indicators
- ✅ Toast notifications

### Optional Setup:
- ⚠️ Cloud sync (requires running one SQL script in Supabase)

---

## 🏗️ Architecture

### Tech Stack:
- **Frontend:** React Native + Expo
- **Routing:** Expo Router
- **Database:** SQLite (local) + Supabase (cloud)
- **Authentication:** Supabase Auth
- **State Management:** React Context
- **Styling:** React Native StyleSheet

### Data Flow:
```
User Action → Local DB (instant) → UI Update → Background Sync → Cloud Backup
```

### Offline-First Strategy:
1. Save locally first (always)
2. Update UI immediately
3. Sync to cloud in background
4. Handle conflicts gracefully
5. Retry failed syncs automatically

---

## 📁 Project Structure

```
├── app/                    # Screens and navigation
│   ├── (tabs)/            # Main app screens
│   ├── Authentication/    # Login/register screens
│   └── _layout.tsx        # Root layout
├── components/            # Reusable components
│   ├── dashboard/         # Dashboard components
│   ├── debts/            # Debt management components
│   └── ui/               # UI components
├── contexts/             # React contexts
├── hooks/                # Custom hooks
├── lib/                  # Core logic
│   ├── offline/          # Offline sync engine
│   └── *.ts             # Business logic
├── database/             # SQLite schema
├── supabase_migrations/  # Supabase SQL scripts
└── assets/              # Images and static files
```

---

## 🔧 Development

### Run on Different Platforms:
```bash
# iOS Simulator
npx expo start --ios

# Android Emulator
npx expo start --android

# Web Browser
npx expo start --web
```

### Clear Cache:
```bash
npx expo start --clear
```

### Build for Production:
```bash
# iOS
eas build --platform ios

# Android
eas build --platform android
```

---

## 🧪 Testing

### Test Offline Mode:
1. Turn off WiFi/data
2. Record expenses
3. Verify no errors
4. Turn WiFi back on
5. Verify sync happens

### Test Sync:
1. Record expense
2. Watch sync indicator
3. Check for toast notification
4. Verify data in Supabase

---

## 🚨 Troubleshooting

### Sync Not Working?
→ See `HOW_TO_FIX_SYNC.md`

### Slow Loading?
→ Clear app cache and restart

### Login Issues?
→ Check email verification

### Missing Data?
→ Verify you're logged in with correct account

---

## 📊 Performance

### Loading Times:
- Home screen: < 1 second
- Records screen: < 1.5 seconds
- Debts screen: < 1 second
- Settings screen: < 0.5 seconds

### Optimizations:
- Data caching (5 min for transactions, 3 min for debts)
- Memoized components
- Efficient list rendering
- Optimized database queries
- Background sync (non-blocking)

---

## 🔐 Security

- Row Level Security (RLS) in Supabase
- Secure session management
- Encrypted local storage
- User data isolation
- No data sharing

---

## 📝 License

This project is private and proprietary.

---

## 🤝 Support

For issues or questions:
1. Check the documentation files
2. Review the troubleshooting guides
3. Check console logs for errors

---

## 🎉 Credits

Built with ❤️ using:
- [Expo](https://expo.dev)
- [React Native](https://reactnative.dev)
- [Supabase](https://supabase.com)
- [SQLite](https://www.sqlite.org)

---

**Version:** 1.0  
**Status:** Production Ready ✅  
**Last Updated:** March 8, 2026
