# Firebase Security Rules - Updated

## Connection Limit (100 Users)

Update your Firebase Realtime Database rules to:

```json
{
  "rules": {
    ".read": "auth == null",
    ".write": "auth == null",
    "live-matches": {
      "$matchId": {
        ".read": true,
        ".write": true,
        ".validate": "root.child('.info/connected').val() === true"
      }
    },
    ".info": {
      "connected": {
        ".read": true
      }
    }
  }
}
```

> **Note:** Firebase free tier automatically handles 100 simultaneous connections. Connection limiting is handled at the Firebase level, not in the rules. The free tier will reject connections over 100.

## Current Rules (Recommended)

### Simple & Open (Currently Using)
```json
{
  "rules": {
    "live-matches": {
      "$matchId": {
        ".read": true,
        ".write": true
      }
    }
  }
}
```

This is perfectly fine for your use case! Firebase will handle the 100-connection limit automatically on the free tier.

## Monitoring Connections

You can monitor active connections in Firebase Console:
1. Go to **Realtime Database**
2. Click **Usage** tab
3. See "Simultaneous connections" graph

The free tier includes:
- ✅ **100 simultaneous connections**
- ✅ 1 GB stored data
- ✅ 10 GB/month downloaded

Your volleyball app will stay well within these limits! 🏐
