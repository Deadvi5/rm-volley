# Firebase Setup Guide for RM Volley Live Match

## Quick Setup (5 minutes)

### Step 1: Create Firebase Project

1. Go to https://console.firebase.google.com/
2. Click **"Add project"**
3. Name it: `rm-volley` (or any name you prefer)
4. Disable Google Analytics (not needed)
5. Click **"Create project"**

### Step 2: Create Realtime Database

1. In your Firebase project, click **"Realtime Database"** in the left menu
2. Click **"Create Database"**
3. Choose location: **Europe (or closest to you)**
4. Start in **"Test mode"** (we'll secure it later)
5. Click **"Enable"**

### Step 3: Get Configuration

1. Click the **⚙️ Settings icon** → **"Project settings"**
2. Scroll down to **"Your apps"**
3. Click the **"< />"** (Web) icon
4. App nickname: `RM Volley Web`
5. Click **"Register app"**
6. Copy the `firebaseConfig` object

### Step 4: Add Config to Your App

1. Open `firebase-config.js` in your project
2. Replace the placeholder values with your config:

```javascript
const firebaseConfig = {
    apiKey: "AIzaSyC...",  // ← Paste your values here
    authDomain: "rm-volley.firebaseapp.com",
    databaseURL: "https://rm-volley-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "rm-volley",
    storageBucket: "rm-volley.appspot.com",
    messagingSenderId: "123456789",
    appId: "1:123456789:web:abc123"
};
```

3. Save the file

### Step 5: Set Security Rules (Important!)

1. Go back to **Realtime Database** in Firebase Console
2. Click **"Rules"** tab
3. Replace with these rules:

```json
{
  "rules": {
    "live-matches": {
      "$matchId": {
        ".read": true,
        ".write": true,
        "messages": {
          "$messageId": {
            ".validate": "newData.hasChildren(['username', 'text', 'timestamp', 'expiresAt'])"
          }
        },
        "scores": {
          ".validate": "newData.hasChildren(['home', 'away', 'lastUpdate'])"
        }
      }
    }
  }
}
```

4. Click **"Publish"**

### Step 6: Test It!

1. Push your code to GitHub Pages
2. Open two browser windows (or use mobile + desktop)
3. Navigate to a live match
4. Send a message in one window
5. See it appear in the other window instantly! 🎉

## Database Structure

Your Firebase database will look like this:

```
/live-matches/
  /RM_Volley_vs_Milano_25-11-2025/
    /scores/
      home: 2
      away: 1
      lastUpdate: 1732547856432
    /messages/
      /-O1AbC123xyz/
        username: "Mario"
        text: "Forza RM!"
        timestamp: 1732547856432
        expiresAt: 1732562256432
      /-O1AbC456def/
        username: "Luigi"
        text: "Grande partita!"
        timestamp: 1732547890123
        expiresAt: 1732562290123
```

## Features

✅ **Real-time sync** - Messages and scores update instantly across all devices
✅ **Auto-cleanup** - Messages automatically deleted after 4 hours
✅ **Shared state** - All users see the same data
✅ **Works on GitHub Pages** - No backend server needed
✅ **Free tier** - Firebase free plan is more than enough

## Troubleshooting

**"Firebase not configured" error:**
- Make sure you added your config to `firebase-config.js`
- Check that all config values are correct (no placeholders)

**Messages not syncing:**
- Check Firebase Console → Realtime Database → Data tab
- Verify rules allow read/write
- Check browser console for errors

**"Permission denied" error:**
- Update database rules as shown in Step 5
- Make sure rules are published

## Cost

Firebase Realtime Database free tier includes:
- 1 GB stored data
- 10 GB/month downloaded data
- 100 simultaneous connections

This is more than enough for your volleyball dashboard! 🏐

## Next Steps

Once Firebase is working:
1. Add a live match to `Gare.xls` with today's date and current time
2. Open the dashboard
3. Click on the live match
4. Start chatting and updating scores!
