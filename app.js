// ====================================
// RM Volley Dashboard
// ====================================

import { debounce, throttleRAF, processInChunks, deepEqual } from './utils.js';

// ==================== Global State ====================
let allMatches = [];
let filteredMatches = [];
let teamsData = {};
let currentTab = 'home';
let chartInstances = {};
let standingsData = {};
let config = null;
let firebaseDatabase = null;
let lastChartData = null;

// ==================== Data Loading ====================

async function loadConfig() {
    try {
        const response = await fetch('config.json');
        if (!response.ok) throw new Error('Config file not found');
        config = await response.json();
        return config;
    } catch (error) {
        document.getElementById('loading').innerHTML = `
            <div class="empty-icon">⚠️</div>
            <h3>Errore Configurazione</h3>
            <p>File config.json non trovato o non valido</p>
        `;
        throw error;
    }
}

async function loadExcelFile() {
    try {
        await loadConfig();

        try {
            const firebaseConfigModule = await import('./firebase-config.js');
            const firebaseConfig = firebaseConfigModule.default;
            if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
            firebaseDatabase = firebase.database();
        } catch (error) {
            console.warn('Firebase not configured:', error.message);
        }

        const response = await fetch('Gare.xls');
        const arrayBuffer = await response.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(firstSheet);

        allMatches = data;
        await processData();
        renderAll();
        loadStandings();

        document.getElementById('loading').style.display = 'none';
        document.querySelectorAll('.tab-content').forEach(tab => {
            if (tab.id === 'home-tab') tab.style.display = 'block';
        });

    } catch (error) {
        console.error('Error loading Excel file:', error);
        document.getElementById('loading').innerHTML = `
            <div class="empty-icon">⚠️</div>
            <h3>Errore nel caricamento</h3>
            <p>Assicurati che Gare.xls sia disponibile</p>
        `;
    }
}

async function loadStandings() {
    try {
        const response = await fetch('classifica.json');
        if (!response.ok) throw new Error('Classifica not found');
        standingsData = await response.json();

        populateLeagueSelector();

        const leagues = Object.keys(standingsData);
        if (leagues.length > 0) {
            const defaultLeague = leagues.find(l => l.includes('Serie D')) || leagues[0];
            document.getElementById('leagueSelect').value = defaultLeague;
            renderStandings(defaultLeague);
        }

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

async function processData() {
    teamsData = {};
    const rmTeams = new Set();

    function isRmTeam(name) {
        if (!name || !config) return false;
        const normalized = String(name).toUpperCase().replace(/\s+/g, ' ');
        return config.team.matchPatterns.some(pattern =>
            normalized.includes(pattern.toUpperCase().replace(/\s+/g, ' '))
        );
    }

    allMatches.forEach(match => {
        if (isRmTeam(match.SquadraCasa)) rmTeams.add(match.SquadraCasa);
        if (isRmTeam(match.SquadraOspite)) rmTeams.add(match.SquadraOspite);
    });

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
            longestWinStreak: 0,
            currentStreak: 0,
            recentForm: []
        };
    });

    await processInChunks(allMatches, (matchChunk) => {
        matchChunk.forEach(match => {
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
    }, 50);

    Object.values(teamsData).forEach(team => {
        team.recentForm = team.recentForm.slice(-5);
        team.matches.sort((a, b) => parseDate(b.Data) - parseDate(a.Data));
    });

    populateFilters();
}

function getCategory(teamName) {
    if (!config) return '';
    const num = teamName.match(/#(\d+)/)?.[1];
    return config.categories[num] || '';
}

function isRmTeamCheck(teamName) {
    if (!teamName || !config) return false;
    const normalized = String(teamName).toUpperCase().replace(/\s+/g, ' ');
    return config.team.matchPatterns.some(pattern =>
        normalized.includes(pattern.toUpperCase().replace(/\s+/g, ' '))
    );
}

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

// ==================== Rendering ====================

function renderAll(options = {}) {
    const {
        skipCharts = false,
        skipMatches = false,
        skipStats = false,
        skipToday = false
    } = options;

    if (!skipToday) renderTodaysMatches();
    if (!skipStats) {
        renderNextMatch();
        renderRecentMatches();
        renderTeams();
    }
    if (!skipMatches) {
        applyFilters();
        renderMatches();
    }
    if (!skipCharts) {
        renderCharts();
    }
}

// ---- Today's Matches ----

async function renderTodaysMatches() {
    const section = document.getElementById('todaysMatchesSection');
    const container = document.getElementById('todaysMatchesList');
    const today = new Date();

    const todaysMatches = allMatches.filter(match => {
        if (!match.Data) return false;
        return parseDate(match.Data).toDateString() === today.toDateString();
    });

    if (todaysMatches.length === 0) {
        section.style.display = 'none';
        return;
    }

    section.style.display = 'block';

    const sorted = todaysMatches.sort((a, b) => (a.Ora || '23:59').localeCompare(b.Ora || '23:59'));
    const cards = await Promise.all(sorted.map(m => createTodayMatchCardHTML(m)));
    container.innerHTML = cards.join('');
}

async function createTodayMatchCardHTML(match) {
    const now = new Date();
    const matchDate = parseDate(match.Data);

    const timeParts = (match.Ora || '00:00').split(':');
    const matchTime = new Date(matchDate);
    matchTime.setHours(parseInt(timeParts[0]), parseInt(timeParts[1]), 0, 0);

    const tenMinutesBefore = new Date(matchTime.getTime() - 10 * 60 * 1000);
    const twoHoursAfter    = new Date(matchTime.getTime() + 2  * 60 * 60 * 1000);
    const twelveHoursBefore = new Date(matchTime.getTime() - 12 * 60 * 60 * 1000);

    const isLive      = now >= tenMinutesBefore && now <= twoHoursAfter;
    const isChatAvail = now >= twelveHoursBefore && now <= twoHoursAfter;
    const isCompleted = match.StatoDescrizione === 'gara omologata' || match.StatoDescrizione === 'risultato ufficioso';

    const isRmHome = isRmTeamCheck(match.SquadraCasa);
    const isRmAway = isRmTeamCheck(match.SquadraOspite);

    let homeScore = '', awayScore = '', homeWinner = false, awayWinner = false;

    if (isLive && !isCompleted && firebaseDatabase) {
        try {
            const matchKey = `${match.SquadraCasa}_vs_${match.SquadraOspite}_${match.Data}`
                .replace(/\s+/g, '_').replace(/\//g, '-').replace(/[.#$\[\]]/g, '_');
            const snap = await firebaseDatabase.ref(`live-matches/${matchKey}/sets`).once('value');
            const setsData = snap.val();
            if (setsData) {
                let hs = 0, as = 0;
                Object.values(setsData).forEach(set => {
                    if (set.home > set.away) hs++; else as++;
                });
                homeScore = hs; awayScore = as;
                homeWinner = hs > as; awayWinner = as > hs;
            }
        } catch (e) { console.warn('Could not fetch live sets:', e); }
    } else if (match.Risultato && match.Risultato.includes('-')) {
        const [hs, as] = match.Risultato.split('-').map(s => parseInt(s.trim()));
        homeScore = hs; awayScore = as;
        homeWinner = hs > as; awayWinner = as > hs;
    }

    const clickHandler = (isChatAvail && !isCompleted)
        ? `onclick="openLiveMatch(${JSON.stringify(match).replace(/"/g, '&quot;')})"` : '';
    const cursorStyle = (isChatAvail && !isCompleted) ? 'style="cursor:pointer"' : '';

    return `
        <div class="today-match-card ${isLive && !isCompleted ? 'today-match-live' : ''}"
             ${clickHandler} ${cursorStyle}>
            <div class="today-match-header">
                <span class="today-match-time">${match.Ora || 'TBD'}</span>
                ${isLive && !isCompleted
                    ? '<span class="today-live-badge"><span class="today-live-dot"></span>LIVE</span>'
                    : ''}
            </div>
            <div class="today-match-body">
                <div class="today-team-box ${isRmHome ? 'today-rm-team' : ''}">
                    <span class="today-team-name">${match.SquadraCasa || 'TBD'}</span>
                    ${homeScore !== '' ? `<span class="today-team-score ${homeWinner ? 'score-winner' : ''}">${homeScore}</span>` : ''}
                </div>
                <div class="today-match-vs"><div class="vs-circle">vs</div></div>
                <div class="today-team-box ${isRmAway ? 'today-rm-team' : ''}">
                    <span class="today-team-name">${match.SquadraOspite || 'TBD'}</span>
                    ${awayScore !== '' ? `<span class="today-team-score ${awayWinner ? 'score-winner' : ''}">${awayScore}</span>` : ''}
                </div>
            </div>
            ${match.Impianto ? `
            <div class="today-match-footer">
                <a href="https://maps.google.com/?q=${encodeURIComponent(match.Impianto)}"
                   target="_blank" rel="noopener noreferrer"
                   class="today-venue-link" onclick="event.stopPropagation()">
                   📍 ${match.Impianto}
                </a>
            </div>` : ''}
        </div>
    `;
}

// ---- Next Match ----

function renderNextMatch() {
    const section = document.getElementById('nextMatchSection');
    const container = document.getElementById('nextMatchCard');
    const today = new Date();

    const upcoming = allMatches
        .filter(m => m.Data && parseDate(m.Data) > today && m.StatoDescrizione !== 'gara omologata')
        .sort((a, b) => parseDate(a.Data) - parseDate(b.Data));

    if (!upcoming.length) {
        section.style.display = 'none';
        return;
    }

    const match = upcoming[0];
    const isRmHome = isRmTeamCheck(match.SquadraCasa);
    const isRmAway = isRmTeamCheck(match.SquadraOspite);
    const dateStr = parseDate(match.Data).toLocaleDateString('it-IT', { weekday:'short', day:'numeric', month:'short' });

    section.style.display = 'block';
    container.innerHTML = `
        <div class="next-match-card card">
            <div class="next-match-meta">
                <span>${dateStr}</span>
                <span>·</span>
                <span>${match.Ora || 'TBD'}</span>
                ${match.Campionato ? `<span>·</span><span>${match.Campionato}</span>` : ''}
            </div>
            <div class="next-match-body">
                <span class="next-team-name${isRmHome ? ' rm' : ''}">${match.SquadraCasa || 'TBD'}</span>
                <span class="next-vs">vs</span>
                <span class="next-team-name${isRmAway ? ' rm' : ''}">${match.SquadraOspite || 'TBD'}</span>
            </div>
        </div>
    `;
}

// ---- Recent Matches (compact rows) ----

function renderRecentMatches() {
    const container = document.getElementById('recentMatchesList');
    const recent = [...allMatches]
        .filter(m => m.StatoDescrizione !== 'Da disputare' && m.Risultato)
        .sort((a, b) => parseDate(b.Data) - parseDate(a.Data))
        .slice(0, 8);

    if (!recent.length) {
        container.innerHTML = '<div class="empty-state"><p>Nessun risultato disponibile</p></div>';
        return;
    }

    container.innerHTML = recent.map(match => {
        const date = parseDate(match.Data);
        const dateStr = date.toLocaleDateString('it-IT', { day:'2-digit', month:'2-digit' });
        const isRmHome = isRmTeamCheck(match.SquadraCasa);
        const isRmAway = isRmTeamCheck(match.SquadraOspite);
        const teams = `${match.SquadraCasa || '?'} – ${match.SquadraOspite || '?'}`;

        let score = '', badgeClass = 'none', badgeText = '';
        if (match.Risultato && match.Risultato.includes('-')) {
            const [hs, as] = match.Risultato.split('-').map(s => parseInt(s.trim()));
            score = `${hs}–${as}`;
            if (isRmHome || isRmAway) {
                const won = isRmHome ? hs > as : as > hs;
                badgeClass = won ? 'win' : 'loss';
                badgeText  = won ? 'V' : 'P';
            }
        }

        return `
            <div class="result-row">
                <span class="result-date">${dateStr}</span>
                <span class="result-teams">${teams}</span>
                <span class="result-score">${score}</span>
                ${badgeText ? `<span class="result-badge ${badgeClass}">${badgeText}</span>` : ''}
            </div>
        `;
    }).join('');
}

// ---- Standings ----

function renderStandings(leagueName) {
    const tbody = document.getElementById('standingsBody');
    const lastUpdate = document.getElementById('standingsLastUpdate');
    const data = standingsData[leagueName];

    if (lastUpdate) {
        const now = new Date();
        lastUpdate.textContent = `Agg. ${now.toLocaleDateString()} ${now.toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' })}`;
    }

    if (!data || data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" class="text-center" style="padding:24px;color:var(--text-2)">Dati non disponibili</td></tr>`;
        return;
    }

    tbody.innerHTML = data.map((team, index) => {
        const rankClass = index === 0 ? 'rank-1' : index === 1 ? 'rank-2' : index === 2 ? 'rank-3' : '';
        const isRm = team.Squadra && config && config.team.matchPatterns.some(p =>
            team.Squadra.toUpperCase().includes(p.toUpperCase())
        );
        return `
            <tr class="${isRm ? 'highlight-row' : ''}">
                <td class="text-center"><span class="rank-badge ${rankClass}">${team['Pos.']}</span></td>
                <td><span class="team-name-standings" title="${team.Squadra}">${team.Squadra}</span></td>
                <td class="text-center font-bold">${team.Punti}</td>
                <td class="text-center">${team.PG}</td>
                <td class="text-center">${team.PV}</td>
                <td class="text-center">${team.PP}</td>
                <td class="text-center col-hide">${team.SF}</td>
                <td class="text-center col-hide">${team.SS}</td>
            </tr>
        `;
    }).join('');
}

// ---- Teams ----

function renderTeams() {
    const grid = document.getElementById('teamsGrid');
    const teams = Object.values(teamsData).sort((a, b) => {
        const rA = a.played > 0 ? a.wins / a.played : 0;
        const rB = b.played > 0 ? b.wins / b.played : 0;
        return rB - rA;
    });

    grid.innerHTML = teams.map(team => {
        const winRate = team.played > 0 ? Math.round((team.wins / team.played) * 100) : 0;
        const toPlay  = team.totalMatches - team.played;
        const setRate = team.setsWon + team.setsLost > 0
            ? Math.round(team.setsWon / (team.setsWon + team.setsLost) * 100)
            : 0;

        return `
            <div class="team-card" onclick="showTeamDetail('${team.name.replace(/'/g, "\\'")}')">
                <div class="team-card-header">
                    <div class="team-name">${team.name}</div>
                    ${team.category ? `<div class="team-category">${team.category}</div>` : ''}
                </div>
                <div class="team-stats-row">
                    <div class="stat-box">
                        <div class="stat-box-value">${team.wins}</div>
                        <div class="stat-box-label">Vinte</div>
                    </div>
                    <div class="stat-box">
                        <div class="stat-box-value">${team.losses}</div>
                        <div class="stat-box-label">Perse</div>
                    </div>
                    <div class="stat-box">
                        <div class="stat-box-value">${toPlay}</div>
                        <div class="stat-box-label">Res.</div>
                    </div>
                    <div class="stat-box">
                        <div class="stat-box-value">${winRate}%</div>
                        <div class="stat-box-label">Win%</div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// ---- Matches (Partite tab) ----

function applyFilters() {
    const teamFilter   = document.getElementById('filterTeam').value;
    const statusFilter = document.getElementById('filterStatus').value;
    const searchTerm   = document.getElementById('searchInput').value.toLowerCase();

    filteredMatches = allMatches.filter(match => {
        const matchTeam   = teamFilter   ? (match.SquadraCasa === teamFilter || match.SquadraOspite === teamFilter) : true;
        const matchStatus = statusFilter ? match.StatoDescrizione === statusFilter : true;
        const matchSearch = searchTerm
            ? (match.SquadraCasa?.toLowerCase().includes(searchTerm) ||
               match.SquadraOspite?.toLowerCase().includes(searchTerm) ||
               match.Impianto?.toLowerCase().includes(searchTerm))
            : true;
        return matchTeam && matchStatus && matchSearch;
    });

    document.getElementById('matchesSubtitle').textContent =
        `${filteredMatches.length} partite trovate`;
}

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

    const statusFilter = document.getElementById('filterStatus').value;
    const sorted = [...filteredMatches].sort((a, b) => {
        if (statusFilter === 'da disputare') return parseDate(a.Data) - parseDate(b.Data);
        return parseDate(b.Data) - parseDate(a.Data);
    });

    list.innerHTML = sorted.map(match => createMatchCardHTML(match)).join('');
}

function createMatchCardHTML(match) {
    const date = parseDate(match.Data);
    const dateStr = date.toLocaleDateString('it-IT', { day:'2-digit', month:'short', year:'numeric' });

    const isRmHome = isRmTeamCheck(match.SquadraCasa);
    const isRmAway = isRmTeamCheck(match.SquadraOspite);

    let statusClass = 'status-upcoming', statusText = 'Da giocare';
    if (match.StatoDescrizione === 'gara omologata') {
        statusClass = 'status-played'; statusText = 'Completata';
    } else if (match.StatoDescrizione === 'risultato ufficioso') {
        statusClass = 'status-unofficial'; statusText = 'Non ufficiale';
    }

    let scoreHtml = '', setsHtml = '';
    if (match.Risultato && match.Risultato.includes('-')) {
        const [hs, as] = match.Risultato.split('-').map(s => parseInt(s.trim()));
        scoreHtml = `${hs}–${as}`;
        if (match.Parziali) {
            const sets = match.Parziali.split(' ').filter(s => s.trim()).join(' · ');
            setsHtml = `<div class="match-score-sets">${sets}</div>`;
        }
    }

    const venueHtml = match.Impianto ? `
        <div class="match-venue-row">
            <a href="https://maps.google.com/?q=${encodeURIComponent(match.Impianto)}"
               target="_blank" rel="noopener noreferrer"
               class="match-venue-link">
               📍 ${match.Impianto}
            </a>
        </div>
    ` : '';

    return `
        <div class="match-card">
            <div class="match-card-header">
                <span class="match-date-label">${dateStr}</span>
                ${match.Ora ? `<span class="match-date-label">· ${match.Ora}</span>` : ''}
                <span class="match-championship-label">${match.Campionato || ''}</span>
                <span class="match-status ${statusClass}">${statusText}</span>
            </div>
            <div class="match-card-body">
                <span class="match-team-name${isRmHome ? ' rm' : ''}">${match.SquadraCasa || 'TBD'}</span>
                <div class="match-score-block">
                    ${scoreHtml
                        ? `<div class="match-score-main">${scoreHtml}</div>${setsHtml}`
                        : '<div class="match-score-main" style="color:var(--text-3)">–</div>'
                    }
                </div>
                <span class="match-team-name-right${isRmAway ? ' rm' : ''}">${match.SquadraOspite || 'TBD'}</span>
            </div>
            ${venueHtml}
        </div>
    `;
}

// ---- Charts ----

function renderCharts() {
    const teams = Object.values(teamsData).filter(t => t.played > 0);

    const currentData = teams.map(t => ({
        name: t.name, wins: t.wins, losses: t.losses,
        setsWon: t.setsWon, setsLost: t.setsLost
    }));

    if (lastChartData && deepEqual(currentData, lastChartData)) return;
    lastChartData = currentData;

    Object.values(chartInstances).forEach(chart => chart.destroy());
    chartInstances = {};

    const chartDefaults = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'bottom',
                labels: { padding: 16, font: { size: 12, weight: '600' }, boxWidth: 12 }
            }
        },
        scales: {
            y: { beginAtZero: true, ticks: { stepSize: 1 }, grid: { color: 'rgba(0,0,0,0.04)' } },
            x: { grid: { display: false } }
        }
    };

    const labels = teams.map(t => t.name.replace(/RM VOLLEY\s*/i, '').replace(/RMVOLLEY\s*/i, '').trim() || t.name.split(' ')[0]);

    // Wins/Losses chart
    const winsCtx = document.getElementById('winsChart');
    if (winsCtx) {
        chartInstances.wins = new Chart(winsCtx, {
            type: 'bar',
            data: {
                labels,
                datasets: [
                    { label: 'Vittorie',  data: teams.map(t => t.wins),   backgroundColor: 'rgba(37,99,235,0.75)',  borderRadius: 5, borderWidth: 0 },
                    { label: 'Sconfitte', data: teams.map(t => t.losses), backgroundColor: 'rgba(239,68,68,0.5)',   borderRadius: 5, borderWidth: 0 }
                ]
            },
            options: { ...chartDefaults }
        });
    }

    // Sets chart
    const setsCtx = document.getElementById('setsChart');
    if (setsCtx) {
        chartInstances.sets = new Chart(setsCtx, {
            type: 'bar',
            data: {
                labels,
                datasets: [
                    { label: 'Set Vinti', data: teams.map(t => t.setsWon),  backgroundColor: 'rgba(16,185,129,0.7)', borderRadius: 5, borderWidth: 0 },
                    { label: 'Set Persi', data: teams.map(t => t.setsLost), backgroundColor: 'rgba(239,68,68,0.5)',  borderRadius: 5, borderWidth: 0 }
                ]
            },
            options: { ...chartDefaults }
        });
    }
}

// ==================== Team Detail Modal ====================

function showTeamDetail(teamName) {
    const team = teamsData[teamName];
    if (!team) return;

    const modal = document.getElementById('teamModal');
    const modalBody = document.getElementById('modalBody');
    document.getElementById('modalTeamName').textContent = team.name;

    const winRate = team.played > 0 ? Math.round((team.wins / team.played) * 100) : 0;
    const setRate = team.setsWon + team.setsLost > 0
        ? Math.round((team.setsWon / (team.setsWon + team.setsLost)) * 100) : 0;
    const totalSets = team.setsWon + team.setsLost;
    const avgPoints = totalSets > 0 ? (team.pointsScored / totalSets).toFixed(1) : 0;

    const recentMatches = team.matches
        .filter(m => m.StatoDescrizione !== 'Da disputare' && m.Risultato)
        .slice(0, 10);

    modalBody.innerHTML = `
        <div class="detail-section">
            <div class="detail-section-title">Statistiche</div>
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
                    <div class="stat-detail-value">${setRate}%</div>
                    <div class="stat-detail-label">Set Rate</div>
                </div>
                <div class="stat-detail-card">
                    <div class="stat-detail-value">${avgPoints}</div>
                    <div class="stat-detail-label">Punti/Set</div>
                </div>
                <div class="stat-detail-card">
                    <div class="stat-detail-value">${team.homeWins}V</div>
                    <div class="stat-detail-label">Casa</div>
                </div>
                <div class="stat-detail-card">
                    <div class="stat-detail-value">${team.awayWins}V</div>
                    <div class="stat-detail-label">Trasferta</div>
                </div>
                <div class="stat-detail-card">
                    <div class="stat-detail-value">${team.longestWinStreak}</div>
                    <div class="stat-detail-label">Striscia Max</div>
                </div>
            </div>
        </div>

        ${recentMatches.length ? `
        <div class="detail-section">
            <div class="detail-section-title">Ultimi risultati</div>
            <div class="match-timeline">
                ${recentMatches.map(match => {
                    const dateStr = parseDate(match.Data).toLocaleDateString('it-IT', { day:'2-digit', month:'2-digit' });
                    const opponent = match.isHome ? match.SquadraOspite : match.SquadraCasa;
                    const result = match.Risultato || '';
                    let dotClass = '', score = result;
                    if (result.includes('-')) {
                        const [s1, s2] = result.split('-').map(s => parseInt(s.trim()));
                        const won = match.isHome ? s1 > s2 : s2 > s1;
                        dotClass = won ? 'win' : 'loss';
                        score = `${s1}–${s2}`;
                    }
                    return `
                        <div class="timeline-item">
                            <div class="timeline-dot ${dotClass}"></div>
                            <span class="timeline-date">${dateStr}</span>
                            <span class="timeline-match">${match.isHome ? 'vs' : '@'} ${opponent}</span>
                            <span class="timeline-score">${score}</span>
                        </div>
                    `;
                }).join('')}
            </div>
        </div>` : ''}
    `;

    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeTeamModal() {
    document.getElementById('teamModal').classList.remove('active');
    document.body.style.overflow = '';
}

// ==================== Utility ====================

function parseDate(dateStr) {
    if (!dateStr) return new Date();
    const [day, month, year] = dateStr.split('/');
    return new Date(year, month - 1, day);
}

// ==================== Event Listeners ====================

const TAB_TITLES = {
    home:        'Home',
    partite:     'Partite',
    squadre:     'Squadre',
    classifiche: 'Classifiche'
};

function switchTab(tabName) {
    if (tabName === 'login' || tabName === 'logout' || tabName === 'scout' || tabName === 'social') return;

    // Update sidebar nav items
    document.querySelectorAll('.sidebar-nav-item[data-tab]').forEach(item => {
        const isActive = item.dataset.tab === tabName;
        item.classList.toggle('active', isActive);
        item.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });

    // Update bottom nav items
    document.querySelectorAll('.bottom-nav-item[data-tab]').forEach(item => {
        const isActive = item.dataset.tab === tabName;
        item.classList.toggle('active', isActive);
        item.setAttribute('aria-selected', isActive ? 'true' : 'false');
    });

    // Show/hide tab content
    document.querySelectorAll('.tab-content').forEach(content => {
        const show = content.id === `${tabName}-tab`;
        content.classList.toggle('active', show);
        content.style.display = show ? 'block' : 'none';
    });

    // Update mobile topbar title
    const topbarTitle = document.getElementById('topbarTitle');
    if (topbarTitle) topbarTitle.textContent = TAB_TITLES[tabName] || 'RM Volley';

    currentTab = tabName;

    // Scroll to top on mobile
    if (window.innerWidth <= 768) window.scrollTo(0, 0);
}

function initializeEventListeners() {
    // Tab navigation
    document.querySelectorAll('[data-tab]').forEach(el => {
        el.addEventListener('click', () => {
            const tabName = el.dataset.tab;
            if (!TAB_TITLES[tabName]) return; // only real tabs
            switchTab(tabName);
        });
    });

    // Filters
    document.getElementById('filterTeam').addEventListener('change', () => {
        applyFilters(); renderMatches();
    });
    document.getElementById('filterStatus').addEventListener('change', () => {
        applyFilters(); renderMatches();
    });
    document.getElementById('searchInput').addEventListener('input',
        debounce(() => { applyFilters(); renderMatches(); }, 300)
    );

    // Pull to refresh
    let startY = 0, isPulling = false;
    const indicator = document.getElementById('pullIndicator');

    document.addEventListener('touchstart', (e) => {
        if (window.scrollY === 0) { startY = e.touches[0].pageY; isPulling = false; }
    }, { passive: true });

    document.addEventListener('touchmove', (e) => {
        if (window.scrollY === 0 && startY > 0) {
            const dist = e.touches[0].pageY - startY;
            if (dist > 0 && dist < 120) {
                isPulling = true;
                indicator.style.opacity = Math.min(dist / 80, 1);
                indicator.style.transform = `translateX(-50%) translateY(${Math.min(dist * 0.7, 70)}px)`;
            }
        }
    }, { passive: true });

    document.addEventListener('touchend', () => {
        if (isPulling) {
            indicator.style.opacity = '0';
            indicator.style.transform = 'translateX(-50%) translateY(-80px)';
            location.reload();
        }
        isPulling = false;
        startY = 0;
    });

    // Scroll: nothing fancy needed anymore
}

// ==================== Live Match Navigation ====================

window.openLiveMatch = function(match) {
    const matchData = encodeURIComponent(JSON.stringify(match));
    window.location.href = `live-match.html?match=${matchData}`;
};

// ==================== Init ====================

document.addEventListener('DOMContentLoaded', () => {
    initializeEventListeners();
    loadExcelFile();
});

window.closeTeamModal = closeTeamModal;
window.showTeamDetail = showTeamDetail;
