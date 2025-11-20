# RM Volley Dashboard - PWA Installation Guide

## 🎉 Your app is now a Progressive Web App!

Users can now install RM Volley Dashboard on their phone's home screen and use it like a native app.

## 📱 How to Install

### iPhone / iPad (Safari)

1. Open the app in **Safari** browser
2. Tap the **Share** button (square with arrow pointing up)
3. Scroll down and tap **"Add to Home Screen"**
4. Edit the name if desired (default: "RM Volley")
5. Tap **"Add"** in the top right corner
6. The app icon will appear on your home screen!

### Android (Chrome)

1. Open the app in **Chrome** browser
2. You should see an **"Install"** prompt at the bottom
   - If not, tap the **⋮** menu button (3 dots)
   - Select **"Add to Home Screen"** or **"Install app"**
3. Tap **"Install"** when prompted
4. The app icon will appear on your home screen!

## ✨ Features

Once installed, the app will:
- ✅ Open in fullscreen mode (no browser UI)
- ✅ Work offline (basic caching enabled)
- ✅ Show on your home screen with the RM Volley logo
- ✅ Launch instantly like a native app
- ✅ Display the blue theme color in the status bar

## 🔧 Technical Details

### Files Added
- `manifest.json` - App configuration
- `sw.js` - Service worker for offline support
- `media/icon-*.png` - App icons in various sizes (72px to 512px)

### PWA Features Enabled
- Web App Manifest
- Service Worker with offline caching
- iOS-specific meta tags
- Multiple icon sizes for different devices
- Favicon support

## 🎨 Customizing Icons

To replace the placeholder icons with your actual RM Volley logo:

1. Create a 512x512px PNG image of your logo
2. Use an online tool like [PWA Asset Generator](https://www.pwabuilder.com/imageGenerator) or run:
   ```bash
   # Using sips (macOS):
   sips -z 192 192 your-logo.png --out media/icon-192x192.png
   sips -z 512 512 your-logo.png --out media/icon-512x512.png
   # ... repeat for other sizes
   ```
3. Replace the files in the `media/` folder

## 🚀 Testing

To test the PWA functionality:

1. **Chrome DevTools**: Open DevTools → Application tab → Manifest / Service Workers
2. **Lighthouse**: Run a PWA audit to check all features
3. **Real Device**: Best way to test is installing on an actual phone

Enjoy your installable dashboard! 🏐
