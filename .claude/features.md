# Features Guide - RM Volley Dashboard

## Feature Overview

The RM Volley Dashboard consists of 5 main applications:

1. **Main Dashboard** - Match tracking, statistics, and standings
2. **Scout Application** - Player performance tracking
3. **Live Match** - Real-time scores and fan chat
4. **Player Statistics** - Aggregated player analytics
5. **Social Media Tools** - Graphics generation for social posts

## 1. Main Dashboard

**Files**: [index.html](index.html), [app.js](app.js), [styles.css](styles.css)

### Features

#### Tab System

**Overview Tab**:
- Key metrics cards (total matches, win rate, next match, upcoming)
- Recent results carousel
- Upcoming matches this week
- Quick stats visualization

**Teams Tab**:
- Team cards for each category
- Win-loss records
- Set statistics
- Recent form (W/L indicators)
- League position (from standings)
- Team detail modals

**Matches Tab**:
- Full match list (all teams)
- Advanced filters:
  - Team category (dropdown)
  - Match status (past/today/upcoming)
  - Date range
- Search by opponent name
- Match cards with:
  - Date, time, venue
  - Teams
  - Scores (if played)
  - Result badge (win/loss)
  - Live indicator

**Stats Tab**:
- Win/Loss chart (by team)
- Set statistics chart
- Performance trends over time
- Category comparison
- Interactive Chart.js visualizations

**Insights Tab**:
- Advanced analytics
- Trend analysis
- Performance predictions (if implemented)
- Comparative statistics

### Key Components

#### Header Statistics

Location: [app.js](app.js) `renderOverview()`

```javascript
{
  totalMatches: 45,           // All matches count
  overallWinRate: 68.5,       // Win percentage across all teams
  nextMatch: {                // Nearest upcoming match
    opponent: "Team ABC",
    date: "20/01/2026",
    category: "Under 18 F"
  },
  upcomingThisWeek: 3         // Matches in next 7 days
}
```

#### Team Cards

Location: [app.js](app.js) `renderTeams()`

Each card displays:
- Team category name
- Win-loss-draw record
- Win percentage
- Sets won-lost ratio
- Recent form (5 matches: WWLWW)
- League position (if available)
- "View Details" button

**Team Detail Modal**:
Opens on card click, shows:
- Complete match history
- Detailed statistics
- League standings table
- Performance charts
- Export options

#### Match Filters

Location: [app.js](app.js) `filterMatches()`

**Filter Logic**:
```javascript
filteredMatches = allMatches.filter(match => {
  // Category filter
  if (selectedCategory && match.category !== selectedCategory) {
    return false;
  }

  // Status filter
  if (selectedStatus && match.status !== selectedStatus) {
    return false;
  }

  // Search filter (opponent name)
  if (searchQuery) {
    const opponent = getOpponent(match).toLowerCase();
    if (!opponent.includes(searchQuery.toLowerCase())) {
      return false;
    }
  }

  // Date range filter
  if (dateFrom && match.dateObj < dateFrom) {
    return false;
  }
  if (dateTo && match.dateObj > dateTo) {
    return false;
  }

  return true;
});
```

#### Charts

Location: [app.js](app.js) `renderStats()`

**Win/Loss Chart**:
- Type: Horizontal bar chart
- Data: Wins and losses per team
- Colors: Green (wins), red (losses)

**Set Statistics Chart**:
- Type: Grouped bar chart
- Data: Sets won/lost per team
- Comparison view

**Performance Trends**:
- Type: Line chart
- Data: Win rate over time
- Smoothed curve

**Category Comparison**:
- Type: Radar chart
- Data: Multiple metrics per category
- Overlaid comparison

### Pull-to-Refresh

**Mobile Feature**: Swipe down to reload data

Location: [app.js](app.js) `setupPullToRefresh()`

```javascript
let startY = 0;
let currentY = 0;
let pulling = false;

document.addEventListener('touchstart', (e) => {
  if (window.scrollY === 0) {
    startY = e.touches[0].pageY;
    pulling = true;
  }
});

document.addEventListener('touchmove', (e) => {
  if (!pulling) return;
  currentY = e.touches[0].pageY;
  const distance = currentY - startY;

  if (distance > 80) {
    showPullIndicator();
  }
});

document.addEventListener('touchend', () => {
  if (pulling && (currentY - startY) > 80) {
    location.reload(); // Refresh page
  }
  hidePullIndicator();
  pulling = false;
});
```

### League Standings Integration

Location: [app.js](app.js) `loadStandings()`

**Data Source**: [classifica.json](classifica.json)

**Display Locations**:
- Team cards (position badge)
- Team detail modal (full table)
- Separate standings view (if implemented)

**Matching Logic**:
```javascript
function getTeamStanding(teamName) {
  // Find league for this team
  const league = findLeagueForTeam(teamName);
  if (!league) return null;

  // Find team in standings
  const standings = standingsData[league];
  return standings.find(row => {
    return row.Squadra.includes(teamName);
  });
}
```

## 2. Scout Application

**Files**: [scout.html](scout.html), [scout.js](scout.js), [scout.css](scout.css), [scout-firebase.js](scout-firebase.js)

### Purpose

Track individual player performance during matches for detailed analytics.

### Access Control

**Authentication Required**: Admin users only
- Login via [login.html](login.html)
- Session-based auth ([auth-simple.js](auth-simple.js))
- Redirect to login if not authenticated

### Workflow

#### 1. Match Selection

**Source**: [Gare.xls](Gare.xls) (all RM Volley matches)

**UI**: Dropdown with:
```
Under 18 F vs Team ABC - 20/01/2026
Serie D vs Team XYZ - 22/01/2026
...
```

**Action**: Select match → Load or create session

#### 2. Roster Management

**Features**:
- Add new player
  - Name
  - Number
  - Role (Palleggiatrice, Schiacciatrice, Centrale, Opposta, Libero)
- Edit existing player
- Delete player
- Save to team roster (Firebase)
- Load from team roster

**Firebase Path**: `team-roster/{teamName}/{playerId}`

**Data Structure**:
```javascript
{
  id: "player-123",
  name: "Maria Rossi",
  number: 10,
  role: "Schiacciatrice",
  actions: {
    attack: { success: 0, error: 0 },
    block: { success: 0, error: 0 },
    dig: { success: 0, error: 0 },
    serve: { success: 0, error: 0 },
    receive: { success: 0, error: 0 },
    set: { success: 0, error: 0 }
  }
}
```

#### 3. Player Selection

**UI**: Player buttons grid
- Shows all players in roster
- Click to select active player
- Highlighted when selected

#### 4. Action Tracking

**Action Types**:
- **Attack** (Attacco): Spike/hit
- **Block** (Muro): Block at net
- **Dig** (Difesa): Defensive dig
- **Serve** (Servizio): Service
- **Receive** (Ricezione): Serve receive
- **Set** (Alzata): Set

**Result Types**:
- **Success** (✓): Successful action
- **Error** (✗): Failed action

**UI**:
```
[Attack ✓] [Attack ✗]
[Block ✓]  [Block ✗]
[Dig ✓]    [Dig ✗]
[Serve ✓]  [Serve ✗]
[Receive ✓][Receive ✗]
[Set ✓]    [Set ✗]
```

**Recording Flow**:
1. Select player
2. Click action button (e.g., "Attack ✓")
3. Counter increments
4. Action saved to session
5. Statistics recalculated
6. Firebase synced

#### 5. Live Statistics Display

**Per-Player Stats**:
```javascript
{
  totalActions: 45,
  successRate: 73.3,  // (success / (success + error)) * 100
  breakdown: {
    attack: { success: 12, error: 3, rate: 80.0 },
    block: { success: 5, error: 2, rate: 71.4 },
    dig: { success: 8, error: 1, rate: 88.9 },
    serve: { success: 6, error: 4, rate: 60.0 },
    receive: { success: 7, error: 2, rate: 77.8 },
    set: { success: 4, error: 0, rate: 100.0 }
  },
  bestSkill: "set",
  worstSkill: "serve"
}
```

**Display**:
- Player card with stats
- Color-coded success rates:
  - Green: > 75%
  - Yellow: 50-75%
  - Red: < 50%
- Progress bars
- Best/worst skill badges

#### 6. Action History

**Features**:
- Timeline of all actions
- Timestamp for each
- Player name
- Action type and result
- Undo button (last action)

**UI**:
```
10:35:22 - Maria Rossi - Attack ✓
10:34:18 - Laura Bianchi - Block ✗
10:33:45 - Maria Rossi - Dig ✓
...
```

#### 7. Session Persistence

**Auto-save**: Every action saved to Firebase
**Path**: `scout-sessions/{sessionId}`

**Session Data**:
```javascript
{
  sessionId: "session-abc123",
  matchId: "12345",
  matchData: {
    date: "20/01/2026",
    opponent: "Team ABC",
    category: "Under 18 F",
    venue: "Palestra XYZ"
  },
  players: [ /* array of player objects */ ],
  actionHistory: [ /* array of actions */ ],
  timestamp: 1642512345678,
  lastUpdated: 1642515678901
}
```

#### 8. Export & Sharing

**Export Options**:
- JSON file (raw data)
- CSV file (spreadsheet)
- PDF report (formatted)
- Share link (Firebase hosted)

**Export Format (CSV)**:
```csv
Player,Number,Role,Total Actions,Success Rate,Attack,Block,Dig,Serve,Receive,Set
Maria Rossi,10,Schiacciatrice,45,73.3,12/15,5/7,8/9,6/10,7/9,4/4
...
```

### Firebase Integration

**Functions** ([scout-firebase.js](scout-firebase.js)):

```javascript
// Save session
await saveScoutSession(session);

// Load session
const session = await getScoutSession(sessionId);

// Get all sessions
const sessions = await getAllScoutSessions();

// Save player to roster
await savePlayerToRoster(teamName, player);

// Get team roster
const roster = await getTeamRoster(teamName);

// Delete player
await deletePlayerFromRoster(teamName, playerId);
```

### Use Cases

1. **During Live Match**: Track real-time performance
2. **Video Analysis**: Review recorded match and log actions
3. **Training Sessions**: Track practice performance
4. **Player Development**: Long-term skill tracking
5. **Recruitment**: Evaluate prospective players

## 3. Live Match Feature

**Files**: [live-match.html](live-match.html), [live-match.js](live-match.js), [live-match.css](live-match.css)

### Purpose

Provide real-time match experience for fans with live scores and chat.

### Access

**Public**: Anyone can access with match link
**No Login Required**: Anonymous participation (username-based)

### Features

#### 1. Match Information Display

**Data Source**: URL parameter (match data passed from dashboard)

**Display**:
```
RM VOLLEY #18 vs Team ABC
Under 18 F
20/01/2026 - 18:30
Palestra XYZ
```

#### 2. Live Score Board

**UI Layout**:
```
┌─────────────────────────────────┐
│   RM VOLLEY #18  vs  Team ABC   │
├─────────────────────────────────┤
│  Set 1:  25 - 20                │
│  Set 2:  23 - 25                │
│  Set 3:  25 - 18                │
│  Set 4:  in progress...         │
├─────────────────────────────────┤
│  Current Set:  18 - 15          │
└─────────────────────────────────┘
```

**Real-time Updates**: Firebase sync
**Path**: `live-matches/{matchKey}/scores`

**Data Structure**:
```javascript
{
  set1_home: 25,
  set1_away: 20,
  set2_home: 23,
  set2_away: 25,
  set3_home: 25,
  set3_away: 18,
  set4_home: 18,  // Current/in-progress
  set4_away: 15,
  set5_home: 0,   // Not started
  set5_away: 0
}
```

**Auto-update**: Listener fires on every score change

```javascript
scoresRef.on('value', (snapshot) => {
  const scores = snapshot.val();
  updateScoreBoard(scores);
  // Instantly updates for all viewers
});
```

#### 3. Fan Chat

**Features**:
- Real-time messaging
- Username-based (stored in localStorage)
- Message history (4 hours)
- Auto-scroll to latest
- System messages (match events)

**Username Setup**:
```javascript
// First visit
const username = prompt("Enter your name:");
localStorage.setItem('live_chat_username', username);

// Future visits
const username = localStorage.getItem('live_chat_username');
```

**Send Message**:
```javascript
function sendMessage(text) {
  if (!text.trim()) return;

  const message = {
    username: username,
    message: text,
    timestamp: Date.now(),
    type: 'user'
  };

  messagesRef.push(message);
}
```

**Receive Messages**:
```javascript
messagesRef.on('child_added', (snapshot) => {
  const message = snapshot.val();
  renderMessage(message);
  scrollToBottom();
});
```

**Message Display**:
```
┌─────────────────────────────────┐
│ Mario (10:25):                  │
│ Forza RM Volley! 🏐             │
├─────────────────────────────────┤
│ Laura (10:26):                  │
│ Grande azione!                  │
├─────────────────────────────────┤
│ [SYSTEM] Set 1 complete: 25-20  │
└─────────────────────────────────┘
```

#### 4. System Messages

**Auto-generated** for match events:
- Set completion: "Set 1 complete: 25-20"
- Match start: "Match is starting!"
- Match end: "Match finished! Final score..."

**Trigger**: Admin updates in Firebase

```javascript
function announceSetComplete(setNumber, homeScore, awayScore) {
  const message = {
    message: `Set ${setNumber} complete: ${homeScore}-${awayScore}`,
    timestamp: Date.now(),
    type: 'system'
  };
  messagesRef.push(message);
}
```

#### 5. Message Cleanup

**Expiry**: 4 hours (MESSAGE_EXPIRY constant)

**Auto-cleanup** on page load:
```javascript
messagesRef.once('value', (snapshot) => {
  const now = Date.now();
  const expiry = 4 * 60 * 60 * 1000;

  snapshot.forEach((child) => {
    const msg = child.val();
    if (now - msg.timestamp > expiry) {
      child.ref.remove();
    }
  });
});
```

#### 6. Match Status

**Status Indicators**:
- **Upcoming**: 12+ hours before match
- **Soon**: < 12 hours, chat enabled
- **Live**: < 10 minutes before match, scores enabled
- **Completed**: After match, read-only mode

**Visual Indicators**:
- Live: Pulsing red dot
- Soon: Orange clock icon
- Upcoming: Blue calendar icon
- Completed: Gray checkmark

#### 7. Access from Dashboard

**Integration**: "Watch Live" button on match cards

```javascript
function openLiveMatch(match) {
  const matchData = encodeURIComponent(JSON.stringify(match));
  window.open(`live-match.html?match=${matchData}`, '_blank');
}
```

### Admin Features

**Score Updates** (requires login):
- Increment/decrement buttons
- Set-by-set input
- Quick score presets (25-20, etc.)
- Match control (start/pause/end)

**Chat Moderation**:
- Delete inappropriate messages
- Ban users (if implemented)
- Post system announcements

## 4. Player Statistics

**Files**: [player-stats.html](player-stats.html), [player-stats.js](player-stats.js), [player-stats.css](player-stats.css)

### Purpose

Aggregated view of player performance across all scout sessions.

### Data Source

**Firebase**: `scout-sessions/` collection
**Process**: Load all sessions, aggregate by player

### Features

#### 1. Player List

**Display**: Cards grid
**Sort Options**:
- Name (A-Z)
- Total actions (high to low)
- Success rate (high to low)
- Games played (high to low)

#### 2. Player Card

**Information**:
```
┌─────────────────────────────┐
│ Maria Rossi (#10)           │
│ Schiacciatrice              │
├─────────────────────────────┤
│ Games Played: 12            │
│ Total Actions: 245          │
│ Success Rate: 75.3%         │
├─────────────────────────────┤
│ Best Skill: Attack (82.5%)  │
│ Teams: Under 18 F, Serie D  │
└─────────────────────────────┘
```

#### 3. Filters

**Search**: By player name
**Team Filter**: Dropdown of all teams
**Position Filter**: Dropdown of all roles

**Filter Logic**:
```javascript
filteredPlayers = allPlayers.filter(player => {
  // Search
  if (query && !player.name.toLowerCase().includes(query)) {
    return false;
  }

  // Team
  if (selectedTeam && !player.teams.includes(selectedTeam)) {
    return false;
  }

  // Position
  if (selectedRole && player.role !== selectedRole) {
    return false;
  }

  return true;
});
```

#### 4. Player Detail View

**Modal on card click**:
- Complete action breakdown
- Success rate by action type
- Performance over time (chart)
- Games breakdown
- Export individual stats

#### 5. Comparison Mode

**Feature**: Select multiple players to compare

**Display**:
- Side-by-side stats table
- Comparative charts
- Highlight best/worst in each category

#### 6. Export

**Options**:
- Full roster (all players)
- Filtered list
- Individual player
- Comparison report

**Formats**: CSV, JSON, PDF

### Calculations

**Success Rate**:
```javascript
function calculateSuccessRate(actions) {
  let totalSuccess = 0;
  let totalAttempts = 0;

  Object.values(actions).forEach(action => {
    totalSuccess += action.success;
    totalAttempts += action.success + action.error;
  });

  return totalAttempts > 0
    ? (totalSuccess / totalAttempts) * 100
    : 0;
}
```

**Best Skill**:
```javascript
function findBestSkill(actions) {
  let bestSkill = null;
  let bestRate = 0;

  Object.entries(actions).forEach(([skill, counts]) => {
    const total = counts.success + counts.error;
    if (total === 0) return;

    const rate = (counts.success / total) * 100;
    if (rate > bestRate) {
      bestRate = rate;
      bestSkill = skill;
    }
  });

  return { skill: bestSkill, rate: bestRate };
}
```

## 5. Social Media Tools

**Files**: [social.html](social.html), [social.js](social.js)

### Purpose

Generate graphics for social media posts (Instagram, Facebook, Twitter).

### Access Control

**Authentication Required**: socialmediamanager or admin role

### Features

#### 1. Match Result Graphics

**Input**:
- Select match from [Gare.xls](Gare.xls)
- Customize colors/text

**Output**:
- Square graphic (1080x1080px)
- Team logos
- Final score
- Match details
- Branded footer

**Template**:
```
┌─────────────────────────────┐
│         VITTORIA! 🏐        │
├─────────────────────────────┤
│  RM VOLLEY #18              │
│        3 - 1                │
│      Team ABC               │
├─────────────────────────────┤
│  25-20, 23-25, 25-18, 25-22 │
├─────────────────────────────┤
│  Under 18 F • 20/01/2026    │
└─────────────────────────────┘
```

#### 2. Standings Graphics

**Input**:
- Select league
- Customize style

**Output**:
- Vertical graphic (1080x1920px - story format)
- League table
- Highlight RM Volley position
- Branded design

#### 3. Player Highlights

**Input**:
- Select player
- Choose stat period
- Add photo (optional)

**Output**:
- Player stat card
- Key metrics
- Performance chart
- Share text

#### 4. Download & Share

**Features**:
- Download as PNG
- Copy to clipboard
- Direct share to social media (if supported)
- Save template for reuse

### Canvas Generation

**Technology**: HTML5 Canvas API

```javascript
function generateMatchGraphic(match) {
  const canvas = document.getElementById('canvas');
  const ctx = canvas.getContext('2d');

  // Set size
  canvas.width = 1080;
  canvas.height = 1080;

  // Background
  ctx.fillStyle = '#0066FF';
  ctx.fillRect(0, 0, 1080, 1080);

  // Draw elements
  drawHeader(ctx);
  drawScore(ctx, match);
  drawDetails(ctx, match);
  drawBranding(ctx);

  // Convert to image
  return canvas.toDataURL('image/png');
}
```

## Progressive Web App (PWA)

### Installation

**Files**: [manifest.json](manifest.json), [sw.js](sw.js)

**Supported Platforms**:
- Android: Chrome "Add to Home Screen"
- iOS: Safari "Add to Home Screen"
- Desktop: Chrome "Install App"

**Manifest** ([manifest.json](manifest.json)):
```json
{
  "name": "RM Volley Dashboard",
  "short_name": "RM Volley",
  "description": "Track matches, stats, and standings",
  "start_url": "/",
  "display": "standalone",
  "theme_color": "#0066FF",
  "background_color": "#ffffff",
  "icons": [
    {
      "src": "media/icon-192x192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    ...
  ]
}
```

### Service Worker

**File**: [sw.js](sw.js)

**Caching Strategy**: Cache-first for assets, network-first for data

```javascript
const CACHE_NAME = 'rm-volley-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/app.js',
  '/styles.css',
  '/utils.js',
  // ... other static files
];

// Install
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(urlsToCache);
    })
  );
});

// Fetch
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});
```

### Offline Support

**Cached**:
- HTML files
- CSS files
- JavaScript files
- Images/icons

**Requires Network**:
- [Gare.xls](Gare.xls) (Excel data)
- [classifica.json](classifica.json) (standings)
- Firebase (live features)

**Offline Fallback**:
- Show cached data with "Offline" indicator
- Queue actions for when online
- Inform user of limited functionality

---

**Summary**: The RM Volley Dashboard offers a complete ecosystem for volleyball team management, from match tracking to player analytics to fan engagement. All features are designed for ease of use and mobile-first experience.
