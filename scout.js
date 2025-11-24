// ====================================
// Scout Application - Main Logic
// ====================================

import { getCurrentUser } from './auth-simple.js';

// Global state
let config = null;
let currentSession = {
    sessionId: null,
    matchId: null,
    matchData: null,
    players: [],
    currentPlayerId: null,
    actionHistory: []
};

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Load config
        const response = await fetch('config.json');
        config = await response.json();

        // Setup UI
        setupEventListeners();
        await loadMatches();
        populatePlayerRoles();

        // Try to restore session
        restoreSession();

        console.log('✅ Scout application initialized');
    } catch (error) {
        console.error('Error initializing scout app:', error);
        alert('Errore durante l\'inizializzazione dell\'applicazione.');
    }
});

// Setup Event Listeners
function setupEventListeners() {
    // Match selection
    document.getElementById('matchSelect').addEventListener('change', handleMatchSelection);

    // Player management
    document.getElementById('addPlayerBtn').addEventListener('click', addPlayer);

    // Stat tracking
    document.querySelectorAll('.stat-btn').forEach(btn => {
        btn.addEventListener('click', handleStatClick);
    });

    document.getElementById('undoBtn').addEventListener('click', undoLastAction);
    document.getElementById('saveSessionBtn').addEventListener('click', saveSession);
    document.getElementById('exportBtn').addEventListener('click', exportData);
}

// Populate player roles from config
function populatePlayerRoles() {
    const select = document.getElementById('playerPosition');
    if (config && config.playerRoles) {
        config.playerRoles.forEach(role => {
            const option = document.createElement('option');
            option.value = role;
            option.textContent = role;
            select.appendChild(option);
        });
    }
}

// Load matches from Gare.xls
async function loadMatches() {
    try {
        const response = await fetch('Gare.xls');
        const arrayBuffer = await response.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(firstSheet);

        // Get today's date in DD/MM/YYYY format
        const today = new Date();
        const todayStr = `${String(today.getDate()).padStart(2, '0')}/${String(today.getMonth() + 1).padStart(2, '0')}/${today.getFullYear()}`;

        // Separate today's matches from other matches
        const todayMatches = [];
        const otherMatches = [];

        data.forEach((match, index) => {
            const matchObj = { match, index };
            if (match.Data === todayStr) {
                todayMatches.push(matchObj);
            } else {
                otherMatches.push(matchObj);
            }
        });

        // Populate select
        const select = document.getElementById('matchSelect');
        select.innerHTML = '<option value="">Scegli una partita...</option>';

        // Add today's matches first
        if (todayMatches.length > 0) {
            const todayGroup = document.createElement('optgroup');
            todayGroup.label = '🔴 OGGI - Today\'s Matches';
            todayMatches.forEach(({ match, index }) => {
                const option = document.createElement('option');
                option.value = index;
                option.textContent = `${match.Ora || 'TBD'} - ${match.SquadraCasa} vs ${match.SquadraOspite}`;
                option.dataset.match = JSON.stringify(match);
                todayGroup.appendChild(option);
            });
            select.appendChild(todayGroup);
        }

        // Add other matches
        if (otherMatches.length > 0) {
            const otherGroup = document.createElement('optgroup');
            otherGroup.label = 'Other Matches';
            otherMatches.forEach(({ match, index }) => {
                const option = document.createElement('option');
                option.value = index;
                option.textContent = `${match.Data || 'TBD'} - ${match.SquadraCasa} vs ${match.SquadraOspite}`;
                option.dataset.match = JSON.stringify(match);
                otherGroup.appendChild(option);
            });
            select.appendChild(otherGroup);
        }

        console.log(`✅ Loaded ${todayMatches.length} matches today, ${otherMatches.length} other matches`);
    } catch (error) {
        console.error('Error loading matches:', error);
    }
}

// Handle match selection
function handleMatchSelection(event) {
    const selectedOption = event.target.selectedOptions[0];
    if (!selectedOption.value) return;

    currentSession.matchId = selectedOption.value;
    currentSession.matchData = JSON.parse(selectedOption.dataset.match);
    currentSession.sessionId = `session-${Date.now()}`;
    currentSession.players = [];
    currentSession.actionHistory = [];

    // Show match info
    const matchInfo = document.getElementById('selectedMatchInfo');
    matchInfo.innerHTML = `
        <strong>${currentSession.matchData.SquadraCasa} vs ${currentSession.matchData.SquadraOspite}</strong><br>
        📅 ${currentSession.matchData.Data} ⏰ ${currentSession.matchData.Ora || 'TBD'}<br>
        📍 ${currentSession.matchData.Impianto || 'TBD'}
    `;
    matchInfo.style.display = 'block';

    // Populate team selector
    const teamSelect = document.getElementById('playerTeam');
    teamSelect.innerHTML = `
        <option value="">Seleziona squadra</option>
        <option value="${currentSession.matchData.SquadraCasa}">${currentSession.matchData.SquadraCasa}</option>
        <option value="${currentSession.matchData.SquadraOspite}">${currentSession.matchData.SquadraOspite}</option>
    `;

    // Show player setup section
    document.getElementById('playerSetupSection').style.display = 'block';
}

// Add player to scout list
function addPlayer() {
    const name = document.getElementById('playerName').value.trim();
    const number = document.getElementById('playerNumber').value;
    const team = document.getElementById('playerTeam').value;
    const position = document.getElementById('playerPosition').value;

    if (!name || !number || !team || !position) {
        alert('Compila tutti i campi del giocatore');
        return;
    }

    const player = {
        id: `player-${Date.now()}`,
        name,
        number: parseInt(number),
        team,
        position,
        stats: {
            serves: { ace: 0, error: 0, inPlay: 0 },
            attacks: { kill: 0, error: 0, blocked: 0 },
            blocks: { solo: 0, assist: 0, error: 0 },
            digs: { successful: 0, error: 0 },
            sets: { assist: 0, error: 0 },
            receptions: { perfect: 0, good: 0, error: 0 }
        }
    };

    currentSession.players.push(player);

    // Clear form
    document.getElementById('playerName').value = '';
    document.getElementById('playerNumber').value = '';
    document.getElementById('playerPosition').value = '';

    renderPlayers();

    // Show sections
    document.getElementById('activePlayersSection').style.display = 'block';

    // Select first player if none selected
    if (!currentSession.currentPlayerId) {
        selectPlayer(player.id);
    }

    // Auto-save session
    saveSessionToLocalStorage();
}

// Render players list
function renderPlayers() {
    const list = document.getElementById('playersList');
    list.innerHTML = currentSession.players.map(player => `
        <div class="player-card ${player.id === currentSession.currentPlayerId ? 'active' : ''}" 
             data-player-id="${player.id}" 
             onclick="selectPlayer('${player.id}')">
            <div class="player-card-header">
                <div class="player-number">#${player.number}</div>
                <button class="remove-player-btn" onclick="event.stopPropagation(); removePlayer('${player.id}')">✕</button>
            </div>
            <div class="player-name">${player.name}</div>
            <div class="player-details">${player.position} • ${player.team}</div>
        </div>
    `).join('');
}

// Select player for tracking
window.selectPlayer = function (playerId) {
    currentSession.currentPlayerId = playerId;
    const player = currentSession.players.find(p => p.id === playerId);

    if (!player) return;

    // Update UI
    renderPlayers();

    const banner = document.getElementById('currentPlayerInfo');
    banner.textContent = `Tracking: ${player.name} (#${player.number}) - ${player.team}`;

    // Update all stat displays
    updateStatDisplays(player);

    // Show tracking section
    document.getElementById('statTrackingSection').style.display = 'block';
    document.getElementById('sessionSummarySection').style.display = 'block';
    renderSummary();

    // Auto-save session
    saveSessionToLocalStorage();
}

// Remove player
window.removePlayer = function (playerId) {
    if (confirm('Rimuovere questo giocatore?')) {
        currentSession.players = currentSession.players.filter(p => p.id !== playerId);
        if (currentSession.currentPlayerId === playerId) {
            currentSession.currentPlayerId = null;
        }
        renderPlayers();
        if (currentSession.players.length === 0) {
            document.getElementById('statTrackingSection').style.display = 'none';
        } else if (currentSession.currentPlayerId === null && currentSession.players.length > 0) {
            selectPlayer(currentSession.players[0].id);
        }

        // Auto-save session
        saveSessionToLocalStorage();
    }
}

// Handle stat button click
function handleStatClick(event) {
    const btn = event.currentTarget;
    const category = btn.dataset.category;
    const type = btn.dataset.type;

    if (!currentSession.currentPlayerId) {
        alert('Seleziona prima un giocatore');
        return;
    }

    const player = currentSession.players.find(p => p.id === currentSession.currentPlayerId);
    if (!player) return;

    // Increment stat
    player.stats[category][type]++;

    // Record action for undo
    currentSession.actionHistory.push({
        playerId: player.id,
        category,
        type,
        timestamp: Date.now()
    });

    // Update display
    updateStatDisplays(player);
    renderSummary();

    // Enable undo button
    document.getElementById('undoBtn').disabled = false;

    // Visual feedback
    btn.style.transform = 'scale(1.1)';
    setTimeout(() => {
        btn.style.transform = '';
    }, 200);

    // Save to localStorage
    saveSessionToLocalStorage();
}

// Update stat displays
function updateStatDisplays(player) {
    Object.keys(player.stats).forEach(category => {
        Object.keys(player.stats[category]).forEach(type => {
            const element = document.getElementById(`${category}-${type}`);
            if (element) {
                element.textContent = player.stats[category][type];
            }
        });
    });
}

// Undo last action
function undoLastAction() {
    if (currentSession.actionHistory.length === 0) return;

    const lastAction = currentSession.actionHistory.pop();
    const player = currentSession.players.find(p => p.id === lastAction.playerId);

    if (player) {
        player.stats[lastAction.category][lastAction.type]--;
        updateStatDisplays(player);
        renderSummary();
    }

    if (currentSession.actionHistory.length === 0) {
        document.getElementById('undoBtn').disabled = true;
    }

    saveSessionToLocalStorage();
}

// Render summary
function renderSummary() {
    const content = document.getElementById('summaryContent');
    content.innerHTML = currentSession.players.map(player => {
        const stats = player.stats;
        return `
            <div class="player-summary">
                <div class="player-summary-header">${player.name} (#${player.number}) - ${player.team}</div>
                <div class="stats-grid">
                    <div class="stat-item">
                        <div class="stat-item-label">Serve Aces</div>
                        <div class="stat-item-value">${stats.serves.ace}</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-item-label">Attack Kills</div>
                        <div class="stat-item-value">${stats.attacks.kill}</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-item-label">Blocks</div>
                        <div class="stat-item-value">${stats.blocks.solo + stats.blocks.assist}</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-item-label">Digs</div>
                        <div class="stat-item-value">${stats.digs.successful}</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-item-label">Set Assists</div>
                        <div class="stat-item-value">${stats.sets.assist}</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-item-label">Reception Eff</div>
                        <div class="stat-item-value">${calculateReceptionEfficiency(stats.receptions)}%</div>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// Calculate reception efficiency
function calculateReceptionEfficiency(receptions) {
    const total = receptions.perfect + receptions.good + receptions.error;
    if (total === 0) return 0;
    return Math.round(((receptions.perfect * 3 + receptions.good * 2) / (total * 3)) * 100);
}

// Save session to localStorage
async function saveSession() {
    if (currentSession.players.length === 0) {
        alert('Nessun giocatore da salvare');
        return;
    }

    try {
        saveSessionToLocalStorage();
        alert('✅ Sessione salvata con successo in memoria locale!\n\nSuggerimento: Usa Esporta per scaricare come CSV.');
    } catch (error) {
        console.error('Error saving session:', error);
        alert('Errore durante il salvataggio della sessione.');
    }
}

// Save session data to localStorage with 1-week expiry
function saveSessionToLocalStorage() {
    try {
        const user = getCurrentUser();
        const sessionData = {
            ...currentSession,
            scoutedBy: user ? user.email : 'unknown',
            lastSaved: Date.now(),
            expiryDate: Date.now() + (7 * 24 * 60 * 60 * 1000) // 1 week
        };

        localStorage.setItem('scout_current_session', JSON.stringify(sessionData));
        console.log('Session auto-saved');
    } catch (error) {
        console.error('Error saving to localStorage:', error);
    }
}

// Restore session from localStorage
function restoreSession() {
    try {
        const saved = localStorage.getItem('scout_current_session');
        if (!saved) return;

        const sessionData = JSON.parse(saved);

        // Check if session expired (> 1 week old)
        if (sessionData.expiryDate && sessionData.expiryDate < Date.now()) {
            console.log('Session expired, clearing...');
            localStorage.removeItem('scout_current_session');
            return;
        }

        // Restore session
        if (sessionData.matchId && sessionData.players && sessionData.players.length > 0) {
            currentSession = sessionData;

            // Restore UI state
            const matchSelect = document.getElementById('matchSelect');
            if (matchSelect) {
                matchSelect.value = sessionData.matchId;

                // Trigger match selection to restore all UI
                const matchInfo = document.getElementById('selectedMatchInfo');
                if (matchInfo && currentSession.matchData) {
                    matchInfo.innerHTML = `
                        <strong>${currentSession.matchData.SquadraCasa} vs ${currentSession.matchData.SquadraOspite}</strong><br>
                        📅 ${currentSession.matchData.Data} ⏰ ${currentSession.matchData.Ora || 'TBD'}<br>
                        📍 ${currentSession.matchData.Impianto || 'TBD'}
                    `;
                    matchInfo.style.display = 'block';
                }

                // Populate team selector
                const teamSelect = document.getElementById('playerTeam');
                if (teamSelect && currentSession.matchData) {
                    teamSelect.innerHTML = `
                        <option value="">Seleziona squadra</option>
                        <option value="${currentSession.matchData.SquadraCasa}">${currentSession.matchData.SquadraCasa}</option>
                        <option value="${currentSession.matchData.SquadraOspite}">${currentSession.matchData.SquadraOspite}</option>
                    `;
                }

                // Show sections
                document.getElementById('playerSetupSection').style.display = 'block';
                document.getElementById('activePlayersSection').style.display = 'block';
                document.getElementById('statTrackingSection').style.display = 'block';
                document.getElementById('sessionSummarySection').style.display = 'block';

                // Render players
                renderPlayers();

                // Select first player
                if (currentSession.currentPlayerId) {
                    selectPlayer(currentSession.currentPlayerId);
                } else if (currentSession.players.length > 0) {
                    selectPlayer(currentSession.players[0].id);
                }

                renderSummary();

                console.log('✅ Session restored successfully');
                alert('Sessione precedente ripristinata!');
            }
        }
    } catch (error) {
        console.error('Error restoring session:', error);
        localStorage.removeItem('scout_current_session');
    }
}

// Export data
function exportData() {
    if (currentSession.players.length === 0) {
        alert('Nessun dato da esportare');
        return;
    }

    // Ask user for export format
    const format = confirm('Clicca OK per esportare come immagine PDF, Annulla per CSV');

    if (format) {
        exportToPDF();
    } else {
        exportToCSV();
    }
}

// Export to CSV
function exportToCSV() {
    const rows = [
        ['RM Volley - Scout Report'],
        [''],
        ['Match Information'],
        ['Date', currentSession.matchData.Data],
        ['Time', currentSession.matchData.Ora || 'N/A'],
        ['Teams', `${currentSession.matchData.SquadraCasa} vs ${currentSession.matchData.SquadraOspite}`],
        ['Venue', currentSession.matchData.Impianto || 'N/A'],
        ['Scouted by', getCurrentUser()?.email || 'Unknown'],
        [''],
        ['Player Statistics'],
        ['Player', 'Number', 'Team', 'Position',
            'Serve Aces', 'Serve Errors', 'Serves In Play',
            'Attack Kills', 'Attack Errors', 'Attacks Blocked',
            'Block Solos', 'Block Assists', 'Block Errors',
            'Digs', 'Dig Errors',
            'Set Assists', 'Set Errors',
            'Perfect Receptions', 'Good Receptions', 'Reception Errors',
            'Reception Efficiency %']
    ];

    currentSession.players.forEach(player => {
        const s = player.stats;
        const recEff = calculateReceptionEfficiency(s.receptions);
        rows.push([
            player.name,
            player.number,
            player.team,
            player.position,
            s.serves.ace, s.serves.error, s.serves.inPlay,
            s.attacks.kill, s.attacks.error, s.attacks.blocked,
            s.blocks.solo, s.blocks.assist, s.blocks.error,
            s.digs.successful, s.digs.error,
            s.sets.assist, s.sets.error,
            s.receptions.perfect, s.receptions.good, s.receptions.error,
            recEff
        ]);
    });

    const csv = rows.map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `scout-${currentSession.matchData.Data.replace(/\//g, '-')}-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    alert('✅ CSV esportato con successo!');
}

// Export to PDF
function exportToPDF() {
    // Create PDF content manually using HTML canvas
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = 800;
    canvas.height = 1100;

    // White background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    let y = 40;

    // Title
    ctx.fillStyle = '#667eea';
    ctx.font = 'bold 28px Arial';
    ctx.fillText('🏐 RM Volley - Scout Report', 40, y);
    y += 50;

    // Match Info
    ctx.fillStyle = '#333';
    ctx.font = 'bold 16px Arial';
    ctx.fillText('Match Information', 40, y);
    y += 25;

    ctx.font = '14px Arial';
    ctx.fillText(`Date: ${currentSession.matchData.Data}`, 40, y);
    y += 20;
    ctx.fillText(`Time: ${currentSession.matchData.Ora || 'N/A'}`, 40, y);
    y += 20;
    ctx.fillText(`Teams: ${currentSession.matchData.SquadraCasa} vs ${currentSession.matchData.SquadraOspite}`, 40, y);
    y += 20;
    ctx.fillText(`Venue: ${currentSession.matchData.Impianto || 'N/A'}`, 40, y);
    y += 20;
    ctx.fillText(`Scouted by: ${getCurrentUser()?.email || 'Unknown'}`, 40, y);
    y += 40;

    // Player Stats
    ctx.font = 'bold 16px Arial';
    ctx.fillText('Player Statistics', 40, y);
    y += 30;

    currentSession.players.forEach((player, idx) => {
        const s = player.stats;
        const recEff = calculateReceptionEfficiency(s.receptions);

        // Player header
        ctx.fillStyle = '#667eea';
        ctx.font = 'bold 14px Arial';
        ctx.fillText(`${idx + 1}. ${player.name} (#${player.number}) - ${player.position}`, 40, y);
        y += 20;

        ctx.fillStyle = '#666';
        ctx.font = '12px Arial';
        ctx.fillText(`Team: ${player.team}`, 60, y);
        y += 20;

        // Stats in columns
        ctx.fillStyle = '#333';
        ctx.font = '11px Arial';
        ctx.fillText(`Serves: ${s.serves.ace}A / ${s.serves.error}E / ${s.serves.inPlay}P`, 60, y);
        ctx.fillText(`Attacks: ${s.attacks.kill}K / ${s.attacks.error}E / ${s.attacks.blocked}B`, 280, y);
        y += 18;
        ctx.fillText(`Blocks: ${s.blocks.solo}S / ${s.blocks.assist}A / ${s.blocks.error}E`, 60, y);
        ctx.fillText(`Digs: ${s.digs.successful} / ${s.digs.error}E`, 280, y);
        y += 18;
        ctx.fillText(`Sets: ${s.sets.assist}A / ${s.sets.error}E`, 60, y);
        ctx.fillText(`Receptions: ${s.receptions.perfect}P / ${s.receptions.good}G / ${s.receptions.error}E (${recEff}%)`, 280, y);
        y += 30;

        // Line separator
        ctx.strokeStyle = '#e0e0e0';
        ctx.beginPath();
        ctx.moveTo(40, y - 5);
        ctx.lineTo(760, y - 5);
        ctx.stroke();
        y += 10;
    });

    // Convert canvas to blob and download
    canvas.toBlob((blob) => {
        // Since we can't use jsPDF without loading it, let's create a simple download
        // Convert to image instead
        const url = canvas.toDataURL('image/png');
        const a = document.createElement('a');
        a.href = url;
        a.download = `scout-report-${currentSession.matchData.Data.replace(/\//g, '-')}.png`;
        a.click();

        alert('✅ Report esportato come immagine! Per un vero PDF, usa l\'esportazione CSV e converti con Excel/Google Sheets.');
    });
}

// Clean up expired sessions periodically
setInterval(() => {
    try {
        const saved = localStorage.getItem('scout_current_session');
        if (saved) {
            const sessionData = JSON.parse(saved);
            if (sessionData.expiryDate && sessionData.expiryDate < Date.now()) {
                console.log('Cleaning up expired session');
                localStorage.removeItem('scout_current_session');
            }
        }
    } catch (error) {
        console.error('Error cleaning up sessions:', error);
    }
}, 60000); // Check every minute
