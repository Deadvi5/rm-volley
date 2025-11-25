// ====================================
// Player Statistics Page
// Display aggregated player performance data
// ====================================

import { initializeFirebase, getAllPlayersStatistics, getPlayerStatistics, deletePlayerFromAllSessions } from './scout-firebase.js';

// Global state
let allPlayers = [];
let filteredPlayers = [];

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Initialize Firebase
        initializeFirebase();

        // Setup event listeners
        setupEventListeners();

        // Load player statistics
        await loadPlayerStatistics();

        console.log('✅ Player statistics page initialized');
    } catch (error) {
        console.error('Error initializing player stats:', error);
        showEmptyState();
    }
});

// Setup event listeners
function setupEventListeners() {
    // Search input
    const searchInput = document.getElementById('searchInput');
    searchInput.addEventListener('input', () => {
        filterPlayers();
    });

    // Team filter
    const teamFilter = document.getElementById('teamFilter');
    teamFilter.addEventListener('change', () => {
        filterPlayers();
    });

    // Position filter
    const positionFilter = document.getElementById('positionFilter');
    positionFilter.addEventListener('change', () => {
        filterPlayers();
    });
}

// Load all player statistics
async function loadPlayerStatistics() {
    const loadingState = document.getElementById('loadingState');
    const emptyState = document.getElementById('emptyState');
    const playersSection = document.getElementById('playersSection');

    try {
        loadingState.style.display = 'block';
        emptyState.style.display = 'none';
        playersSection.style.display = 'none';

        // Get all players with aggregated stats
        allPlayers = await getAllPlayersStatistics();

        if (allPlayers.length === 0) {
            showEmptyState();
            return;
        }

        // Sort by matches played (most active first)
        allPlayers.sort((a, b) => b.matchesPlayed - a.matchesPlayed);

        // Populate team filter with unique teams
        populateTeamFilter();

        // Display players
        filteredPlayers = [...allPlayers];
        renderPlayers();

        loadingState.style.display = 'none';
        playersSection.style.display = 'block';

        console.log(`✅ Loaded ${allPlayers.length} players`);
    } catch (error) {
        console.error('Error loading player statistics:', error);
        loadingState.style.display = 'none';
        showEmptyState();
    }
}

// Populate team filter dropdown
function populateTeamFilter() {
    const teamFilter = document.getElementById('teamFilter');
    const teams = [...new Set(allPlayers.map(p => p.team))].sort();

    // Clear existing options (except "All Teams")
    teamFilter.innerHTML = '<option value="">All Teams</option>';

    teams.forEach(team => {
        const option = document.createElement('option');
        option.value = team;
        option.textContent = team;
        teamFilter.appendChild(option);
    });
}

// Filter players based on search and filters
function filterPlayers() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const teamFilter = document.getElementById('teamFilter').value;
    const positionFilter = document.getElementById('positionFilter').value;

    filteredPlayers = allPlayers.filter(player => {
        const nameMatch = player.name.toLowerCase().includes(searchTerm);
        const teamMatch = !teamFilter || player.team === teamFilter;
        const positionMatch = !positionFilter || player.positions.includes(positionFilter);

        return nameMatch && teamMatch && positionMatch;
    });

    renderPlayers();
}

// Render players list
function renderPlayers() {
    const container = document.getElementById('playersList');
    const countElement = document.getElementById('playerCount');

    countElement.textContent = `${filteredPlayers.length} giocator${filteredPlayers.length !== 1 ? 'i' : 'e'}`;

    if (filteredPlayers.length === 0) {
        container.innerHTML = '<div class="no-results">Nessun giocatore trovato con i filtri selezionati.</div>';
        return;
    }

    container.innerHTML = filteredPlayers.map(player => {
        const stats = player.totalStats;
        const eff = player.efficiency;

        return `
            <div class="player-stats-card" onclick="showPlayerDetail('${escapeHtml(player.name)}', '${escapeHtml(player.team)}')">
                <div class="player-card-header">
                    <div class="player-info">
                        <div class="player-name">${escapeHtml(player.name)}</div>
                        <div class="player-meta">
                            ${player.number ? `#${player.number} • ` : ''}${player.team}
                        </div>
                        <div class="player-positions">${player.positions.join(', ')}</div>
                    </div>
                    <div class="matches-badge">${player.matchesPlayed} match${player.matchesPlayed !== 1 ? 'es' : ''}</div>
                </div>

                <div class="stats-summary">
                    <div class="stat-highlight">
                        <div class="stat-label">Attacks</div>
                        <div class="stat-value">${stats.attacks.kill}</div>
                        <div class="stat-subtext">${eff.attack}% eff</div>
                    </div>
                    <div class="stat-highlight">
                        <div class="stat-label">Aces</div>
                        <div class="stat-value">${stats.serves.ace}</div>
                        <div class="stat-subtext">${eff.serve}% rate</div>
                    </div>
                    <div class="stat-highlight">
                        <div class="stat-label">Blocks</div>
                        <div class="stat-value">${stats.blocks.solo + stats.blocks.assist}</div>
                        <div class="stat-subtext">${eff.block}% eff</div>
                    </div>
                    <div class="stat-highlight">
                        <div class="stat-label">Digs</div>
                        <div class="stat-value">${stats.digs.successful}</div>
                        <div class="stat-subtext">${eff.dig}% eff</div>
                    </div>
                </div>

                <div class="efficiency-bars">
                    <div class="efficiency-item">
                        <span class="efficiency-label">Reception</span>
                        <div class="efficiency-bar">
                            <div class="efficiency-fill" style="width: ${eff.reception}%"></div>
                        </div>
                        <span class="efficiency-value">${eff.reception}%</span>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

// Show player detail modal
window.showPlayerDetail = async function (playerName, team) {
    const modal = document.getElementById('playerDetailModal');
    const nameElement = document.getElementById('playerDetailName');
    const contentElement = document.getElementById('playerDetailContent');

    modal.style.display = 'flex';
    nameElement.textContent = 'Loading...';
    contentElement.innerHTML = '<div class="loading-spinner">Loading player details...</div>';

    try {
        const playerStats = await getPlayerStatistics(playerName, team);

        nameElement.textContent = `${playerStats.playerName} - ${playerStats.team}`;

        contentElement.innerHTML = `
            <div class="player-detail-summary">
                <div class="detail-stat">
                    <div class="detail-stat-label">Total Matches</div>
                    <div class="detail-stat-value">${playerStats.matchesPlayed}</div>
                </div>
                <div class="detail-stat">
                    <div class="detail-stat-label">Positions</div>
                    <div class="detail-stat-value">${playerStats.positions.join(', ')}</div>
                </div>
            </div>

            <div class="detail-stats-grid">
                <div class="detail-category">
                    <h3>🏐 Serves</h3>
                    <div class="detail-stat-row">
                        <span>Aces</span>
                        <span class="good">${playerStats.totalStats.serves.ace}</span>
                    </div>
                    <div class="detail-stat-row">
                        <span>Errors</span>
                        <span class="error">${playerStats.totalStats.serves.error}</span>
                    </div>
                    <div class="detail-stat-row">
                        <span>In Play</span>
                        <span>${playerStats.totalStats.serves.inPlay}</span>
                    </div>
                    <div class="efficiency-display">Efficiency: ${playerStats.efficiency.serve}%</div>
                </div>

                <div class="detail-category">
                    <h3>⚡ Attacks</h3>
                    <div class="detail-stat-row">
                        <span>Kills</span>
                        <span class="good">${playerStats.totalStats.attacks.kill}</span>
                    </div>
                    <div class="detail-stat-row">
                        <span>Errors</span>
                        <span class="error">${playerStats.totalStats.attacks.error}</span>
                    </div>
                    <div class="detail-stat-row">
                        <span>Blocked</span>
                        <span>${playerStats.totalStats.attacks.blocked}</span>
                    </div>
                    <div class="efficiency-display">Efficiency: ${playerStats.efficiency.attack}%</div>
                </div>

                <div class="detail-category">
                    <h3>🚫 Blocks</h3>
                    <div class="detail-stat-row">
                        <span>Solo</span>
                        <span class="good">${playerStats.totalStats.blocks.solo}</span>
                    </div>
                    <div class="detail-stat-row">
                        <span>Assists</span>
                        <span class="good">${playerStats.totalStats.blocks.assist}</span>
                    </div>
                    <div class="detail-stat-row">
                        <span>Errors</span>
                        <span class="error">${playerStats.totalStats.blocks.error}</span>
                    </div>
                    <div class="efficiency-display">Success: ${playerStats.efficiency.block}%</div>
                </div>

                <div class="detail-category">
                    <h3>🛡️ Digs</h3>
                    <div class="detail-stat-row">
                        <span>Successful</span>
                        <span class="good">${playerStats.totalStats.digs.successful}</span>
                    </div>
                    <div class="detail-stat-row">
                        <span>Errors</span>
                        <span class="error">${playerStats.totalStats.digs.error}</span>
                    </div>
                    <div class="efficiency-display">Success: ${playerStats.efficiency.dig}%</div>
                </div>

                <div class="detail-category">
                    <h3>🤲 Sets</h3>
                    <div class="detail-stat-row">
                        <span>Assists</span>
                        <span class="good">${playerStats.totalStats.sets.assist}</span>
                    </div>
                    <div class="detail-stat-row">
                        <span>Errors</span>
                        <span class="error">${playerStats.totalStats.sets.error}</span>
                    </div>
                    <div class="efficiency-display">Success: ${playerStats.efficiency.set}%</div>
                </div>

                <div class="detail-category">
                    <h3>📥 Receptions</h3>
                    <div class="detail-stat-row">
                        <span>Perfect</span>
                        <span class="good">${playerStats.totalStats.receptions.perfect}</span>
                    </div>
                    <div class="detail-stat-row">
                        <span>Good</span>
                        <span>${playerStats.totalStats.receptions.good}</span>
                    </div>
                    <div class="detail-stat-row">
                        <span>Errors</span>
                        <span class="error">${playerStats.totalStats.receptions.error}</span>
                    </div>
                    <div class="efficiency-display">Efficiency: ${playerStats.efficiency.reception}%</div>
                </div>
            </div>

            <div class="match-history">
                <h3>Match History</h3>
                <div class="match-history-list">
                    ${playerStats.matchHistory.map(match => `
                        <div class="match-history-item">
                            <div class="match-history-header">
                                <strong>${match.matchData.SquadraCasa} vs ${match.matchData.SquadraOspite}</strong>
                                <span class="match-date">${match.matchData.Data}</span>
                            </div>
                            <div class="match-stats-compact">
                                Serves: ${match.stats.serves.ace}A / ${match.stats.serves.error}E | 
                                Attacks: ${match.stats.attacks.kill}K / ${match.stats.attacks.error}E | 
                                Blocks: ${match.stats.blocks.solo + match.stats.blocks.assist} | 
                                Digs: ${match.stats.digs.successful}
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>

            <div class="delete-player-section" style="margin-top: 24px; padding-top: 24px; border-top: 2px solid #f0f0f0; text-align: center;">
                <button onclick="deletePlayer('${escapeHtml(playerStats.playerName)}', '${escapeHtml(playerStats.team)}')" class="delete-player-btn" style="background: #ef4444; color: white; padding: 12px 24px; border: none; border-radius: 8px; font-size: 15px; font-weight: 600; cursor: pointer;">
                    🗑️ Delete Player
                </button>
                <p style="margin-top: 8px; font-size: 13px; color: #666;">This will remove the player from all scout sessions</p>
            </div>
        `;
    } catch (error) {
        console.error('Error loading player details:', error);
        contentElement.innerHTML = '<div class="error-message">Error loading player details. Please try again.</div>';
    }
};

// Delete player from all sessions
window.deletePlayer = async function (playerName, team) {
    if (!confirm(`Are you sure you want to delete ${playerName} from ${team}?\n\nThis will remove them from ALL scout sessions and cannot be undone.`)) {
        return;
    }

    try {
        const updatedCount = await deletePlayerFromAllSessions(playerName, team);

        // Also remove from localStorage if exists
        try {
            const localSession = localStorage.getItem('scout_current_session');
            if (localSession) {
                const sessionData = JSON.parse(localSession);
                if (sessionData.players && Array.isArray(sessionData.players)) {
                    const originalLength = sessionData.players.length;
                    sessionData.players = sessionData.players.filter(
                        p => !(p.name.toLowerCase() === playerName.toLowerCase() &&
                            p.team.toLowerCase() === team.toLowerCase())
                    );

                    if (sessionData.players.length < originalLength) {
                        localStorage.setItem('scout_current_session', JSON.stringify(sessionData));
                        console.log('✅ Player removed from localStorage session');
                    }
                }
            }
        } catch (localError) {
            console.warn('Could not update localStorage:', localError);
        }

        // Close modal
        closePlayerDetail();

        // Show success message
        alert(`✅ Player deleted! Removed from ${updatedCount} session(s).`);

        // Reload player statistics
        await loadPlayerStatistics();
    } catch (error) {
        console.error('Error deleting player:', error);
        alert('❌ Error deleting player. Please try again.');
    }
};

// Close player detail modal
window.closePlayerDetail = function () {
    document.getElementById('playerDetailModal').style.display = 'none';
};

// Show empty state
function showEmptyState() {
    document.getElementById('loadingState').style.display = 'none';
    document.getElementById('emptyState').style.display = 'block';
    document.getElementById('playersSection').style.display = 'none';
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
