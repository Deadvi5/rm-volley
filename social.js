// ====================================
// Social Media Manager - Post Generator
// ====================================

import { getCurrentUser } from './auth-simple.js';

let config = null;
let allMatches = [];

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Load config
        const response = await fetch('config.json');
        config = await response.json();

        // Load matches
        await loadMatches();

        // Set default dates (last 7 days)
        setDefaultDates();

        // Setup event listeners
        document.getElementById('generateBtn').addEventListener('click', generatePost);
        document.getElementById('copyBtn').addEventListener('click', copyToClipboard);

        console.log('✅ Social Media Manager initialized');
    } catch (error) {
        console.error('Error initializing:', error);
        alert('Errore durante l\'inizializzazione');
    }
});

// Load all matches from Gare.xls
async function loadMatches() {
    try {
        console.log('📥 Loading Gare.xls...');
        const response = await fetch('Gare.xls');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const arrayBuffer = await response.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        allMatches = XLSX.utils.sheet_to_json(firstSheet);

        console.log(`✅ Loaded ${allMatches.length} matches`);
        if (allMatches.length > 0) {
            console.log('Sample match:', allMatches[0]);
        }
    } catch (error) {
        console.error('Error loading matches:', error);
        alert('Errore nel caricamento delle partite. Verifica che Gare.xls esista.');
    }
}

// Set default dates to last 7 days
function setDefaultDates() {
    const today = new Date();
    const lastWeek = new Date(today);
    lastWeek.setDate(today.getDate() - 7);

    // Format as YYYY-MM-DD
    const formatDate = (date) => date.toISOString().split('T')[0];

    document.getElementById('startDate').value = formatDate(lastWeek);
    document.getElementById('endDate').value = formatDate(today);
}

// Get ISO week number
function getWeekNumber(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

// Parse date from various formats
function parseDate(dateInput) {
    if (!dateInput) return null;

    // Handle Excel serial date (number)
    if (typeof dateInput === 'number') {
        const date = new Date(Math.round((dateInput - 25569) * 86400 * 1000));
        return date;
    }

    // Handle string dates
    if (typeof dateInput === 'string') {
        // Try DD/MM/YYYY
        if (dateInput.includes('/')) {
            const parts = dateInput.split('/');
            if (parts.length === 3) {
                // Check if it's likely MM/DD/YYYY (US format) or DD/MM/YYYY
                // This is tricky without context, but let's assume DD/MM/YYYY as per Italian standard
                return new Date(parts[2], parts[1] - 1, parts[0]);
            }
        }

        // Try YYYY-MM-DD
        if (dateInput.includes('-')) {
            return new Date(dateInput);
        }
    }

    return null;
}

// Get date range for selected week (Sunday to Sunday)
function getWeekRange(weekInput) {
    const [year, week] = weekInput.split('-W');
    const simple = new Date(year, 0, 1 + (week - 1) * 7);
    const dow = simple.getDay();
    const ISOweekStart = simple;
    if (dow <= 4)
        ISOweekStart.setDate(simple.getDate() - simple.getDay());
    else
        ISOweekStart.setDate(simple.getDate() + 7 - simple.getDay());

    const weekStart = new Date(ISOweekStart);
    const weekEnd = new Date(ISOweekStart);
    weekEnd.setDate(weekStart.getDate() + 6);

    return { start: weekStart, end: weekEnd };
}

// Check if team name matches RM Volley patterns
function isRmTeam(teamName) {
    if (!teamName || !config) return false;
    const patterns = config.team.matchPatterns;
    return patterns.some(pattern => teamName.toUpperCase().includes(pattern.toUpperCase()));
}

// Get category display name
function getCategoryName(category) {
    // Use the Campionato name directly, but maybe clean it up if needed
    // For now, return as is since it matches the user's expectation closely
    return category;
}

// Determine emoji based on performance
function getPerformanceEmoji(team, currentResult, previousResult) {
    // 🔥 Strike (winning streak or losing streak)
    if (currentResult === 'win' && previousResult === 'win') return '🔥';

    // 🟢 Recovery (lost previous, won now)
    if (currentResult === 'win' && previousResult === 'loss') return '🟢';

    // 🔻 Decline (won previous, lost now)
    if (currentResult === 'loss' && previousResult === 'win') return '🔻';

    // Default for losses or first match
    return '🔻';
}

// Get match result for a team
function getMatchResult(match, teamName) {
    const isHome = isRmTeam(match.SquadraCasa) && match.SquadraCasa.includes(teamName.split('#')[1] || teamName);
    const isAway = isRmTeam(match.SquadraOspite) && match.SquadraOspite.includes(teamName.split('#')[1] || teamName);

    if (!isHome && !isAway) return null;

    // Parse result "3-1" etc
    const scoreParts = (match.Risultato || '').split('-');
    if (scoreParts.length !== 2) return null;

    const homeScore = parseInt(scoreParts[0]);
    const awayScore = parseInt(scoreParts[1]);

    if (isHome) {
        return homeScore > awayScore ? 'win' : 'loss';
    } else {
        return awayScore > homeScore ? 'win' : 'loss';
    }
}

// Generate social media post
function generatePost() {
    const startDateInput = document.getElementById('startDate').value;
    const endDateInput = document.getElementById('endDate').value;

    if (!startDateInput || !endDateInput) {
        alert('Seleziona entrambe le date');
        return;
    }

    const start = new Date(startDateInput);
    const end = new Date(endDateInput);

    // Adjust end date to include the full day
    end.setHours(23, 59, 59, 999);

    console.log(`📅 Date range: ${start.toLocaleDateString()} - ${end.toLocaleDateString()}`);
    console.log(`Total matches in database: ${allMatches.length}`);

    console.log(`📅 Date range: ${start.toISOString()} - ${end.toISOString()}`);
    console.log(`Total matches in database: ${allMatches.length}`);

    let statusMismatchCount = 0;
    let dateOutOfRangeCount = 0;
    let validMatchesCount = 0;

    // Filter matches in the week range
    const weekMatches = allMatches.filter(match => {
        const matchDate = parseDate(match.Data);
        if (!matchDate) {
            // console.warn('❌ Invalid date for match:', match);
            return false;
        }

        // Check status (case insensitive)
        // Note: app.js uses 'StatoDescrizione', checking both just in case
        const status = (match.StatoDescrizione || match.Stato || '').toLowerCase().trim();
        const isOmologata = status === 'gara omologata' || status === 'risultato ufficioso';

        if (!isOmologata) {
            statusMismatchCount++;
            // Log first few status mismatches to verify
            if (statusMismatchCount <= 3) {
                console.log(`Skipping match (Status: '${match.StatoDescrizione || match.Stato}'):`, match);
            }
            return false;
        }

        const inRange = matchDate >= start && matchDate <= end;

        if (!inRange) {
            dateOutOfRangeCount++;
            // Log matches that are close to the range (within 30 days) to see if we have parsing errors
            const diffTime = Math.abs(matchDate - start);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            if (diffDays < 30 && dateOutOfRangeCount <= 5) {
                console.log(`Skipping match (Date out of range): ${match.Data} -> ${matchDate.toISOString().split('T')[0]}`);
            }
            return false;
        }

        validMatchesCount++;
        console.log(`✅ Found match: ${match.Data} - ${match.SquadraCasa} vs ${match.SquadraOspite}`);
        return true;
    });

    console.log(`📊 Filtering Summary:`);
    console.log(`- Status mismatch: ${statusMismatchCount}`);
    console.log(`- Date out of range: ${dateOutOfRangeCount}`);
    console.log(`- Valid matches: ${validMatchesCount}`);

    console.log(`Matches in selected week: ${weekMatches.length}`);

    // Filter only RM Volley matches
    const rmMatches = weekMatches.filter(match =>
        isRmTeam(match.SquadraCasa) || isRmTeam(match.SquadraOspite)
    );

    console.log(`RM Volley matches: ${rmMatches.length}`);

    if (rmMatches.length === 0) {
        alert(`Nessuna partita trovata per la settimana selezionata.\\n\\nRange: ${start.toLocaleDateString()} - ${end.toLocaleDateString()}\\nPartite nella settimana: ${weekMatches.length}\\nPartite RM Volley: ${rmMatches.length}`);
        return;
    }

    // Group by category (Campionato)
    const matchesByCategory = {};
    rmMatches.forEach(match => {
        const cat = match.Campionato || 'Altro';
        if (!matchesByCategory[cat]) {
            matchesByCategory[cat] = [];
        }
        matchesByCategory[cat].push(match);
    });

    // Get previous matches for comparison (look back 14 days from start)
    const prevStart = new Date(start);
    prevStart.setDate(start.getDate() - 14);

    const prevMatches = allMatches.filter(match => {
        const matchDate = parseDate(match.Data);
        if (!matchDate) return false;

        // Check status (case insensitive)
        const status = (match.StatoDescrizione || match.Stato || '').toLowerCase().trim();
        const isOmologata = status === 'gara omologata' || status === 'risultato ufficioso';

        return matchDate >= prevStart && matchDate < start && isOmologata;
    });

    // Sort previous matches by date descending to get the most recent one
    prevMatches.sort((a, b) => parseDate(b.Data) - parseDate(a.Data));

    // Build post
    let post = '🏐 RISULTATI SETTIMANALI 🏐\n\n';

    Object.keys(matchesByCategory).sort().forEach(categoryId => {
        const matches = matchesByCategory[categoryId];

        matches.forEach(match => {
            const isHome = isRmTeam(match.SquadraCasa);
            const rmTeam = isHome ? match.SquadraCasa : match.SquadraOspite;
            const opponentTeam = isHome ? match.SquadraOspite : match.SquadraCasa;

            //Get current result
            const currentResult = getMatchResult(match, rmTeam);

            // Find most recent previous match for this team
            const prevMatch = prevMatches.find(m =>
                (isRmTeam(m.SquadraCasa) && m.SquadraCasa === rmTeam) ||
                (isRmTeam(m.SquadraOspite) && m.SquadraOspite === rmTeam)
            );

            const previousResult = prevMatch ? getMatchResult(prevMatch, rmTeam) : null;
            const emoji = getPerformanceEmoji(rmTeam, currentResult, previousResult);

            // Format match line
            const categoryName = getCategoryName(categoryId);
            const score = match.Risultato || '?';
            const sets = match.Parziali ? `(${match.Parziali.replace(/,/g, ', ')})` : '';

            post += `${emoji} ${categoryName.toUpperCase()}\n`;
            if (isHome) {
                post += `${rmTeam} 🆚 ${opponentTeam} → ${score}\n`;
            } else {
                post += `${opponentTeam} 🆚 ${rmTeam} → ${score}\n`;
            }
            if (sets) {
                post += `${sets}\n`;
            }
            post += '\n';
        });
    });

    // Display result
    document.getElementById('postContent').textContent = post;
    document.getElementById('resultSection').style.display = 'block';
    document.getElementById('statsSection').style.display = 'block';

    // Generate stats summary
    generateStats(rmMatches, matchesByCategory);
}

// Generate stats summary
function generateStats(matches, byCategory) {
    const wins = matches.filter(m => {
        const rmTeam = isRmTeam(m.SquadraCasa) ? m.SquadraCasa : m.SquadraOspite;
        return getMatchResult(m, rmTeam) === 'win';
    }).length;

    const losses = matches.length - wins;

    const statsHtml = `
        <div class="stat-item">
            <div class="stat-item-label">Partite Totali</div>
            <div class="stat-item-value">${matches.length}</div>
        </div>
        <div class="stat-item">
            <div class="stat-item-label">Vittorie</div>
            <div class="stat-item-value" style="color: #10b981;">${wins}</div>
        </div>
        <div class="stat-item">
            <div class="stat-item-label">Sconfitte</div>
            <div class="stat-item-value" style="color: #ef4444;">${losses}</div>
        </div>
        <div class="stat-item">
            <div class="stat-item-label">Categorie</div>
            <div class="stat-item-value">${Object.keys(byCategory).length}</div>
        </div>
    `;

    document.getElementById('weekStats').innerHTML = statsHtml;
}

// Copy to clipboard
function copyToClipboard() {
    const text = document.getElementById('postContent').textContent;
    navigator.clipboard.writeText(text).then(() => {
        alert('✅ Testo copiato negli appunti!');
    }).catch(err => {
        console.error('Error copying:', err);
        alert('Errore durante la copia');
    });
}
