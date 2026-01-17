# Quick Reference Guide - RM Volley Dashboard

## Quick Start

### For First-Time Setup

```bash
# 1. Clone repository
git clone [repo-url]
cd rm-volley

# 2. Download initial data
python update_gare.py

# 3. Open dashboard
open index.html
# or
python -m http.server 8000
```

### For Daily Use

```bash
# Update match data
python update_gare.py

# Refresh browser (Ctrl+Shift+R or Cmd+Shift+R)
```

## File Quick Reference

### Essential Files

| File | Purpose | Size | Edit? |
|------|---------|------|-------|
| [config.json](config.json) | Configuration | 2KB | ✅ YES |
| [index.html](index.html) | Main dashboard | 22KB | ⚠️ Rarely |
| [app.js](app.js) | Main logic | 58KB | ⚠️ Rarely |
| [styles.css](styles.css) | All styles | 51KB | ✅ Theme only |
| [Gare.xls](Gare.xls) | Match data | ~16KB | ❌ Auto-generated |
| [classifica.json](classifica.json) | Standings | ~20KB | ❌ Auto-generated |
| [update_gare.py](update_gare.py) | Data fetcher | 14KB | ⚠️ Advanced |

### Feature Files

| Feature | HTML | JS | CSS |
|---------|------|----|----|
| Scout | [scout.html](scout.html) | [scout.js](scout.js) | [scout.css](scout.css) |
| Live Match | [live-match.html](live-match.html) | [live-match.js](live-match.js) | [live-match.css](live-match.css) |
| Player Stats | [player-stats.html](player-stats.html) | [player-stats.js](player-stats.js) | [player-stats.css](player-stats.css) |
| Social | [social.html](social.html) | [social.js](social.js) | - |

### Configuration Files

| File | Purpose |
|------|---------|
| [config.json](config.json) | App configuration |
| [manifest.json](manifest.json) | PWA settings |
| [firebase-config.js](firebase-config.js) | Firebase credentials |
| [requirements.txt](requirements.txt) | Python dependencies |

## Common Tasks

### 1. Update Match Data

```bash
# Automatic (GitHub Actions runs daily at 08:00 UTC)
# Manual:
python update_gare.py
```

**What it does**:
- Downloads latest matches from FIPAV
- Updates `Gare.xls`
- Updates `classifica.json`
- Creates backup in `backups/`

**Troubleshooting**:
```bash
# If dependencies missing:
pip install -r requirements.txt

# If virtual env issues:
rm -rf .venv
python update_gare.py  # Auto-recreates venv

# Check for errors:
python update_gare.py 2>&1 | tee update.log
```

### 2. Add a New Team

**Edit** [config.json](config.json):

```json
{
  "categories": {
    "20": "Under 20 F",  // Add this line
    "18": "Under 18 F",
    // ... existing teams
  }
}
```

**Steps**:
1. Find team number in team name (e.g., "RM VOLLEY #20")
2. Add to `categories` object
3. Run `python update_gare.py`
4. Refresh dashboard

### 3. Add a New League

**Edit** [config.json](config.json):

```json
{
  "leagues": {
    "New League Name": "https://fipav.../classifica.aspx?CId=12345",
    // ... existing leagues
  }
}
```

**Steps**:
1. Find standings URL on FIPAV portal
2. Copy full URL (including CId parameter)
3. Add to `leagues` object
4. Run `python update_gare.py`
5. Standings appear in dashboard

### 4. Change Team Name

**Edit** [config.json](config.json):

```json
{
  "team": {
    "name": "New Team Name",
    "matchPatterns": ["NEW TEAM", "NEWTEAM"]
  }
}
```

**Important**: Update `matchPatterns` to match how team appears in FIPAV data.

### 5. Change Theme Colors

**Edit** [styles.css](styles.css) (top of file):

```css
:root {
  --primary: #0066FF;      /* Change to your color */
  --success: #10B981;      /* Keep or change */
  --warning: #F59E0B;      /* Keep or change */
  --danger: #EF4444;       /* Keep or change */
}
```

**Color Examples**:
- Blue: `#0066FF` (current)
- Red: `#FF0000`
- Green: `#00AA00`
- Purple: `#9333EA`
- Orange: `#FF6B00`

### 6. Add Admin User

**Step 1**: Generate password hash

Open [hash-generator.html](hash-generator.html) in browser:
1. Enter password
2. Click "Generate Hash"
3. Copy the hash

**Step 2**: Edit [config.json](config.json)

```json
{
  "admins": [
    {
      "email": "newuser@example.com",
      "passwordHash": "paste-hash-here",
      "name": "User Name",
      "role": "admin"  // or "socialmediamanager"
    },
    // ... existing admins
  ]
}
```

**Roles**:
- `admin`: Full access (scout, social, etc.)
- `socialmediamanager`: Social media tools only

### 7. Update Firebase Configuration

**Edit** [firebase-config.js](firebase-config.js):

```javascript
export default {
  apiKey: "your-api-key",
  authDomain: "your-app.firebaseapp.com",
  databaseURL: "https://your-app.firebaseio.com",
  projectId: "your-project-id",
  storageBucket: "your-app.appspot.com",
  messagingSenderId: "123456789",
  appId: "your-app-id"
};
```

**Get credentials**: Firebase Console → Project Settings → Your apps

See [FIREBASE_SETUP.md](FIREBASE_SETUP.md) for details.

### 8. Customize Logo/Branding

**Replace files** in `media/` directory:

```
media/
├── rmlogo.png          (Replace with your logo)
├── icon-72x72.png      (App icon - smallest)
├── icon-96x96.png
├── icon-128x128.png
├── icon-144x144.png
├── icon-152x152.png
├── icon-192x192.png
└── icon-512x512.png    (App icon - largest)
```

**Icon Requirements**:
- PNG format
- Square (1:1 ratio)
- Transparent background recommended
- Multiple sizes for different devices

**Update** [manifest.json](manifest.json):

```json
{
  "name": "Your Team Name Dashboard",
  "short_name": "Your Team",
  "description": "Your custom description",
  // ... rest stays same
}
```

### 9. Deploy to GitHub Pages

**Steps**:

1. **Enable in Repository Settings**
   - Go to repository → Settings → Pages
   - Source: Deploy from branch
   - Branch: `main`, folder: `/` (root)
   - Save

2. **Push Changes**
```bash
git add .
git commit -m "Update dashboard"
git push origin main
```

3. **Access**
   - URL: `https://[username].github.io/[repo-name]/`
   - Wait 1-2 minutes for deployment

**Custom Domain** (optional):
- Settings → Pages → Custom domain
- Add CNAME file to repository
- Configure DNS records

### 10. Backup Data

**Manual Backup**:

```bash
# Backup all data
mkdir backup-$(date +%Y%m%d)
cp Gare.xls backup-$(date +%Y%m%d)/
cp classifica.json backup-$(date +%Y%m%d)/
cp config.json backup-$(date +%Y%m%d)/

# Or use existing backups directory
cp Gare.xls backups/Gare-$(date +%Y%m%d).xls
```

**Auto-backup**: GitHub Actions creates backups on each update

**Firebase Backup**:
- Firebase Console → Database → Export JSON
- Save scout sessions, rosters, etc.

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| Tab | Switch between tabs |
| Ctrl/Cmd + F | Search matches |
| Ctrl/Cmd + R | Refresh data |
| Ctrl/Cmd + Shift + R | Hard refresh (clear cache) |
| Esc | Close modals |

## URL Parameters

### Live Match

```
live-match.html?match={encoded-match-data}
```

**Generate**:
```javascript
const matchData = encodeURIComponent(JSON.stringify(match));
const url = `live-match.html?match=${matchData}`;
```

## Data Formats

### Date Format

**FIPAV**: `DD/MM/YYYY` (e.g., "20/01/2026")

**JavaScript**:
```javascript
const date = parseDate("20/01/2026");  // Returns Date object
```

### Time Format

**FIPAV**: `HH:MM` (e.g., "18:30")

### Team Name Format

**Pattern**: `TEAM NAME #NUMBER`

**Examples**:
- "RM VOLLEY #18"
- "RMVOLLEY #2"
- "RM VOLLEY 2DIV"

**Extraction**:
```javascript
const number = teamName.match(/#(\d+)/)[1];  // "18"
```

## Excel File Structure

### Expected Columns

| Column | Type | Example |
|--------|------|---------|
| Gara N | Number | 12345 |
| Data | DD/MM/YYYY | 20/01/2026 |
| Ora | HH:MM | 18:30 |
| Campo | String | Palestra XYZ |
| Squadra Casa | String | RM VOLLEY #18 |
| Squadra Ospite | String | Team ABC |
| Set 1 Casa | Number | 25 |
| Set 1 Ospite | Number | 20 |
| ... | ... | ... |
| Set 5 Ospite | Number | 15 |
| Punti Casa | Number | 3 |
| Punti Ospite | Number | 0 |
| Categoria | String | Under 18 F |

**Note**: Columns may vary by FIPAV region. Script handles missing columns gracefully.

## API Reference

### Config Object

```javascript
{
  team: {
    name: string,              // Team display name
    matchPatterns: string[]    // Search patterns
  },
  categories: {
    [number]: string           // Team # → Category name
  },
  leagues: {
    [leagueName]: string       // League → Standings URL
  },
  dataSources: string[],       // FIPAV export URLs
  output: {
    matchesFile: string,       // Output filename
    standingsFile: string      // Standings filename
  },
  admins: Array<{
    email: string,
    passwordHash: string,
    name: string,
    role: 'admin' | 'socialmediamanager'
  }>,
  sessionTimeout: number,      // Milliseconds (default: 28800000 = 8h)
  playerRoles: string[]        // Valid positions
}
```

### Match Object

```javascript
{
  "Gara N": number,            // Match ID
  "Data": string,              // DD/MM/YYYY
  "Ora": string,               // HH:MM
  "Campo": string,             // Venue
  "Squadra Casa": string,      // Home team
  "Squadra Ospite": string,    // Away team
  "Set 1 Casa": number,        // Home set 1 score
  "Set 1 Ospite": number,      // Away set 1 score
  // ... sets 2-5
  "Punti Casa": number,        // Match points home
  "Punti Ospite": number,      // Match points away
  "Categoria": string,         // Category
  // Enriched fields (added by app):
  status: 'past' | 'today' | 'upcoming',
  result: 'win' | 'loss' | 'draw',
  category: string,            // Mapped category name
  isHome: boolean,             // True if RM Volley is home team
  dateObj: Date,               // Parsed date
  completedSets: number        // Number of completed sets
}
```

### Team Object

```javascript
{
  name: string,                // Category name
  totalMatches: number,        // Total games
  wins: number,
  losses: number,
  draws: number,
  setsWon: number,
  setsLost: number,
  pointsScored: number,        // Total points
  pointsConceded: number,
  winPercentage: number,       // 0-100
  avgPointsScored: number,
  upcomingMatches: Match[],
  recentResults: Match[]       // Last 5
}
```

### Scout Session Object

```javascript
{
  sessionId: string,
  matchId: string,
  matchData: {
    date: string,
    opponent: string,
    category: string,
    venue: string
  },
  players: Array<{
    id: string,
    name: string,
    number: number,
    role: string,
    actions: {
      attack: { success: number, error: number },
      block: { success: number, error: number },
      dig: { success: number, error: number },
      serve: { success: number, error: number },
      receive: { success: number, error: number },
      set: { success: number, error: number }
    }
  }>,
  actionHistory: Array<{
    playerId: string,
    actionType: string,
    result: 'success' | 'error',
    timestamp: number
  }>,
  timestamp: number,
  lastUpdated: number
}
```

## Troubleshooting Quick Fixes

### Issue: Dashboard shows no data

**Check**:
```bash
# File exists?
ls -lh Gare.xls

# File valid?
python -c "import pandas as pd; print(pd.read_excel('Gare.xls').shape)"

# Browser console?
# Open DevTools (F12) → Console tab
```

**Fix**:
```bash
python update_gare.py  # Re-download data
```

### Issue: Teams not appearing

**Check** [config.json](config.json):
```json
{
  "team": {
    "matchPatterns": ["RM VOLLEY", "RMVOLLEY"]  // Add all variations
  }
}
```

**Test** pattern matching:
```javascript
// Browser console
const teamName = "RM VOLLEY #18";
const patterns = ["RM VOLLEY"];
patterns.some(p => teamName.toUpperCase().includes(p));  // Should be true
```

### Issue: Firebase not working

**Check**:
1. `firebase-config.js` exists and has valid credentials
2. Firebase Console → Database → Data tab (should show structure)
3. Firebase Console → Database → Rules (should allow read/write)
4. Browser console for errors (F12)

**Test** connection:
```javascript
// Browser console
firebase.database().ref('.info/connected').once('value', snap => {
  console.log('Connected:', snap.val());
});
```

### Issue: Standings not loading

**Check**:
1. `classifica.json` exists
2. League URLs in `config.json` are accessible
3. FIPAV website structure hasn't changed

**Test** manually:
```bash
# Run standings scraper
python -c "
from update_gare import update_classifica, load_config
load_config()
update_classifica()
"
```

### Issue: Python script fails

**Common causes**:
- Missing dependencies → `pip install -r requirements.txt`
- Network timeout → Retry or check FIPAV website
- Invalid Excel format → Check FIPAV export format

**Debug**:
```bash
# Verbose mode
python update_gare.py 2>&1 | tee debug.log

# Check dependencies
python -c "import requests, pandas, openpyxl; print('OK')"
```

### Issue: Charts not rendering

**Check**:
1. Chart.js CDN loaded (Network tab in DevTools)
2. Canvas elements exist in HTML
3. Browser console for errors

**Fix**:
```javascript
// Clear chart cache
localStorage.clear();
location.reload();
```

### Issue: Mobile app not installing

**Check**:
1. HTTPS enabled (required for PWA)
2. `manifest.json` valid
3. Service worker registered
4. Icons available

**Test**:
```javascript
// Browser console
navigator.serviceWorker.getRegistrations().then(regs => {
  console.log('Service workers:', regs.length);
});
```

## Performance Tips

### Optimize Load Time

```javascript
// Defer non-critical scripts
<script src="chart.js" defer></script>

// Preconnect to CDNs
<link rel="preconnect" href="https://cdn.jsdelivr.net">

// Lazy load images
<img loading="lazy" src="image.png">
```

### Reduce Data Size

```bash
# Compress Excel file
# (FIPAV exports can be large)

# Limit standings history
# Edit config.json to only include active leagues
```

### Cache Optimization

```javascript
// Service worker cache strategy
// Edit sw.js to tune caching behavior

const CACHE_STRATEGY = 'cache-first';  // or 'network-first'
```

## Security Checklist

- [ ] Change default admin passwords
- [ ] Use HTTPS in production
- [ ] Configure Firebase security rules
- [ ] Don't commit secrets to git
- [ ] Keep dependencies updated
- [ ] Validate user input (scout app)
- [ ] Sanitize HTML in chat messages
- [ ] Enable CORS properly
- [ ] Use Content Security Policy (if needed)

## Maintenance Schedule

### Daily
- ✅ Automated: GitHub Actions updates data at 08:00 UTC

### Weekly
- Check GitHub Actions logs for failures
- Review Firebase usage (quota limits)
- Test dashboard on mobile devices

### Monthly
- Update dependencies (`pip install --upgrade -r requirements.txt`)
- Review standings URLs (FIPAV may change CIds)
- Backup Firebase data
- Check browser console for warnings

### Seasonal
- Update team categories for new season
- Archive old match data
- Update logos/branding if needed
- Review and update documentation

## Useful Links

### External Resources
- **FIPAV Piacenza**: https://www.fipavpiacenza.it
- **CRER Portal**: https://crer.portalefipav.net
- **Firebase Console**: https://console.firebase.google.com
- **GitHub Actions**: `https://github.com/[user]/[repo]/actions`

### Documentation
- **SheetJS**: https://docs.sheetjs.com
- **Chart.js**: https://www.chartjs.org/docs
- **Firebase Realtime DB**: https://firebase.google.com/docs/database
- **PWA Guide**: https://web.dev/progressive-web-apps/

### Tools
- **JSON Validator**: https://jsonlint.com
- **Color Picker**: https://htmlcolorcodes.com
- **Icon Generator**: https://realfavicongenerator.net
- **Image Compressor**: https://tinypng.com
- **Markdown Preview**: https://markdownlivepreview.com

## Support

**For help**:
1. Check browser console (F12)
2. Review this documentation
3. Check existing issues on GitHub
4. Create new issue with:
   - Description of problem
   - Steps to reproduce
   - Browser/device info
   - Console errors (screenshot)

---

**Last Updated**: 2026-01-17
**Quick Reference Version**: 1.0

For complete documentation, see:
- [claude.md](.claude/claude.md) - Full project overview
- [development.md](.claude/development.md) - Development guide
- [data-flow.md](.claude/data-flow.md) - Data processing details
- [features.md](.claude/features.md) - Feature documentation
