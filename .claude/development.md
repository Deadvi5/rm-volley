# Development Guide - RM Volley Dashboard

## Development Environment Setup

### Prerequisites
- **Python 3.8+**: For data processing scripts
- **Modern Web Browser**: Chrome, Firefox, Safari, or Edge (latest version)
- **Git**: For version control
- **Text Editor**: VS Code, Sublime, or any modern editor
- **Optional**: Local web server (for development)

### Initial Setup

1. **Clone Repository**
```bash
git clone [repository-url]
cd rm-volley
```

2. **Python Environment**
The [update_gare.py](update_gare.py) script auto-creates a virtual environment, but you can also set up manually:
```bash
python3 -m venv .venv
source .venv/bin/activate  # Mac/Linux
# or
.venv\Scripts\activate  # Windows

pip install -r requirements.txt
```

3. **Firebase Setup (Optional)**
For live features:
- Create Firebase project at https://console.firebase.google.com
- Copy configuration to [firebase-config.js](firebase-config.js)
- See [FIREBASE_SETUP.md](FIREBASE_SETUP.md) for details

4. **Initial Data Load**
```bash
python update_gare.py
```
This creates `Gare.xls` and `classifica.json`.

5. **Open Dashboard**
```bash
# Option 1: Direct file open
open index.html

# Option 2: Local server (recommended)
python -m http.server 8000
# Then visit http://localhost:8000
```

## Project Structure

```
rm-volley/
├── .claude/              # Claude Code documentation
│   ├── claude.md         # Main project documentation
│   ├── development.md    # This file
│   ├── data-flow.md      # Data processing documentation
│   └── features.md       # Feature-specific guides
├── .github/
│   └── workflows/
│       └── update_matches.yml  # Daily automation
├── .git/                 # Git repository
├── backups/              # Old Excel file backups
├── media/                # Images, icons, logos
├── index.html            # Main dashboard
├── app.js                # Main application logic
├── styles.css            # Complete stylesheet
├── utils.js              # Utility functions
├── scout.html/js/css     # Scout application
├── live-match.html/js/css # Live match feature
├── player-stats.html/js/css # Player statistics
├── social.html/js        # Social media tools
├── auth-simple.js        # Authentication
├── firebase-config.js    # Firebase configuration
├── config.json           # Central configuration
├── update_gare.py        # Python data processor
├── Gare.xls              # Match data (generated)
├── classifica.json       # Standings data (generated)
└── *.md                  # Documentation files
```

## Code Architecture

### Frontend Architecture

**Module System**: ES6 modules with imports
- [app.js](app.js): Main orchestrator
- [utils.js](utils.js): Shared utilities
- Feature modules are self-contained (scout, live-match, player-stats)

**State Management**: Global variables in each module
```javascript
// app.js
let allMatches = [];           // All match data
let filteredMatches = [];      // Filtered view
let teamsData = {};            // Team aggregations
let currentTab = 'overview';   // UI state
let chartInstances = {};       // Chart.js instances
let standingsData = {};        // League standings
let config = null;             // Configuration
```

**Data Flow**:
1. Load `config.json`
2. Load `Gare.xls` (Excel file)
3. Parse with SheetJS
4. Process data (`processData()`)
5. Aggregate teams (`aggregateTeamData()`)
6. Render UI (`renderAll()`)
7. Load standings (`loadStandings()`)
8. Setup Firebase listeners (if configured)

### Python Architecture

**[update_gare.py](update_gare.py) Structure**:
```python
# 1. Environment setup
check_and_setup_environment()  # Auto-creates venv

# 2. Configuration
load_config()  # Load config.json

# 3. Download
download_excel(url, filename)  # Fetch from FIPAV

# 4. Merge
merge_excel_files(files, output)  # Combine sources

# 5. Standings
update_classifica()  # Scrape league tables

# 6. Cleanup
cleanup_temp_files()  # Remove temporary files
```

**Error Handling**:
- Graceful fallbacks for missing dependencies
- Retry logic for network requests
- Validation of downloaded data
- Detailed error messages

## Key Components

### Dashboard (index.html + app.js)

**Main Functions**:

```javascript
// Data loading
async function loadExcelFile()
async function loadConfig()
async function loadStandings()

// Data processing
async function processData()
function aggregateTeamData()
function categorizeMatch(match)

// Rendering
function renderAll()
function renderOverview()
function renderTeams()
function renderMatches()
function renderStats()
function renderInsights()

// UI interactions
function switchTab(tabName)
function filterMatches()
function showTeamDetail(teamName)
```

**Performance Optimizations**:
- Debounced search: `utils.js` debounce function (250ms delay)
- Throttled scroll: RAF-based throttle for smooth scrolling
- Chunk processing: `processInChunks()` for large datasets
- Chart caching: Prevents re-render if data unchanged
- Deep equality check: `deepEqual()` for object comparison

### Scout Application

**Purpose**: Track player performance during matches

**Key Features**:
- Match selection from `Gare.xls`
- Player roster management (Firebase)
- Action tracking (attack, block, dig, serve, receive, set)
- Success/error rate calculation
- Session persistence
- Statistics export

**Data Model**:
```javascript
{
  sessionId: "unique-id",
  matchId: "match-identifier",
  matchData: { /* match details */ },
  players: [
    {
      id: "player-id",
      name: "Player Name",
      number: 10,
      role: "Schiacciatrice",
      actions: {
        attack: { success: 5, error: 2 },
        block: { success: 3, error: 1 },
        // ...
      }
    }
  ],
  timestamp: 1234567890
}
```

**Firebase Structure**:
```
scout-sessions/
  └── {sessionId}/
      ├── matchId
      ├── matchData
      ├── players
      └── timestamp

team-roster/
  └── {teamName}/
      └── {playerId}/
          ├── name
          ├── number
          └── role
```

### Live Match Feature

**Purpose**: Real-time match experience with chat and scoring

**Key Features**:
- Live set scores (Firebase sync)
- Team chat for fans
- Message expiry (4 hours auto-delete)
- Username-based participation
- Match status indicators

**Firebase Structure**:
```
live-matches/
  └── {matchKey}/
      ├── scores/
      │   ├── set1_home
      │   ├── set1_away
      │   ├── set2_home
      │   └── ...
      └── messages/
          └── {messageId}/
              ├── username
              ├── message
              ├── timestamp
              └── type (user/system)
```

**Chat Features**:
- Real-time message sync
- Auto-scroll to latest
- System messages (match events)
- Username persistence (localStorage)
- Message cleanup (old messages deleted)

### Player Statistics

**Purpose**: Aggregated view of player performance across sessions

**Data Source**: Scout sessions from Firebase

**Calculations**:
- Success rate: `(success / (success + error)) * 100`
- Total actions: Sum of all action types
- Best skill: Highest success rate
- Games played: Unique session count

**Filters**:
- Search by name
- Filter by team
- Filter by position

## Styling System

### CSS Architecture

**[styles.css](styles.css)** (51KB) is organized as:

```css
/* 1. CSS Variables (Design Tokens) */
:root {
  /* Colors */
  --primary: #0066FF;
  --success: #10B981;
  --warning: #F59E0B;
  --danger: #EF4444;

  /* Spacing */
  --space-1: 0.25rem;
  --space-2: 0.5rem;
  --space-4: 1rem;

  /* Typography */
  --font-sans: system-ui, -apple-system, ...;

  /* Shadows */
  --shadow-sm: 0 1px 2px rgba(0,0,0,0.05);

  /* Animations */
  --transition-base: 250ms cubic-bezier(...);
}

/* 2. Reset & Base Styles */
/* 3. Layout Components */
/* 4. UI Components */
/* 5. Tab System */
/* 6. Cards & Containers */
/* 7. Charts & Visualizations */
/* 8. Responsive (Media Queries) */
/* 9. Animations */
/* 10. Utilities */
```

**Design System**:
- **Mobile-first**: Base styles for mobile, desktop in media queries
- **Responsive breakpoints**: 640px, 768px, 1024px
- **Component-based**: Each component is self-contained
- **Utility classes**: Common patterns (`.empty-state`, `.badge`, etc.)

**Theme Customization**:
Edit CSS variables in `:root` to change the entire theme:
```css
:root {
  --primary: #FF6B00;  /* Change primary color */
  --font-sans: 'Roboto', sans-serif;  /* Change font */
}
```

## Data Processing

### Excel File Format

**Expected Columns** (from FIPAV export):
- `Gara N`: Match ID/number
- `Data`: Date (DD/MM/YYYY)
- `Ora`: Time (HH:MM)
- `Campo`: Court/venue
- `Squadra Casa`: Home team
- `Squadra Ospite`: Away team
- `Set 1 Casa`: Set 1 home score
- `Set 1 Ospite`: Set 1 away score
- ... (up to Set 5)
- `Punti Casa`: Match points home
- `Punti Ospite`: Match points away
- `Categoria`: Category/division

**Processing Steps**:
1. **Parse**: SheetJS converts Excel to JSON array
2. **Filter**: Only RM Volley matches (pattern matching)
3. **Categorize**: Map to team categories (Under 18, etc.)
4. **Enrich**: Calculate match status (past, today, upcoming)
5. **Aggregate**: Team statistics (wins, losses, points)

### Team Identification

**Pattern Matching**:
```javascript
function isOurTeam(teamName) {
  const patterns = config.team.matchPatterns;
  const upper = teamName.toUpperCase();
  return patterns.some(pattern => upper.includes(pattern));
}
```

**Category Extraction**:
```javascript
function extractCategory(teamName) {
  const match = teamName.match(/#(\d+)/);  // Extract #2, #18, etc.
  if (match) {
    return config.categories[match[1]] || 'Sconosciuto';
  }
  return 'Sconosciuto';
}
```

### Standings Processing

**Scraping Logic** ([update_gare.py](update_gare.py:261-313)):
```python
def update_classifica():
    for league_name, url in leagues.items():
        # Use pandas to parse HTML tables
        dfs = pd.read_html(url)

        # Find table with 'squadra' and 'punti' columns
        for df in dfs:
            cols = [str(c).lower() for c in df.columns]
            if 'squadra' in cols and 'punti' in cols:
                classifica_df = df
                break

        # Convert to JSON
        records = classifica_df.to_dict('records')
        all_standings[league_name] = records

    # Save to classifica.json
    with open('classifica.json', 'w') as f:
        json.dump(all_standings, f, indent=2)
```

## Authentication System

### Simple Hash-Based Auth

**Storage**: [config.json](config.json) `admins` array
```json
{
  "email": "user@example.com",
  "passwordHash": "sha256-hash",
  "name": "Display Name",
  "role": "admin"  // or "socialmediamanager"
}
```

**Login Flow** ([auth-simple.js](auth-simple.js)):
1. User enters email/password
2. Hash password with SHA-256
3. Find user in config with matching email
4. Compare hashes
5. If match, create session (localStorage)
6. Set session expiry (8 hours default)
7. Redirect to app

**Session Management**:
```javascript
// Store session
localStorage.setItem('user_session', JSON.stringify({
  email: user.email,
  name: user.name,
  role: user.role,
  loginTime: Date.now(),
  expiresAt: Date.now() + sessionTimeout
}));

// Check session
function getCurrentUser() {
  const session = JSON.parse(localStorage.getItem('user_session'));
  if (!session) return null;
  if (Date.now() > session.expiresAt) {
    localStorage.removeItem('user_session');
    return null;
  }
  return session;
}
```

**Security Notes**:
- ⚠️ Client-side only - NOT production-grade
- Hashes visible in source code
- No rate limiting
- No password recovery
- Suitable for low-stakes admin tools
- For production, use proper backend auth

### Generating Password Hashes

Use [hash-generator.html](hash-generator.html):
1. Open in browser
2. Enter password
3. Click "Generate Hash"
4. Copy SHA-256 hash
5. Add to `config.json`

Or via command line:
```bash
echo -n "your-password" | sha256sum
```

## Firebase Integration

### Configuration

**[firebase-config.js](firebase-config.js)**:
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

### Features Using Firebase

1. **Live Match Scores**: Real-time score updates
2. **Live Match Chat**: Fan messaging
3. **Scout Sessions**: Player action tracking
4. **Team Rosters**: Player databases
5. **Player Statistics**: Aggregated stats

### Firebase Structure

```
firebase-database/
├── live-matches/
│   └── {matchKey}/
│       ├── scores/
│       └── messages/
├── scout-sessions/
│   └── {sessionId}/
├── team-roster/
│   └── {teamName}/
└── player-statistics/
    └── {playerId}/
```

### Security Rules

See [FIREBASE_RULES.md](FIREBASE_RULES.md) for complete rules.

**Key Points**:
- Public read for live matches
- Authenticated write for scores
- Rate limiting on chat messages
- Data validation rules

## Testing

### Manual Testing Checklist

**Dashboard**:
- [ ] Loads without errors
- [ ] All tabs accessible
- [ ] Filters work (team, status, date)
- [ ] Search is responsive
- [ ] Charts render correctly
- [ ] Team modals open
- [ ] Standings display
- [ ] Mobile responsive
- [ ] Pull-to-refresh works

**Scout App**:
- [ ] Login required
- [ ] Match selection works
- [ ] Roster management
- [ ] Action tracking
- [ ] Statistics accurate
- [ ] Session saves to Firebase
- [ ] Export functionality

**Live Match**:
- [ ] Chat messages sync
- [ ] Scores update in real-time
- [ ] Username persistence
- [ ] Old messages cleanup
- [ ] System messages appear

**Player Stats**:
- [ ] Data loads from Firebase
- [ ] Filters work
- [ ] Search responsive
- [ ] Statistics accurate
- [ ] Export works

### Browser Testing

Test in:
- Chrome (desktop + mobile)
- Firefox (desktop + mobile)
- Safari (desktop + iOS)
- Edge (desktop)

### Performance Testing

**Metrics to Monitor**:
- Initial load time (<2s)
- Time to interactive (<3s)
- Search response (<100ms)
- Chart render time (<500ms)
- Scroll smoothness (60fps)

**Tools**:
- Chrome DevTools (Performance tab)
- Lighthouse (PWA audit)
- Network throttling (3G simulation)

## Debugging

### Common Issues

**"Config not found"**:
- Check `config.json` exists
- Verify JSON is valid
- Check browser console for parsing errors

**"Teams not appearing"**:
- Verify `matchPatterns` in config
- Check team name format in Excel
- Ensure category mapping exists
- Check browser console for filter logic

**"Charts not rendering"**:
- Check Chart.js loaded (CDN)
- Verify data format
- Check console for errors
- Clear browser cache

**"Firebase not working"**:
- Check `firebase-config.js` exists
- Verify credentials are correct
- Check Firebase console for errors
- Ensure Firebase rules allow access

### Debug Mode

Add to `app.js` for verbose logging:
```javascript
const DEBUG = true;

function log(...args) {
  if (DEBUG) console.log(...args);
}
```

### Browser Console

Key commands:
```javascript
// Check config
console.log(config);

// Check loaded matches
console.log(allMatches);

// Check team data
console.log(teamsData);

// Check Firebase connection
firebase.database().ref('.info/connected').on('value', snap => {
  console.log('Connected:', snap.val());
});
```

## Building for Production

### Pre-deployment Checklist

- [ ] Update `config.json` with production values
- [ ] Test all features work
- [ ] Run Lighthouse audit (aim for 90+ scores)
- [ ] Verify service worker caching
- [ ] Test PWA installation
- [ ] Check Firebase security rules
- [ ] Verify automated data updates work
- [ ] Test on multiple devices/browsers
- [ ] Ensure proper error handling
- [ ] Remove debug code

### Optimization Steps

1. **Minimize console.log**: Remove debug statements
2. **Optimize images**: Compress icons/logos
3. **CDN URLs**: Ensure using latest stable versions
4. **Service Worker**: Test offline functionality
5. **Caching**: Verify proper cache headers

### Deployment

**GitHub Pages**:
```bash
# Enable in repository settings
# All files served from root or /docs
```

**Netlify**:
```bash
# Connect repository
# No build command needed
# Publish directory: /
```

**Traditional Hosting**:
```bash
# Upload all files via FTP/SFTP
# Ensure HTTPS enabled
# Set proper MIME types for .json, .js
```

## Contributing Guidelines

### Code Style

**JavaScript**:
- ES6+ features
- 4-space indentation
- Semicolons required
- Single quotes for strings
- Descriptive variable names
- Comments for complex logic

**Python**:
- PEP 8 style guide
- 4-space indentation
- Docstrings for functions
- Type hints where helpful

**CSS**:
- 2-space indentation
- BEM-like naming
- Group related properties
- Comment sections

### Git Workflow

```bash
# Feature development
git checkout -b feature/new-feature
# Make changes
git add .
git commit -m "Add new feature"
git push origin feature/new-feature
# Create pull request

# Bug fix
git checkout -b fix/bug-description
# Fix bug
git commit -m "Fix: description"
```

### Commit Messages

Format: `Type: Short description`

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation
- `style`: Code style (formatting)
- `refactor`: Code restructuring
- `perf`: Performance improvement
- `test`: Testing
- `chore`: Maintenance

Examples:
- `feat: Add player comparison feature`
- `fix: Correct win percentage calculation`
- `docs: Update Firebase setup guide`

## Advanced Topics

### Custom Data Processing

To add custom match processing:

```javascript
// app.js
async function processData() {
  await processInChunks(allMatches, (match) => {
    // Your custom logic here
    match.customField = calculateCustomMetric(match);
  });
}
```

### Adding New Chart

```javascript
function renderCustomChart() {
  const ctx = document.getElementById('customChart').getContext('2d');

  const chart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: [...],
      datasets: [{
        label: 'Custom Metric',
        data: [...],
        backgroundColor: 'rgba(0, 102, 255, 0.5)'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false
    }
  });

  chartInstances.customChart = chart;
}
```

### Extending Scout Features

Add new action type:

1. Update `config.json`:
```json
{
  "scoutActions": ["attack", "block", "customAction"]
}
```

2. Update UI in `scout.html`
3. Update tracking logic in `scout.js`
4. Update statistics calculations

### Custom Filters

```javascript
function addCustomFilter(filterFn) {
  filteredMatches = allMatches.filter(filterFn);
  renderMatches();
}

// Usage
addCustomFilter(match => match.customField > 10);
```

## Resources

### External Documentation
- **SheetJS**: https://docs.sheetjs.com
- **Chart.js**: https://www.chartjs.org/docs
- **Firebase**: https://firebase.google.com/docs
- **PWA**: https://web.dev/progressive-web-apps/

### FIPAV Resources
- **FIPAV Portal**: https://www.federvolley.it
- **Regional Committees**: https://crer.portalefipav.net
- **Provincial Committees**: https://www.fipavpiacenza.it

### Tools
- **JSON Validator**: https://jsonlint.com
- **Image Compressor**: https://tinypng.com
- **PWA Tester**: https://www.pwabuilder.com

---

**Need Help?**
- Check browser console for errors
- Review documentation files
- Test in incognito mode (clean state)
- Check GitHub issues (if repository public)
