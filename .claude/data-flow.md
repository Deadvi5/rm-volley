# Data Flow Documentation - RM Volley Dashboard

## Overview

This document describes how data flows through the RM Volley system, from FIPAV sources to the end-user dashboard.

## Complete Data Pipeline

```
FIPAV Sources (Web)
        ↓
Python Script (update_gare.py)
        ↓
Excel File (Gare.xls) + JSON (classifica.json)
        ↓
Frontend JavaScript (app.js)
        ↓
User Interface (index.html)
        ↓
Firebase (Live Features)
```

## 1. Data Sources (FIPAV)

### Match Data Sources

**FIPAV Provincial Committee (Piacenza)**:
- URL: `https://www.fipavpiacenza.it/esporta-risultati.aspx?...`
- Provides: Local league matches (Under 14, Under 16, Under 18, Seconda Div.)
- Format: Excel (.xls) export

**FIPAV Regional Committee (Emilia-Romagna/CRER)**:
- URL: `https://crer.portalefipav.net/esporta-risultati.aspx?...`
- Provides: Regional league matches (Serie D)
- Format: Excel (.xls) export

### Standings Data Sources

**League Standings Pages**:
- URL Pattern: `https://.../classifica.aspx?CId={championship_id}`
- Format: HTML tables
- Contains: Team rankings, points, wins/losses, set statistics

## 2. Python Data Processor

### File: [update_gare.py](update_gare.py)

**Entry Point**: `main()` function (line 324)

**Execution Flow**:

```python
1. check_and_setup_environment()
   ├─ Check for required packages (requests, pandas, etc.)
   ├─ Create .venv if needed
   ├─ Install dependencies
   └─ Re-exec with venv Python if needed

2. load_config()
   ├─ Read config.json
   ├─ Validate required fields
   └─ Return config object

3. Download Phase
   for each URL in config['dataSources']:
       download_excel(url, temp_file)
       ├─ Set proper headers (User-Agent, etc.)
       ├─ GET request with 30s timeout
       ├─ Validate content type
       └─ Save to temp file

4. Merge Phase
   merge_excel_files(temp_files, output_file)
   ├─ Read each Excel file with pandas
   ├─ Try xlrd engine (old .xls format)
   ├─ Fallback to openpyxl if needed
   ├─ Concatenate all DataFrames
   ├─ Remove duplicates by 'Gara N' column
   ├─ Sort by 'Data' column
   └─ Save merged file

5. Standings Phase
   update_classifica()
   for each league in config['leagues']:
       ├─ Fetch HTML page
       ├─ Parse with pandas.read_html()
       ├─ Find table with 'squadra' and 'punti' columns
       ├─ Convert to dict records
       └─ Store in all_standings object

   Save to classifica.json

6. Cleanup Phase
   cleanup_temp_files(temp_files)
   └─ Remove temporary Excel files

7. Return
   └─ Exit code 0 (success) or 1 (error)
```

### Key Functions

**`download_excel(url, filename)`** (line 154):
- Downloads Excel file from FIPAV
- Sets browser-like headers to avoid blocking
- Validates response content type
- Returns True/False for success

**`merge_excel_files(files, output_file)`** (line 192):
- Reads multiple Excel files
- Handles both .xls (xlrd) and .xlsx (openpyxl) formats
- Deduplicates by match number ('Gara N')
- Sorts chronologically
- Outputs single merged Excel file

**`update_classifica()`** (line 261):
- Scrapes league standings from HTML
- Uses pandas to parse tables automatically
- Identifies standings table by column names
- Outputs JSON with all league standings

### Data Transformation

**Input Excel Format** (from FIPAV):
```
Gara N | Data | Ora | Campo | Squadra Casa | Squadra Ospite | Set 1 Casa | Set 1 Ospite | ... | Categoria
-------|------|-----|-------|--------------|----------------|------------|--------------|-----|----------
12345  | 15/01| 18:30| Pala...| RM VOLLEY #18| Team ABC       | 25         | 20           | ... | Under 18 F
```

**Output Excel Format** (Gare.xls):
- Same structure, multiple sources merged
- Duplicates removed
- Sorted by date (oldest to newest)
- All RM Volley matches included

**Output JSON Format** (classifica.json):
```json
{
  "Serie D Femminile": [
    {
      "Pos": 1,
      "Squadra": "Team Name",
      "Punti": 45,
      "Giocate": 15,
      "Vinte": 13,
      "Perse": 2,
      "Set +": 41,
      "Set -": 12
    },
    ...
  ],
  "Under 18 F Gir. A": [ ... ],
  ...
}
```

## 3. Automated Updates

### GitHub Actions Workflow

**File**: [.github/workflows/update_matches.yml](.github/workflows/update_matches.yml)

**Schedule**: Daily at 08:00 UTC (09:00 CET)

**Workflow Steps**:
```yaml
1. Trigger
   - Cron: '0 8 * * *'  # 08:00 UTC daily
   - Manual: workflow_dispatch

2. Checkout
   - uses: actions/checkout@v4
   - Fetches latest repository code

3. Setup Python
   - uses: actions/setup-python@v4
   - Python version: 3.11

4. Install Dependencies
   - pip install -r requirements.txt

5. Run Update Script
   - python update_gare.py
   - Generates Gare.xls and classifica.json

6. Commit Changes
   - Configure git user
   - Add updated files
   - Commit with timestamp message
   - Format: "🔄 Aggiorna dati: YYYY-MM-DD HH:MM:SS"

7. Push
   - Push to main branch
   - Triggers deployment (if configured)
```

**Failure Handling**:
- GitHub sends email notification on failure
- Check Actions tab in repository for logs
- Common failures:
  - FIPAV website down
  - URL structure changed
  - Network timeout

## 4. Frontend Data Loading

### File: [app.js](app.js)

**Initialization Flow**:

```javascript
// Entry point: DOMContentLoaded event
document.addEventListener('DOMContentLoaded', () => {
    loadExcelFile();  // Start data loading
});

async function loadExcelFile() {
    1. Load Configuration
       const config = await loadConfig();
       ├─ Fetch config.json
       ├─ Parse JSON
       └─ Store in global variable

    2. Initialize Firebase (if configured)
       try {
           import firebase-config.js
           firebase.initializeApp(config)
           firebaseDatabase = firebase.database()
       } catch {
           console.warn('Firebase not configured')
       }

    3. Load Excel Data
       const response = await fetch('Gare.xls');
       const arrayBuffer = await response.arrayBuffer();
       const workbook = XLSX.read(arrayBuffer);
       const data = XLSX.utils.sheet_to_json(firstSheet);
       allMatches = data;

    4. Process Data
       await processData();
       ├─ Filter RM Volley matches
       ├─ Categorize matches
       ├─ Calculate match status
       └─ Enrich with metadata

    5. Aggregate Team Data
       aggregateTeamData();
       ├─ Group by team category
       ├─ Calculate wins/losses/draws
       ├─ Calculate set statistics
       └─ Store in teamsData object

    6. Render UI
       renderAll();
       ├─ renderOverview()
       ├─ renderTeams()
       ├─ renderMatches()
       └─ Setup event listeners

    7. Load Standings
       loadStandings();
       ├─ Fetch classifica.json
       ├─ Parse JSON
       └─ Store in standingsData object

    8. Setup Firebase Listeners
       setupLiveMatchListeners();
       └─ Listen for live score updates

    9. Hide Loading, Show Dashboard
       document.getElementById('loading').style.display = 'none';
}
```

### Data Processing Functions

**`processData()`** (async, line ~120):
```javascript
async function processData() {
    // Use chunk processing to prevent UI blocking
    await processInChunks(allMatches, (match) => {
        // 1. Calculate match status
        match.status = calculateMatchStatus(match);
        // Values: 'past', 'today', 'upcoming'

        // 2. Categorize match
        const category = categorizeMatch(match);
        match.category = category.name;
        match.isHome = category.isHome;

        // 3. Parse date
        match.dateObj = parseDate(match.Data);

        // 4. Calculate result
        if (match.status === 'past') {
            match.result = calculateResult(match);
            // Values: 'win', 'loss', 'draw'
        }

        // 5. Count completed sets
        match.completedSets = countCompletedSets(match);
    });

    // Filter only RM Volley matches
    allMatches = allMatches.filter(match => {
        const home = match['Squadra Casa'];
        const away = match['Squadra Ospite'];
        return isOurTeam(home) || isOurTeam(away);
    });

    filteredMatches = allMatches;
}
```

**`aggregateTeamData()`** (line ~250):
```javascript
function aggregateTeamData() {
    const teams = {};

    allMatches.forEach(match => {
        const teamKey = match.category;

        if (!teams[teamKey]) {
            teams[teamKey] = {
                name: teamKey,
                totalMatches: 0,
                wins: 0,
                losses: 0,
                draws: 0,
                setsWon: 0,
                setsLost: 0,
                pointsScored: 0,
                pointsConceded: 0,
                upcomingMatches: [],
                recentResults: []
            };
        }

        const team = teams[teamKey];
        team.totalMatches++;

        if (match.status === 'past') {
            // Accumulate statistics
            if (match.result === 'win') team.wins++;
            else if (match.result === 'loss') team.losses++;
            else team.draws++;

            // Count sets
            team.setsWon += countSetsWon(match);
            team.setsLost += countSetsLost(match);

            // Points
            team.pointsScored += totalPoints(match, 'our');
            team.pointsConceded += totalPoints(match, 'their');

            // Recent results (last 5)
            team.recentResults.push(match);
            if (team.recentResults.length > 5) {
                team.recentResults = team.recentResults.slice(-5);
            }
        } else if (match.status === 'upcoming') {
            team.upcomingMatches.push(match);
        }
    });

    // Calculate percentages
    Object.values(teams).forEach(team => {
        team.winPercentage = (team.wins / team.totalMatches) * 100;
        team.avgPointsScored = team.pointsScored / team.totalMatches;
    });

    teamsData = teams;
}
```

### Team Identification Logic

**`isOurTeam(teamName)`**:
```javascript
function isOurTeam(teamName) {
    if (!teamName) return false;
    const upper = teamName.toUpperCase();
    return config.team.matchPatterns.some(pattern => {
        return upper.includes(pattern.toUpperCase());
    });
}
// Example:
// teamName = "RM VOLLEY #18"
// config.team.matchPatterns = ["RM VOLLEY", "RMVOLLEY"]
// Returns: true
```

**`categorizeMatch(match)`**:
```javascript
function categorizeMatch(match) {
    const home = match['Squadra Casa'];
    const away = match['Squadra Ospite'];

    let ourTeam, isHome;
    if (isOurTeam(home)) {
        ourTeam = home;
        isHome = true;
    } else {
        ourTeam = away;
        isHome = false;
    }

    // Extract team number: "RM VOLLEY #18" -> "18"
    const numberMatch = ourTeam.match(/#(\d+)/);
    const teamNumber = numberMatch ? numberMatch[1] : null;

    // Map to category name
    const categoryName = teamNumber
        ? config.categories[teamNumber] || 'Sconosciuto'
        : 'Sconosciuto';

    return {
        name: categoryName,
        isHome: isHome,
        teamNumber: teamNumber
    };
}
```

## 5. Data Rendering

### Rendering Pipeline

**`renderAll()`**:
```javascript
function renderAll() {
    // Render each tab's content
    renderOverview();   // Dashboard stats
    renderTeams();      // Team cards
    renderMatches();    // Match list
    renderStats();      // Charts
    renderInsights();   // Analytics

    // Setup event listeners
    setupFilters();
    setupSearch();
    setupModals();
}
```

### Overview Tab Rendering

**Key Metrics** (Header Cards):
```javascript
function renderOverview() {
    // 1. Total Matches
    const totalMatches = allMatches.length;

    // 2. Overall Win Rate
    const pastMatches = allMatches.filter(m => m.status === 'past');
    const wins = pastMatches.filter(m => m.result === 'win').length;
    const winRate = (wins / pastMatches.length) * 100;

    // 3. Next Match
    const upcoming = allMatches
        .filter(m => m.status === 'upcoming')
        .sort((a, b) => a.dateObj - b.dateObj)[0];

    // 4. Upcoming This Week
    const weekFromNow = new Date();
    weekFromNow.setDate(weekFromNow.getDate() + 7);
    const thisWeek = allMatches.filter(m => {
        return m.status === 'upcoming' &&
               m.dateObj <= weekFromNow;
    }).length;

    // Update DOM
    document.getElementById('totalMatches').textContent = totalMatches;
    document.getElementById('winRate').textContent = winRate.toFixed(1) + '%';
    // ... etc
}
```

### Teams Tab Rendering

**Team Cards**:
```javascript
function renderTeams() {
    const container = document.getElementById('teamsGrid');
    container.innerHTML = '';

    Object.values(teamsData).forEach(team => {
        const card = createTeamCard(team);
        container.appendChild(card);
    });
}

function createTeamCard(team) {
    // Calculate form (last 5 matches)
    const form = team.recentResults
        .slice(-5)
        .map(m => m.result === 'win' ? 'W' : 'L')
        .join('');

    // Get league standing
    const standing = getTeamStanding(team.name);

    // Create card HTML
    const card = document.createElement('div');
    card.className = 'team-card';
    card.innerHTML = `
        <h3>${team.name}</h3>
        <div class="team-record">${team.wins}W - ${team.losses}L</div>
        <div class="team-stats">
            <div>Win %: ${team.winPercentage.toFixed(1)}%</div>
            <div>Sets: ${team.setsWon}-${team.setsLost}</div>
        </div>
        <div class="team-form">${form}</div>
        ${standing ? `<div class="standing">Pos: ${standing.Pos}</div>` : ''}
        <button onclick="showTeamDetail('${team.name}')">View Details</button>
    `;

    return card;
}
```

### Matches Tab Rendering

**Match List with Filters**:
```javascript
function renderMatches() {
    const container = document.getElementById('matchesList');
    const matches = filteredMatches; // Uses current filter

    container.innerHTML = '';

    matches.forEach(match => {
        const card = createMatchCard(match);
        container.appendChild(card);
    });

    // Update count
    document.getElementById('matchCount').textContent = matches.length;
}

function createMatchCard(match) {
    const card = document.createElement('div');
    card.className = `match-card status-${match.status}`;

    // Determine badge
    let badge = '';
    if (match.status === 'past') {
        badge = `<span class="badge badge-${match.result}">${match.result}</span>`;
    } else if (match.status === 'today') {
        badge = `<span class="badge badge-live">OGGI</span>`;
    }

    card.innerHTML = `
        <div class="match-header">
            <span class="match-date">${match.Data}</span>
            <span class="match-category">${match.category}</span>
            ${badge}
        </div>
        <div class="match-teams">
            <div class="team ${match.isHome ? 'our-team' : ''}">
                ${match['Squadra Casa']}
            </div>
            <div class="vs">vs</div>
            <div class="team ${!match.isHome ? 'our-team' : ''}">
                ${match['Squadra Ospite']}
            </div>
        </div>
        ${match.status === 'past' ? renderScore(match) : ''}
        <div class="match-info">
            <span>${match.Ora}</span>
            <span>${match.Campo}</span>
        </div>
    `;

    return card;
}
```

### Stats Tab Rendering

**Chart.js Integration**:
```javascript
function renderStats() {
    renderWinLossChart();
    renderSetStatisticsChart();
    renderFormChart();
    renderCategoryComparisonChart();
}

function renderWinLossChart() {
    const ctx = document.getElementById('winLossChart').getContext('2d');

    // Aggregate data by team
    const teams = Object.values(teamsData);
    const labels = teams.map(t => t.name);
    const wins = teams.map(t => t.wins);
    const losses = teams.map(t => t.losses);

    // Destroy existing chart
    if (chartInstances.winLoss) {
        chartInstances.winLoss.destroy();
    }

    // Create new chart
    chartInstances.winLoss = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Wins',
                    data: wins,
                    backgroundColor: 'rgba(16, 185, 129, 0.5)',
                    borderColor: 'rgb(16, 185, 129)',
                    borderWidth: 1
                },
                {
                    label: 'Losses',
                    data: losses,
                    backgroundColor: 'rgba(239, 68, 68, 0.5)',
                    borderColor: 'rgb(239, 68, 68)',
                    borderWidth: 1
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { stepSize: 1 }
                }
            }
        }
    });
}
```

## 6. Live Features (Firebase)

### Live Match Scores

**Data Structure**:
```javascript
// Firebase path: live-matches/{matchKey}/scores
{
    set1_home: 25,
    set1_away: 20,
    set2_home: 23,
    set2_away: 25,
    set3_home: 25,
    set3_away: 18,
    // ...
}
```

**Listener Setup** (app.js):
```javascript
function setupLiveMatchListeners() {
    if (!firebaseDatabase) return;

    allMatches.forEach(match => {
        if (match.status === 'today' || match.status === 'upcoming') {
            const matchKey = getMatchKey(match);
            const scoresRef = firebaseDatabase.ref(
                `live-matches/${matchKey}/scores`
            );

            scoresRef.on('value', (snapshot) => {
                const scores = snapshot.val();
                if (scores) {
                    updateMatchCardWithLiveScores(match, scores);
                }
            });
        }
    });
}
```

**Live Update** (live-match.js):
```javascript
// Admin updates score
function updateScore(set, team, value) {
    const path = `live-matches/${matchKey}/scores/set${set}_${team}`;
    scoresRef.child(path).set(value);
    // Instantly propagates to all connected clients
}

// User receives update
scoresRef.on('value', (snapshot) => {
    const scores = snapshot.val();
    renderScoreBoard(scores);
});
```

### Live Match Chat

**Message Structure**:
```javascript
// Firebase path: live-matches/{matchKey}/messages/{messageId}
{
    username: "Mario",
    message: "Forza RM Volley!",
    timestamp: 1642512345678,
    type: "user"  // or "system"
}
```

**Send Message**:
```javascript
function sendMessage(text) {
    const message = {
        username: username,
        message: text,
        timestamp: Date.now(),
        type: 'user'
    };

    messagesRef.push(message);
    // Automatically syncs to all clients
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

**Auto-cleanup** (old messages):
```javascript
// Remove messages older than 4 hours
messagesRef.once('value', (snapshot) => {
    const now = Date.now();
    const expiry = 4 * 60 * 60 * 1000; // 4 hours

    snapshot.forEach((child) => {
        const message = child.val();
        if (now - message.timestamp > expiry) {
            child.ref.remove();
        }
    });
});
```

## 7. Scout Data Flow

### Scout Session Creation

```javascript
// 1. User selects match from Gare.xls
const match = allMatches.find(m => m['Gara N'] === selectedMatchId);

// 2. Create session
const session = {
    sessionId: generateId(),
    matchId: match['Gara N'],
    matchData: {
        date: match.Data,
        opponent: getOpponent(match),
        category: match.category
    },
    players: [],
    timestamp: Date.now()
};

// 3. Save to Firebase
saveScoutSession(session);
```

### Player Action Tracking

```javascript
// 1. User records action
function recordAction(playerId, actionType, result) {
    const player = session.players.find(p => p.id === playerId);

    if (!player.actions[actionType]) {
        player.actions[actionType] = { success: 0, error: 0 };
    }

    player.actions[actionType][result]++;

    // 2. Update Firebase
    const path = `scout-sessions/${session.sessionId}/players/${playerId}/actions`;
    firebase.database().ref(path).set(player.actions);

    // 3. Add to action history
    session.actionHistory.push({
        playerId: playerId,
        actionType: actionType,
        result: result,
        timestamp: Date.now()
    });

    // 4. Update UI
    renderPlayerStats(player);
}
```

### Statistics Aggregation

```javascript
// player-stats.js
async function loadPlayerStatistics() {
    // 1. Fetch all scout sessions from Firebase
    const sessions = await getAllScoutSessions();

    // 2. Aggregate by player
    const playerStats = {};

    sessions.forEach(session => {
        session.players.forEach(player => {
            if (!playerStats[player.id]) {
                playerStats[player.id] = {
                    id: player.id,
                    name: player.name,
                    number: player.number,
                    role: player.role,
                    gamesPlayed: 0,
                    totalActions: {},
                    teams: new Set()
                };
            }

            const stats = playerStats[player.id];
            stats.gamesPlayed++;
            stats.teams.add(session.matchData.category);

            // Merge actions
            Object.entries(player.actions).forEach(([action, counts]) => {
                if (!stats.totalActions[action]) {
                    stats.totalActions[action] = { success: 0, error: 0 };
                }
                stats.totalActions[action].success += counts.success;
                stats.totalActions[action].error += counts.error;
            });
        });
    });

    // 3. Calculate success rates
    Object.values(playerStats).forEach(player => {
        Object.entries(player.totalActions).forEach(([action, counts]) => {
            const total = counts.success + counts.error;
            counts.rate = total > 0 ? (counts.success / total) * 100 : 0;
        });
    });

    // 4. Render
    renderPlayersList(Object.values(playerStats));
}
```

## Performance Optimizations

### Chunk Processing

**Problem**: Processing large datasets blocks UI
**Solution**: Process in chunks with RAF

```javascript
// utils.js
export async function processInChunks(array, callback, chunkSize = 100) {
    for (let i = 0; i < array.length; i += chunkSize) {
        const chunk = array.slice(i, i + chunkSize);
        chunk.forEach(callback);

        // Yield to browser
        await new Promise(resolve => requestAnimationFrame(resolve));
    }
}

// Usage in app.js
await processInChunks(allMatches, (match) => {
    // Process each match
});
```

### Debounced Search

**Problem**: Search fires on every keystroke
**Solution**: Debounce with 250ms delay

```javascript
// utils.js
export function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

// Usage
const debouncedSearch = debounce((query) => {
    filterMatches(query);
}, 250);

searchInput.addEventListener('input', (e) => {
    debouncedSearch(e.target.value);
});
```

### Chart Caching

**Problem**: Charts re-render even when data unchanged
**Solution**: Deep equality check before render

```javascript
// utils.js
export function deepEqual(a, b) {
    return JSON.stringify(a) === JSON.stringify(b);
}

// Usage in app.js
function renderWinLossChart() {
    const chartData = prepareChartData();

    // Check if data changed
    if (deepEqual(chartData, lastChartData)) {
        return; // Skip re-render
    }

    lastChartData = chartData;

    // Destroy and recreate chart
    if (chartInstances.winLoss) {
        chartInstances.winLoss.destroy();
    }
    chartInstances.winLoss = new Chart(ctx, config);
}
```

## Error Handling

### Data Loading Errors

```javascript
try {
    await loadExcelFile();
} catch (error) {
    console.error('Error loading:', error);
    showErrorState('Impossibile caricare i dati');
}
```

### Firebase Connection Errors

```javascript
firebase.database().ref('.info/connected').on('value', (snap) => {
    if (snap.val() === true) {
        console.log('Connected to Firebase');
    } else {
        console.warn('Disconnected from Firebase');
        showWarning('Funzionalità live non disponibili');
    }
});
```

### Data Processing Errors

```javascript
function parseDate(dateString) {
    try {
        const [day, month, year] = dateString.split('/');
        return new Date(year, month - 1, day);
    } catch (error) {
        console.error('Invalid date:', dateString);
        return new Date(); // Fallback
    }
}
```

---

**Summary**: Data flows from FIPAV → Python → Excel/JSON → JavaScript → UI, with Firebase enabling real-time features. The system is designed for reliability, performance, and easy maintenance.
