// ====================================
// RM Volley Dashboard - JavaScript
// ====================================

// Global state
let allMatches = [];
let filteredMatches = [];
let teamsData = {};
let currentTab = 'overview';
let chartInstances = {};
let standingsData = {}; // Store all standings data
let config = null; // Configuration from config.json

// ==================== Data Loading ====================

/**
 * Load configuration from config.json
 */
async function loadConfig() {
    try {
        const response = await fetch('config.json');
        if (!response.ok) {
            throw new Error('Config file not found');
        }
        config = await response.json();
        console.log('✅ Configuration loaded:', config);
        return config;
    } catch (error) {
        console.error('❌ Error loading config.json:', error);
        document.getElementById('loading').innerHTML = `
            <div class="empty-icon">⚠️</div>
            <h3>Errore Configurazione</h3>
            <p style="font-size: 0.875rem; margin-top: 0.5rem;">File config.json non trovato o non valido</p>
        `;
        throw error;
    }
}

/**
 * Load Excel file and initialize dashboard
 */
async function loadExcelFile() {
    try {
        // Load config first
        await loadConfig();

        const response = await fetch('Gare.xls');
        const arrayBuffer = await response.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(firstSheet);

        allMatches = data;
        processData();
        renderAll();
        loadStandings();

        document.getElementById('loading').style.display = 'none';
        document.querySelectorAll('.tab-content').forEach(tab => {
            if (tab.id === 'overview-tab') {
                tab.style.display = 'block';
            }
        });


    } catch (error) {
        console.error('Error loading Excel file:', error);
        document.getElementById('loading').innerHTML = `
            <div class="empty-icon">⚠️</div>
            <h3>Errore nel caricamento</h3>
            <p style="font-size: 0.875rem; margin-top: 0.5rem;">Assicurati che Gare.xls sia disponibile</p>
        `;
    }
}

/**
 * Load Standings JSON
 */
async function loadStandings() {
    try {
        const response = await fetch('classifica.json');
        if (!response.ok) throw new Error('Classifica not found');
        standingsData = await response.json();

        // Initialize selector and render first league
        populateLeagueSelector();

        // Default to first league or Serie D
        const leagues = Object.keys(standingsData);
        if (leagues.length > 0) {
            const defaultLeague = leagues.find(l => l.includes('Serie D')) || leagues[0];
            document.getElementById('leagueSelect').value = defaultLeague;
            renderStandings(defaultLeague);
        }

        // Add event listener
        document.getElementById('leagueSelect').addEventListener('change', (e) => {
            renderStandings(e.target.value);
        });

    } catch (error) {
        console.error('Error loading standings:', error);
    }
}

function populateLeagueSelector() {
    const select = document.getElementById('leagueSelect');
    select.innerHTML = '';

    Object.keys(standingsData).forEach(league => {
        const option = document.createElement('option');
        option.value = league;
        option.textContent = league;
        select.appendChild(option);
    });
}

// ==================== Data Processing ====================

/**
 * Process raw match data and calculate team statistics
 */
function processData() {
    teamsData = {};
    const rmTeams = new Set();

    // Helper to identify teams based on config patterns
    function isRmTeam(name) {
        if (!name || !config) return false;
        const normalized = String(name).toUpperCase().replace(/\s+/g, ' ');
        // Check against all configured patterns
        return config.team.matchPatterns.some(pattern => {
            const patternNormalized = pattern.toUpperCase().replace(/\s+/g, ' ');
            return normalized.includes(patternNormalized);
        });
    }

    // Find all RM Volley teams
    allMatches.forEach(match => {
        const home = match.SquadraCasa;
        const away = match.SquadraOspite;

        if (isRmTeam(home)) rmTeams.add(home);
        if (isRmTeam(away)) rmTeams.add(away);
    });

    // Initialize team data with extended metrics
    rmTeams.forEach(team => {
        teamsData[team] = {
            name: team,
            played: 0,
            wins: 0,
            losses: 0,
            totalMatches: 0,
            category: getCategory(team),
            matches: [],
            setsWon: 0,
            setsLost: 0,
            pointsScored: 0,
            pointsConceded: 0,
            homeWins: 0,
            awayWins: 0,
            homeLosses: 0,
            awayLosses: 0,
            winStreak: 0,
            currentStreak: 0,
            longestWinStreak: 0,
            recentForm: []
        };
    });

    // Calculate statistics
    allMatches.forEach(match => {
        const home = match.SquadraCasa;
        const away = match.SquadraOspite;
        const result = match.Risultato;
        const isRmHome = isRmTeam(home);
        const isRmAway = isRmTeam(away);

        if (isRmHome || isRmAway) {
            const team = isRmHome ? home : away;
            const isHome = isRmHome;

            teamsData[team].totalMatches++;
            teamsData[team].matches.push({ ...match, isHome });

            if (result && result.includes('-')) {
                const [homeSets, awaySets] = result.split('-').map(s => parseInt(s.trim()));
                const won = isHome ? (homeSets > awaySets) : (awaySets > homeSets);

                teamsData[team].played++;
                teamsData[team].setsWon += isHome ? homeSets : awaySets;
                teamsData[team].setsLost += isHome ? awaySets : homeSets;

                // Calculate points from partials
                if (match.Parziali) {
                    const sets = match.Parziali.split(' ').filter(s => s.trim());
                    sets.forEach(set => {
                        const [p1, p2] = set.replace(/[()]/g, '').split('-').map(p => parseInt(p));
                        if (!isNaN(p1) && !isNaN(p2)) {
                            teamsData[team].pointsScored += isHome ? p1 : p2;
                            teamsData[team].pointsConceded += isHome ? p2 : p1;
                        }
                    });
                }

                if (won) {
                    teamsData[team].wins++;
                    if (isHome) teamsData[team].homeWins++;
                    else teamsData[team].awayWins++;
                    teamsData[team].currentStreak = Math.max(0, teamsData[team].currentStreak) + 1;
                    teamsData[team].recentForm.push('W');
                } else {
                    teamsData[team].losses++;
                    if (isHome) teamsData[team].homeLosses++;
                    else teamsData[team].awayLosses++;
                    teamsData[team].currentStreak = Math.min(0, teamsData[team].currentStreak) - 1;
                    teamsData[team].recentForm.push('L');
                }

                teamsData[team].longestWinStreak = Math.max(
                    teamsData[team].longestWinStreak,
                    Math.max(0, teamsData[team].currentStreak)
                );
            }
        }
    });

    // Keep only last 5 form results
    Object.values(teamsData).forEach(team => {
        team.recentForm = team.recentForm.slice(-5);
        team.matches.sort((a, b) => parseDate(b.Data) - parseDate(a.Data));
    });

    updateHeaderStats();
    populateFilters();
}

/**
 * Get category from team name
 */
function getCategory(teamName) {
    if (!config) return 'Sconosciuto';
    const num = teamName.match(/#(\d+)/)?.[1];
    return config.categories[num] || 'Sconosciuto';
}

/**
 * Get team badge emoji based on performance
 */
function getTeamBadge(team) {
    if (team.played === 0) return '⏳';
    const winRate = team.wins / team.played;
    if (winRate === 1) return '🔥';
    if (winRate >= 0.8) return '⭐';
    if (winRate >= 0.6) return '✅';
    if (winRate >= 0.4) return '📊';
    if (team.currentStreak >= 3) return '🚀';
    if (team.currentStreak <= -3) return '⚠️';
    return '🏐';
}

/**
 * Update header statistics
 */
function updateHeaderStats() {
    const totalPlayed = Object.values(teamsData).reduce((sum, team) => sum + team.played, 0);
    const totalWins = Object.values(teamsData).reduce((sum, team) => sum + team.wins, 0);
    const overallWinRate = totalPlayed > 0 ? Math.round((totalWins / totalPlayed) * 100) : 0;

    // Update desktop header stats
    document.getElementById('totalTeams').textContent = Object.keys(teamsData).length;
    document.getElementById('totalMatches').textContent = allMatches.length;
    document.getElementById('totalWins').textContent = totalWins;
    document.getElementById('winRate').textContent = overallWinRate + '%';

    // Update mobile stats (iOS card)
    const totalTeamsMobile = document.getElementById('totalTeamsMobile');
    const totalMatchesMobile = document.getElementById('totalMatchesMobile');
    const totalWinsMobile = document.getElementById('totalWinsMobile');
    const winRateMobile = document.getElementById('winRateMobile');

    if (totalTeamsMobile) totalTeamsMobile.textContent = Object.keys(teamsData).length;
    if (totalMatchesMobile) totalMatchesMobile.textContent = allMatches.length;
    if (totalWinsMobile) totalWinsMobile.textContent = totalWins;
    if (winRateMobile) winRateMobile.textContent = overallWinRate + '%';
}

/**
 * Populate filter dropdowns
 */
function populateFilters() {
    const teams = [...new Set(Object.keys(teamsData))].sort();

    const teamSelect = document.getElementById('filterTeam');
    teamSelect.innerHTML = '<option value="">Tutte le squadre</option>';
    teams.forEach(team => {
        const option = document.createElement('option');
        option.value = team;
        option.textContent = team;
        teamSelect.appendChild(option);
    });
}

// ==================== Rendering Functions ====================

/**
 * Render all dashboard components
 */
function renderAll() {
    renderTodaysMatches();
    renderQuickStats();
    renderInsights();
    renderLeaderboard();
    renderRecentMatches();
    renderTeams();
    applyFilters();
    renderMatches();
    renderCharts();
    renderDetailedInsights();
}

/**
 * Render quick stats cards
 */
function renderQuickStats() {
    const container = document.getElementById('quickStats');
    const totalPlayed = Object.values(teamsData).reduce((sum, t) => sum + t.played, 0);
    const totalWins = Object.values(teamsData).reduce((sum, t) => sum + t.wins, 0);
    const totalSetsWon = Object.values(teamsData).reduce((sum, t) => sum + t.setsWon, 0);
    const totalSetsLost = Object.values(teamsData).reduce((sum, t) => sum + t.setsLost, 0);
    const totalSets = totalSetsWon + totalSetsLost;
    const totalPoints = Object.values(teamsData).reduce((sum, t) => sum + t.pointsScored, 0);
    const avgPointsPerSet = totalSets > 0 ? Math.round(totalPoints / totalSets) : 0;

    const bestTeam = Object.values(teamsData)
        .filter(t => t.played > 0)
        .sort((a, b) => (b.wins / b.played) - (a.wins / a.played))[0];

    container.innerHTML = `
        <div class="quick-stat-card">
            <div class="quick-stat-icon">🎯</div>
            <div class="quick-stat-value">${totalWins}/${totalPlayed}</div>
            <div class="quick-stat-label">Vittorie Totali</div>
        </div>
        <div class="quick-stat-card">
            <div class="quick-stat-icon">📊</div>
            <div class="quick-stat-value">${totalSetsWon}</div>
            <div class="quick-stat-label">Set Vinti</div>
        </div>
        <div class="quick-stat-card">
            <div class="quick-stat-icon">⚡</div>
            <div class="quick-stat-value">${avgPointsPerSet}</div>
            <div class="quick-stat-label">Punti/Set (avg)</div>
        </div>
        <div class="quick-stat-card">
            <div class="quick-stat-icon">🏆</div>
            <div class="quick-stat-value">${bestTeam ? Math.round((bestTeam.wins / bestTeam.played) * 100) : 0}%</div>
            <div class="quick-stat-label">Miglior Win Rate</div>
        </div>
    `;
}

/**
 * Render insights cards
 */
function renderInsights() {
    const container = document.getElementById('insightsGrid');
    const teams = Object.values(teamsData).filter(t => t.played > 0);

    const bestHome = teams.sort((a, b) => b.homeWins - a.homeWins)[0];
    const bestAway = teams.sort((a, b) => b.awayWins - a.awayWins)[0];
    const longestStreak = teams.sort((a, b) => b.longestWinStreak - a.longestWinStreak)[0];
    const bestSetRatio = teams.sort((a, b) =>
        (b.setsWon / (b.setsWon + b.setsLost)) - (a.setsWon / (a.setsWon + a.setsLost))
    )[0];

    container.innerHTML = `
        <div class="insight-card">
            <div class="insight-icon">🏠</div>
            <div class="insight-title">Migliori in Casa</div>
            <div class="insight-value">${bestHome?.homeWins || 0} vittorie</div>
            <div class="insight-description">${bestHome?.name || 'N/A'}</div>
        </div>
        <div class="insight-card" style="background: linear-gradient(135deg, #00C853, #00A844);">
            <div class="insight-icon">✈️</div>
            <div class="insight-title">Migliori in Trasferta</div>
            <div class="insight-value">${bestAway?.awayWins || 0} vittorie</div>
            <div class="insight-description">${bestAway?.name || 'N/A'}</div>
        </div>
        <div class="insight-card" style="background: linear-gradient(135deg, #FFB300, #FF8F00);">
            <div class="insight-icon">🔥</div>
            <div class="insight-title">Striscia Più Lunga</div>
            <div class="insight-value">${longestStreak?.longestWinStreak || 0} vittorie</div>
            <div class="insight-description">${longestStreak?.name || 'N/A'}</div>
        </div>
        <div class="insight-card" style="background: linear-gradient(135deg, #9C27B0, #7B1FA2);">
            <div class="insight-icon">📈</div>
            <div class="insight-title">Miglior Rapporto Set</div>
            <div class="insight-value">${bestSetRatio ? Math.round((bestSetRatio.setsWon / (bestSetRatio.setsWon + bestSetRatio.setsLost)) * 100) : 0}%</div>
            <div class="insight-description">${bestSetRatio?.name || 'N/A'}</div>
        </div>
    `;
}

/**
 * Render leaderboard
 */
function renderLeaderboard() {
    const container = document.getElementById('leaderboardList');
    const teams = Object.values(teamsData)
        .filter(t => t.played > 0)
        .sort((a, b) => (b.wins / b.played) - (a.wins / a.played))
        .slice(0, 5);

    container.innerHTML = teams.map((team, index) => {
        const winRate = Math.round((team.wins / team.played) * 100);
        const rankClass = index === 0 ? 'gold' : index === 1 ? 'silver' : index === 2 ? 'bronze' : '';

        return `
            <div class="leaderboard-item" onclick="showTeamDetail('${team.name}')">
                <div class="leaderboard-rank ${rankClass}">${index + 1}</div>
                <div class="leaderboard-info">
                    <div class="leaderboard-name">${team.name}</div>
                    <div class="leaderboard-stats">${team.wins}V - ${team.losses}P • ${team.played} partite</div>
                </div>
                <div class="leaderboard-value">${winRate}%</div>
            </div>
        `;
    }).join('');
}

/**
 * Render recent matches
 */
/**
 * Render recent matches
 */
function renderRecentMatches() {
    const container = document.getElementById('recentMatchesList');
    const recent = [...allMatches]
        .filter(m => m.StatoDescrizione !== 'Da disputare' && m.Risultato)
        .sort((a, b) => parseDate(b.Data) - parseDate(a.Data))
        .slice(0, 5);

    container.innerHTML = recent.map(match => createMatchCardHTML(match)).join('');
}

/**
 * Render today's matches section
 */
function renderTodaysMatches() {
    const section = document.getElementById('todaysMatchesSection');
    const container = document.getElementById('todaysMatchesList');

    // Get today's date
    const today = new Date();

    // Find matches scheduled for today
    const todaysMatches = allMatches.filter(match => {
        if (!match.Data) return false;
        const matchDate = parseDate(match.Data);
        return matchDate.toDateString() === today.toDateString();
    });

    // Hide section if no matches today
    if (todaysMatches.length === 0) {
        section.style.display = 'none';
        return;
    }

    section.style.display = 'block';

    // Sort by time
    const sorted = todaysMatches.sort((a, b) => {
        const timeA = a.Ora || '23:59';
        const timeB = b.Ora || '23:59';
        return timeA.localeCompare(timeB);
    });

    container.innerHTML = sorted.map(match => createTodayMatchCardHTML(match)).join('');
}

function createTodayMatchCardHTML(match) {
    const now = new Date();
    const matchDate = parseDate(match.Data);

    // Parse time (assuming format HH:MM)
    const timeParts = (match.Ora || '00:00').split(':');
    const matchTime = new Date(matchDate);
    matchTime.setHours(parseInt(timeParts[0]), parseInt(timeParts[1]), 0, 0);

    // Calculate time differences in milliseconds
    const tenMinutesBefore = new Date(matchTime.getTime() - 10 * 60 * 1000);
    const twoHoursAfter = new Date(matchTime.getTime() + 2 * 60 * 60 * 1000);

    // Determine if match is live
    const isLive = now >= tenMinutesBefore && now <= twoHoursAfter;
    const isCompleted = match.StatoDescrizione === 'gara omologata' || match.StatoDescrizione === 'risultato ufficioso';

    // Helper function to check if team matches config patterns
    const isTeamMatch = (teamName) => {
        if (!teamName || !config) return false;
        const normalized = String(teamName).toUpperCase().replace(/\s+/g, ' ');
        return config.team.matchPatterns.some(pattern => {
            const patternNormalized = pattern.toUpperCase().replace(/\s+/g, ' ');
            return normalized.includes(patternNormalized);
        });
    };

    const isRmHome = isTeamMatch(match.SquadraCasa);
    const isRmAway = isTeamMatch(match.SquadraOspite);

    let homeScore = '';
    let awayScore = '';
    let homeWinner = false;
    let awayWinner = false;

    if (match.Risultato && match.Risultato.includes('-')) {
        const [homeSets, awaySets] = match.Risultato.split('-').map(s => parseInt(s.trim()));
        homeScore = homeSets;
        awayScore = awaySets;
        homeWinner = homeSets > awaySets;
        awayWinner = awaySets > homeSets;
    }

    // Compact horizontal design
    return `
        <div class="today-match-card ${isLive && !isCompleted ? 'today-match-live' : ''}">
            <div class="today-match-header">
                <div class="today-match-time">
                    <span class="time-icon">🕐</span>
                    <span class="time-text">${match.Ora || 'TBD'}</span>
                </div>
                ${isLive && !isCompleted ? '<div class="today-live-badge"><span class="today-live-dot"></span>LIVE</div>' : ''}
            </div>
            <div class="today-match-body">
                <div class="today-team-box ${isRmHome ? 'today-rm-team' : ''}">
                    <div class="today-team-name">${match.SquadraCasa || 'TBD'}</div>
                    ${homeScore !== '' ? `<div class="today-team-score ${homeWinner ? 'score-winner' : ''}">${homeScore}</div>` : ''}
                </div>
                <div class="today-match-vs">
                    <div class="vs-circle">VS</div>
                </div>
                <div class="today-team-box ${isRmAway ? 'today-rm-team' : ''}">
                    <div class="today-team-name">${match.SquadraOspite || 'TBD'}</div>
                    ${awayScore !== '' ? `<div class="today-team-score ${awayWinner ? 'score-winner' : ''}">${awayScore}</div>` : ''}
                </div>
            </div>
            <div class="today-match-footer">
                <a href="https://maps.google.com/?q=${encodeURIComponent(match.Impianto || '')}" 
                   target="_blank" 
                   rel="noopener noreferrer"
                   class="today-venue-link">
                    <span class="today-venue-icon">📍</span>
                    <span class="today-venue-text">${match.Impianto || 'TBD'}</span>
                </a>
            </div>
        </div>
    `;
}

/**
 * Render Standings Table
 */
function renderStandings(leagueName) {
    const tbody = document.getElementById('standingsBody');
    const lastUpdate = document.getElementById('standingsLastUpdate');
    const data = standingsData[leagueName];

    if (lastUpdate) {
        const now = new Date();
        lastUpdate.textContent = `Aggiornato: ${now.toLocaleDateString()} ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    }

    if (!data || data.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" class="text-center py-4">
                    <div class="empty-state-small">
                        <span>⚠️</span> Dati classifica non disponibili
                    </div>
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = data.map((team, index) => {
        const rankClass = index === 0 ? 'rank-1' :
            index === 1 ? 'rank-2' :
                index === 2 ? 'rank-3' : '';

        const isRm = team.Squadra && config && config.team.matchPatterns.some(pattern => {
            return team.Squadra.toUpperCase().includes(pattern.toUpperCase());
        });
        const rowClass = isRm ? 'highlight-row' : '';

        return `
            <tr class="${rowClass}">
                <td class="text-center">
                    <div class="rank-badge ${rankClass}">${team['Pos.']}</div>
                </td>
                <td class="team-cell">
                    <div class="team-name-standings">${team.Squadra}</div>
                </td>
                <td class="text-center font-bold">${team.Punti}</td>
                <td class="text-center">${team.PG}</td>
                <td class="text-center">${team.PV}</td>
                <td class="text-center">${team.PP}</td>
                <td class="text-center mobile-hide">${team.SF}</td>
                <td class="text-center mobile-hide">${team.SS}</td>
            </tr>
        `;
    }).join('');
}

/**
 * Render teams grid
 */
function renderTeams() {
    const grid = document.getElementById('teamsGrid');
    const teams = Object.values(teamsData).sort((a, b) => {
        const rateA = a.played > 0 ? a.wins / a.played : 0;
        const rateB = b.played > 0 ? b.wins / b.played : 0;
        return rateB - rateA;
    });

    grid.innerHTML = teams.map(team => {
        const winRate = team.played > 0 ? Math.round((team.wins / team.played) * 100) : 0;
        const badge = getTeamBadge(team);
        const toPlay = team.totalMatches - team.played;
        const setRatio = team.setsWon + team.setsLost > 0 ?
            (team.setsWon / (team.setsWon + team.setsLost) * 100).toFixed(0) : 0;

        return `
            <div class="team-card" onclick="showTeamDetail('${team.name}')">
                <div class="team-header">
                    <div>
                        <div class="team-name">${team.name}</div>
                        <div class="team-category">${team.category}</div>
                    </div>
                    <div class="team-badge">${badge}</div>
                </div>
                <div class="team-stats-row">
                    <div class="stat-box">
                        <div class="stat-box-value">${team.wins}</div>
                        <div class="stat-box-label">Vittorie</div>
                    </div>
                    <div class="stat-box">
                        <div class="stat-box-value">${team.losses}</div>
                        <div class="stat-box-label">Sconfitte</div>
                    </div>
                    <div class="stat-box">
                        <div class="stat-box-value">${toPlay}</div>
                        <div class="stat-box-label">Da giocare</div>
                    </div>
                    <div class="stat-box">
                        <div class="stat-box-value">${setRatio}%</div>
                        <div class="stat-box-label">Set %</div>
                    </div>
                </div>
                <div class="performance-indicators">
                    ${team.recentForm.map(f =>
            `<span class="indicator"><span class="indicator-icon">${f === 'W' ? '✅' : '❌'}</span></span>`
        ).join('')}
                    ${team.currentStreak !== 0 ? `
                        <span class="indicator">
                            <span class="indicator-icon">${team.currentStreak > 0 ? '🔥' : '❄️'}</span>
                            ${Math.abs(team.currentStreak)}
                        </span>
                    ` : ''}
                </div>
                <div class="win-rate-bar">
                    <div class="win-rate-fill" style="width: ${winRate}%"></div>
                </div>
                <div class="win-rate-label">
                    <span>Win Rate</span>
                    <span><strong>${winRate}%</strong></span>
                </div>
            </div>
        `;
    }).join('');
}

/**
 * Apply filters to matches
 */
function applyFilters() {
    const teamFilter = document.getElementById('filterTeam').value;
    const statusFilter = document.getElementById('filterStatus').value;
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();

    filteredMatches = allMatches.filter(match => {
        const matchTeam = teamFilter ?
            (match.SquadraCasa === teamFilter || match.SquadraOspite === teamFilter) : true;
        const matchStatus = statusFilter ? match.StatoDescrizione === statusFilter : true;
        const matchSearch = searchTerm ?
            (match.SquadraCasa?.toLowerCase().includes(searchTerm) ||
                match.SquadraOspite?.toLowerCase().includes(searchTerm) ||
                match.Impianto?.toLowerCase().includes(searchTerm)) : true;

        return matchTeam && matchStatus && matchSearch;
    });

    document.getElementById('matchesSubtitle').textContent =
        `${filteredMatches.length} partite trovate`;
}

/**
 * Render filtered matches
 */
function renderMatches() {
    const list = document.getElementById('matchesList');

    if (filteredMatches.length === 0) {
        list.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">🏐</div>
                <h3>Nessuna partita</h3>
                <p>Prova a modificare i filtri</p>
            </div>
        `;
        return;
    }

    // Sort based on status filter
    const statusFilter = document.getElementById('filterStatus').value;

    const sorted = [...filteredMatches].sort((a, b) => {
        if (statusFilter === 'da disputare') {
            // Ascending for future matches (upcoming first)
            return parseDate(a.Data) - parseDate(b.Data);
        } else {
            // Descending for everything else (most recent first)
            return parseDate(b.Data) - parseDate(a.Data);
        }
    });

    list.innerHTML = sorted.map(match => createMatchCardHTML(match)).join('');
}

/**
 * Create match card HTML
 */
function createMatchCardHTML(match) {
    const date = parseDate(match.Data);
    const day = date.getDate();
    const month = date.toLocaleDateString('it-IT', { month: 'short' });

    // Helper function to check if team matches config patterns
    const isTeamMatch = (teamName) => {
        if (!teamName || !config) return false;
        const normalized = String(teamName).toUpperCase().replace(/\s+/g, ' ');
        return config.team.matchPatterns.some(pattern => {
            const patternNormalized = pattern.toUpperCase().replace(/\s+/g, ' ');
            return normalized.includes(patternNormalized);
        });
    };

    const isRmHome = isTeamMatch(match.SquadraCasa);
    const isRmAway = isTeamMatch(match.SquadraOspite);

    let statusClass = 'status-upcoming';
    let statusText = 'Da giocare';

    if (match.StatoDescrizione === 'gara omologata') {
        statusClass = 'status-played';
        statusText = 'Completata';
    } else if (match.StatoDescrizione === 'risultato ufficioso') {
        statusClass = 'status-unofficial';
        statusText = 'Non ufficiale';
    }

    let homeScore = '';
    let awayScore = '';
    let homeWinner = false;
    let awayWinner = false;
    let setsHtml = '';

    if (match.Risultato && match.Risultato.includes('-')) {
        const [homeSets, awaySets] = match.Risultato.split('-').map(s => parseInt(s.trim()));
        homeScore = homeSets;
        awayScore = awaySets;
        homeWinner = homeSets > awaySets;
        awayWinner = awaySets > homeSets;

        if (match.Parziali) {
            const sets = match.Parziali.split(' ').filter(s => s.trim());
            setsHtml = `
                <div class="sets-detail">
                    ${sets.map(set => `<span class="set-score">${set}</span>`).join('')}
                </div>
            `;
        }
    }

    return `
        <div class="match-card">
            <div class="match-header">
                <div class="match-meta">
                    <div class="match-date">
                        <div class="match-day">${day}</div>
                        <div class="match-month">${month}</div>
                    </div>
                    <div class="match-info">
                        <div class="match-championship">${match.Campionato || 'N/A'}</div>
                        <div class="match-time">⏰ ${match.Ora || 'TBD'}</div>
                    </div>
                </div>
                <div class="match-status ${statusClass}">${statusText}</div>
            </div>
            <div class="match-teams">
                <div class="team home ${isRmHome ? 'rm' : ''}">
                    <div class="team-logo">${isRmHome ? '🏐' : getTeamInitials(match.SquadraCasa)}</div>
                    <div class="team-details">
                        <div class="team-name-match">${match.SquadraCasa || 'TBD'}</div>
                    </div>
                    ${homeScore !== '' ? `<div class="score-inline ${homeWinner ? 'winner' : ''}">${homeScore}</div>` : ''}
                </div>
                <div class="team away ${isRmAway ? 'rm' : ''}">
                    <div class="team-logo">${isRmAway ? '🏐' : getTeamInitials(match.SquadraOspite)}</div>
                    <div class="team-details">
                        <div class="team-name-match">${match.SquadraOspite || 'TBD'}</div>
                    </div>
                    ${awayScore !== '' ? `<div class="score-inline ${awayWinner ? 'winner' : ''}">${awayScore}</div>` : ''}
                </div>
            </div>
            ${setsHtml}
            <div class="match-venue">
                <a href="https://maps.google.com/?q=${encodeURIComponent(match.Impianto || '')}" 
                   target="_blank" 
                   rel="noopener noreferrer"
                   style="color: inherit; text-decoration: none; display: block;"
                   onclick="event.stopPropagation();">
                    📍 ${match.Impianto || 'Impianto TBD'}
                </a>
            </div>
        </div>
    `;
}

/**
 * Get team initials for logo
 */
function getTeamInitials(teamName) {
    if (!teamName) return '?';
    const words = teamName.split(' ').filter(w => w.length > 2);
    if (words.length >= 2) {
        return words[0][0] + words[1][0];
    }
    return teamName.substring(0, 2).toUpperCase();
}

/**
 * Parse date string to Date object
 */
function parseDate(dateStr) {
    if (!dateStr) return new Date();
    const [day, month, year] = dateStr.split('/');
    return new Date(year, month - 1, day);
}

/**
 * Render charts
 */
function renderCharts() {
    // Destroy existing charts
    Object.values(chartInstances).forEach(chart => chart.destroy());
    chartInstances = {};

    const teams = Object.values(teamsData).filter(t => t.played > 0);

    // Wins Chart
    const winsCtx = document.getElementById('winsChart');
    chartInstances.wins = new Chart(winsCtx, {
        type: 'bar',
        data: {
            labels: teams.map(t => t.name.split(' ')[0]),
            datasets: [{
                label: 'Vittorie',
                data: teams.map(t => t.wins),
                backgroundColor: 'rgba(0, 102, 255, 0.8)',
                borderRadius: 8,
                borderWidth: 0
            }, {
                label: 'Sconfitte',
                data: teams.map(t => t.losses),
                backgroundColor: 'rgba(255, 61, 0, 0.6)',
                borderRadius: 8,
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'bottom',
                    labels: {
                        padding: 15,
                        font: {
                            size: 12,
                            weight: '600'
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { stepSize: 1 },
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)'
                    }
                },
                x: {
                    grid: {
                        display: false
                    }
                }
            }
        }
    });

    // Win Rate Chart
    const winRateCtx = document.getElementById('winRateChart');
    chartInstances.winRate = new Chart(winRateCtx, {
        type: 'doughnut',
        data: {
            labels: teams.map(t => t.name.split(' ')[0]),
            datasets: [{
                data: teams.map(t => Math.round((t.wins / t.played) * 100)),
                backgroundColor: [
                    'rgba(0, 102, 255, 0.8)',
                    'rgba(0, 212, 255, 0.8)',
                    'rgba(0, 200, 83, 0.8)',
                    'rgba(255, 179, 0, 0.8)',
                    'rgba(255, 61, 0, 0.8)',
                    'rgba(156, 39, 176, 0.8)'
                ],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'bottom',
                    labels: {
                        padding: 15,
                        font: {
                            size: 12,
                            weight: '600'
                        }
                    }
                },
                tooltip: {
                    callbacks: {
                        label: (context) => context.label + ': ' + context.parsed + '%'
                    }
                }
            }
        }
    });

    // Championship Chart
    const champCtx = document.getElementById('championshipChart');
    const champCounts = {};
    allMatches.forEach(match => {
        const champ = match.Campionato ? String(match.Campionato).trim() : 'Sconosciuto';
        champCounts[champ] = (champCounts[champ] || 0) + 1;
    });

    const champEntries = Object.entries(champCounts).sort((a, b) => b[1] - a[1]);
    const champLabels = champEntries.map(e => e[0]);
    const champData = champEntries.map(e => e[1]);

    chartInstances.championship = new Chart(champCtx, {
        type: 'bar',
        data: {
            labels: champLabels,
            datasets: [{
                label: 'Partite',
                data: champData,
                backgroundColor: 'rgba(0, 102, 255, 0.8)',
                borderRadius: 8,
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { stepSize: 1 },
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)'
                    }
                },
                x: {
                    grid: {
                        display: false
                    }
                }
            }
        }
    });

    // Sets Chart
    const setsCtx = document.getElementById('setsChart');
    chartInstances.sets = new Chart(setsCtx, {
        type: 'bar',
        data: {
            labels: teams.map(t => t.name.split(' ')[0]),
            datasets: [{
                label: 'Set Vinti',
                data: teams.map(t => t.setsWon),
                backgroundColor: 'rgba(0, 200, 83, 0.8)',
                borderRadius: 8,
                borderWidth: 0
            }, {
                label: 'Set Persi',
                data: teams.map(t => t.setsLost),
                backgroundColor: 'rgba(255, 61, 0, 0.6)',
                borderRadius: 8,
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'bottom',
                    labels: {
                        padding: 15,
                        font: {
                            size: 12,
                            weight: '600'
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)'
                    }
                },
                x: {
                    grid: {
                        display: false
                    }
                }
            }
        }
    });
}

/**
 * Render detailed insights
 */
function renderDetailedInsights() {
    const container = document.getElementById('detailedInsights');
    const teams = Object.values(teamsData).filter(t => t.played > 0);

    const totalPoints = teams.reduce((sum, t) => sum + t.pointsScored, 0);
    const totalSets = teams.reduce((sum, t) => sum + t.setsWon + t.setsLost, 0);
    const totalPlayed = teams.reduce((sum, t) => sum + t.played, 0);
    const avgPointsPerMatch = totalPlayed > 0 ? (totalPoints / totalPlayed).toFixed(1) : 0;

    container.innerHTML = `
        <div class="chart-card" style="margin-bottom: 1rem;">
            <h3 class="chart-title">📊 Analisi Dettagliata</h3>
            <div style="padding: 1rem 0;">
                <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem;">
                    <div class="stat-detail-card">
                        <div class="stat-detail-value">${totalPoints}</div>
                        <div class="stat-detail-label">Punti Totali</div>
                    </div>
                    <div class="stat-detail-card">
                        <div class="stat-detail-value">${totalSets}</div>
                        <div class="stat-detail-label">Set Totali</div>
                    </div>
                    <div class="stat-detail-card">
                        <div class="stat-detail-value">${avgPointsPerMatch}</div>
                        <div class="stat-detail-label">Punti/Partita</div>
                    </div>
                    <div class="stat-detail-card">
                        <div class="stat-detail-value">${totalPlayed > 0 ? (totalSets / totalPlayed).toFixed(1) : 0}</div>
                        <div class="stat-detail-label">Set/Partita</div>
                    </div>
                </div>
            </div>
        </div>

        ${teams.map(team => {
        const winRate = Math.round((team.wins / team.played) * 100);
        const setRate = Math.round((team.setsWon / (team.setsWon + team.setsLost)) * 100);
        const totalTeamSets = team.setsWon + team.setsLost;
        const avgPoints = totalTeamSets > 0 ? (team.pointsScored / totalTeamSets).toFixed(1) : 0;

        return `
                <div class="chart-card" style="margin-bottom: 1rem;">
                    <h3 class="chart-title">${team.name}</h3>
                    <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 0.75rem; margin-bottom: 1rem;">
                        <div class="stat-detail-card">
                            <div class="stat-detail-value">${winRate}%</div>
                            <div class="stat-detail-label">Win Rate</div>
                        </div>
                        <div class="stat-detail-card">
                            <div class="stat-detail-value">${setRate}%</div>
                            <div class="stat-detail-label">Set Rate</div>
                        </div>
                        <div class="stat-detail-card">
                            <div class="stat-detail-value">${avgPoints}</div>
                            <div class="stat-detail-label">Punti/Set</div>
                        </div>
                        <div class="stat-detail-card">
                            <div class="stat-detail-value">${team.longestWinStreak}</div>
                            <div class="stat-detail-label">Striscia Max</div>
                        </div>
                    </div>
                    <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                        <div class="indicator">
                            <span class="indicator-icon">🏠</span>
                            <span>${team.homeWins}V - ${team.homeLosses}P</span>
                        </div>
                        <div class="indicator">
                            <span class="indicator-icon">✈️</span>
                            <span>${team.awayWins}V - ${team.awayLosses}P</span>
                        </div>
                        ${team.currentStreak !== 0 ? `
                            <div class="indicator">
                                <span class="indicator-icon">${team.currentStreak > 0 ? '🔥' : '❄️'}</span>
                                <span>Serie di ${Math.abs(team.currentStreak)}</span>
                            </div>
                        ` : ''}
                    </div>
                </div>
            `;
    }).join('')}
    `;
}

/**
 * Show team detail modal
 */
function showTeamDetail(teamName) {
    const team = teamsData[teamName];
    if (!team) return;

    const modal = document.getElementById('teamModal');
    const modalBody = document.getElementById('modalBody');
    document.getElementById('modalTeamName').textContent = team.name;

    const winRate = team.played > 0 ? Math.round((team.wins / team.played) * 100) : 0;
    const setRate = team.setsWon + team.setsLost > 0 ?
        Math.round((team.setsWon / (team.setsWon + team.setsLost)) * 100) : 0;
    const totalTeamSets = team.setsWon + team.setsLost;
    const avgPoints = totalTeamSets > 0 ? (team.pointsScored / totalTeamSets).toFixed(1) : 0;

    modalBody.innerHTML = `
        <div class="detail-section">
            <h3 class="detail-section-title">📊 Statistiche Generali</h3>
            <div class="stats-grid">
                <div class="stat-detail-card">
                    <div class="stat-detail-value">${team.wins}</div>
                    <div class="stat-detail-label">Vittorie</div>
                </div>
                <div class="stat-detail-card">
                    <div class="stat-detail-value">${team.losses}</div>
                    <div class="stat-detail-label">Sconfitte</div>
                </div>
                <div class="stat-detail-card">
                    <div class="stat-detail-value">${winRate}%</div>
                    <div class="stat-detail-label">Win Rate</div>
                </div>
                <div class="stat-detail-card">
                    <div class="stat-detail-value">${team.setsWon}</div>
                    <div class="stat-detail-label">Set Vinti</div>
                </div>
                <div class="stat-detail-card">
                    <div class="stat-detail-value">${team.setsLost}</div>
                    <div class="stat-detail-label">Set Persi</div>
                </div>
                <div class="stat-detail-card">
                    <div class="stat-detail-value">${setRate}%</div>
                    <div class="stat-detail-label">Set Rate</div>
                </div>
                <div class="stat-detail-card">
                    <div class="stat-detail-value">${avgPoints}</div>
                    <div class="stat-detail-label">Punti/Set</div>
                </div>
                <div class="stat-detail-card">
                    <div class="stat-detail-value">${team.longestWinStreak}</div>
                    <div class="stat-detail-label">Striscia Max</div>
                </div>
                <div class="stat-detail-card">
                    <div class="stat-detail-value">${team.homeWins}V</div>
                    <div class="stat-detail-label">Casa</div>
                </div>
                <div class="stat-detail-card">
                    <div class="stat-detail-value">${team.awayWins}V</div>
                    <div class="stat-detail-label">Trasferta</div>
                </div>
            </div>
        </div>

        <div class="detail-section">
            <h3 class="detail-section-title">📅 Ultime Partite</h3>
            <div class="match-timeline">
                ${team.matches
            .filter(m => m.StatoDescrizione !== 'Da disputare' && m.Risultato)
            .sort((a, b) => parseDate(b.Data) - parseDate(a.Data))
            .slice(0, 10)
            .map(match => {
                const date = parseDate(match.Data);
                const dateStr = date.toLocaleDateString('it-IT');
                const opponent = match.isHome ? match.SquadraOspite : match.SquadraCasa;
                const result = match.Risultato || 'Da disputare';

                let dotClass = '';
                let resultText = result;

                if (result.includes('-')) {
                    const [s1, s2] = result.split('-').map(s => parseInt(s.trim()));
                    const won = match.isHome ? (s1 > s2) : (s2 > s1);
                    dotClass = won ? 'win' : 'loss';
                    resultText = won ? `✅ ${result}` : `❌ ${result}`;
                }

                return `
                        <div class="timeline-item">
                            <div class="timeline-dot ${dotClass}"></div>
                            <div class="timeline-content">
                                <div class="timeline-date">${dateStr}</div>
                                <div class="timeline-match">${match.isHome ? 'vs' : '@'} ${opponent}</div>
                                <div class="timeline-score">${resultText}</div>
                            </div>
                        </div>
                    `;
            }).join('')}
            </div>
        </div>
    `;

    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

/**
 * Close team modal
 */
function closeTeamModal() {
    document.getElementById('teamModal').classList.remove('active');
    document.body.style.overflow = '';
}

// ==================== Event Listeners ====================

/**
 * Initialize event listeners
 */
function initializeEventListeners() {
    // Tab navigation - support both desktop (.nav-tab) and iOS (.ios-tab)
    const tabSelectors = ['.nav-tab', '.ios-tab'];

    tabSelectors.forEach(selector => {
        document.querySelectorAll(selector).forEach(tab => {
            tab.addEventListener('click', () => {
                const tabName = tab.dataset.tab;

                // Ignore login/logout tabs (handled separately)
                if (tabName === 'login' || tabName === 'logout') return;

                // Update active tab for both navigation types
                tabSelectors.forEach(sel => {
                    document.querySelectorAll(sel).forEach(t => {
                        if (t.dataset.tab === tabName) {
                            t.classList.add('active');
                            t.setAttribute('aria-selected', 'true');
                        } else {
                            t.classList.remove('active');
                            t.setAttribute('aria-selected', 'false');
                        }
                    });
                });

                // Show corresponding content
                document.querySelectorAll('.tab-content').forEach(content => {
                    const shouldShow = content.id === (tabName + '-tab');
                    content.classList.toggle('active', shouldShow);
                    content.style.display = shouldShow ? 'block' : 'none';
                });

                // Update iOS large title
                const largeTitle = document.getElementById('largeTitle');
                if (largeTitle) {
                    const titleMap = {
                        'overview': 'Panoramica',
                        'teams': 'Squadre',
                        'matches': 'Partite',
                        'stats': 'Statistiche',
                        'insights': 'Insights'
                    };
                    largeTitle.textContent = titleMap[tabName] || 'RM Volley';
                }

                currentTab = tabName;

                // Reset scroll to top when changing tabs on mobile
                if (window.innerWidth <= 768) {
                    window.scrollTo(0, 0);
                }
            });
        });
    });

    // Filter event listeners
    document.getElementById('filterTeam').addEventListener('change', () => {
        applyFilters();
        renderMatches();
    });
    document.getElementById('filterStatus').addEventListener('change', () => {
        applyFilters();
        renderMatches();
    });
    document.getElementById('searchInput').addEventListener('input', () => {
        applyFilters();
        renderMatches();
    });

    // Pull to refresh functionality
    let startY = 0;
    let isPulling = false;

    document.addEventListener('touchstart', (e) => {
        if (window.scrollY === 0) {
            startY = e.touches[0].pageY;
            isPulling = false;
        }
    });

    document.addEventListener('touchmove', (e) => {
        if (window.scrollY === 0 && startY > 0) {
            const currentY = e.touches[0].pageY;
            const pullDistance = currentY - startY;

            if (pullDistance > 0 && pullDistance < 100) {
                isPulling = true;
                const indicator = document.getElementById('pullIndicator');
                indicator.style.opacity = Math.min(pullDistance / 100, 1);
                indicator.style.transform = `translateY(${Math.min(pullDistance, 80)}px)`;
            }
        }
    });

    document.addEventListener('touchend', () => {
        const indicator = document.getElementById('pullIndicator');
        if (isPulling) {
            indicator.style.opacity = '0';
            indicator.style.transform = 'translateY(-100%)';
            location.reload();
        }
        isPulling = false;
        startY = 0;
    });

    // iOS Large Title scroll behavior
    let lastScrollTop = 0;
    const navTabs = document.querySelector('.nav-tabs');
    const iosNavbar = document.querySelector('.ios-navbar');

    window.addEventListener('scroll', () => {
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;

        // iOS large title collapse behavior
        if (iosNavbar && window.innerWidth <= 768) {
            if (scrollTop > 50) {
                iosNavbar.classList.add('scrolled');
            } else {
                iosNavbar.classList.remove('scrolled');
            }
        }

        // Old navigation hiding behavior (for desktop if needed)
        if (navTabs && window.innerWidth <= 639) {
            if (scrollTop > lastScrollTop && scrollTop > 100) {
                // Scrolling down
                navTabs.classList.add('hidden');
            } else {
                // Scrolling up
                navTabs.classList.remove('hidden');
            }
        }

        lastScrollTop = scrollTop <= 0 ? 0 : scrollTop;
    }, false);
}




// ==================== Initialization ====================

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    initializeEventListeners();
    loadExcelFile();
});

// Make closeTeamModal available globally
window.closeTeamModal = closeTeamModal;
window.showTeamDetail = showTeamDetail;
