// ====================================
// Scout Firebase Module
// Firebase Realtime Database operations for scout sessions
// ====================================

import firebaseConfig from './firebase-config.js';

// Initialize Firebase (if not already initialized)
let database = null;
let scoutSessionsRef = null;
let teamRostersRef = null;

/**
 * Initialize Firebase database connection
 */
export function initializeFirebase() {
    try {
        if (!firebase.apps.length) {
            firebase.initializeApp(firebaseConfig);
        }
        database = firebase.database();
        scoutSessionsRef = database.ref('scout-sessions');
        teamRostersRef = database.ref('team-rosters');
        console.log('✅ Scout Firebase module initialized');
        return true;
    } catch (error) {
        console.error('Error initializing Firebase:', error);
        return false;
    }
}

/**
 * Save or update a scout session to Firebase
 * @param {Object} sessionData - The session data to save
 * @returns {Promise<string>} - The session ID
 */
export async function saveScoutSession(sessionData) {
    if (!scoutSessionsRef) {
        initializeFirebase();
    }

    try {
        const sessionId = sessionData.sessionId || `session-${Date.now()}`;

        // Prepare data for Firebase
        const firebaseData = {
            sessionId,
            matchId: sessionData.matchId,
            matchData: sessionData.matchData,
            players: sessionData.players,
            scoutedBy: sessionData.scoutedBy || 'unknown',
            createdAt: sessionData.createdAt || Date.now(),
            lastUpdated: Date.now()
        };

        // Save to Firebase using session ID as key
        await scoutSessionsRef.child(sessionId).set(firebaseData);

        console.log(`✅ Scout session saved to Firebase: ${sessionId}`);
        return sessionId;
    } catch (error) {
        console.error('Error saving scout session to Firebase:', error);
        throw error;
    }
}

/**
 * Get a specific scout session from Firebase
 * @param {string} sessionId - The session ID to retrieve
 * @returns {Promise<Object|null>} - The session data or null if not found
 */
export async function getScoutSession(sessionId) {
    if (!scoutSessionsRef) {
        initializeFirebase();
    }

    try {
        const snapshot = await scoutSessionsRef.child(sessionId).once('value');

        if (snapshot.exists()) {
            return snapshot.val();
        } else {
            console.log(`Session ${sessionId} not found in Firebase`);
            return null;
        }
    } catch (error) {
        console.error('Error retrieving scout session:', error);
        throw error;
    }
}

/**
 * Get all scout sessions from Firebase
 * @returns {Promise<Array>} - Array of all scout sessions
 */
export async function getAllScoutSessions() {
    if (!scoutSessionsRef) {
        initializeFirebase();
    }

    try {
        const snapshot = await scoutSessionsRef.once('value');
        const sessions = [];

        snapshot.forEach((childSnapshot) => {
            sessions.push({
                id: childSnapshot.key,
                ...childSnapshot.val()
            });
        });

        console.log(`✅ Retrieved ${sessions.length} scout sessions from Firebase`);
        return sessions;
    } catch (error) {
        console.error('Error retrieving all scout sessions:', error);
        throw error;
    }
}

/**
 * Get aggregated statistics for a specific player across all matches
 * @param {string} playerName - The player's name
 * @param {string} team - The player's team
 * @returns {Promise<Object>} - Aggregated player statistics
 */
export async function getPlayerStatistics(playerName, team) {
    try {
        const sessions = await getAllScoutSessions();

        // Initialize aggregated stats
        const aggregatedStats = {
            playerName,
            team,
            matchesPlayed: 0,
            positions: new Set(),
            totalStats: {
                serves: { ace: 0, error: 0, inPlay: 0 },
                attacks: { kill: 0, error: 0, blocked: 0 },
                blocks: { solo: 0, assist: 0, error: 0 },
                digs: { successful: 0, error: 0 },
                sets: { assist: 0, error: 0 },
                receptions: { perfect: 0, good: 0, error: 0 }
            },
            matchHistory: []
        };

        // Iterate through all sessions
        sessions.forEach(session => {
            // Find player in this session
            const player = session.players?.find(
                p => p.name.toLowerCase() === playerName.toLowerCase() &&
                    p.team.toLowerCase() === team.toLowerCase()
            );

            if (player) {
                aggregatedStats.matchesPlayed++;
                aggregatedStats.positions.add(player.position);

                // Add match to history
                aggregatedStats.matchHistory.push({
                    matchId: session.matchId,
                    matchData: session.matchData,
                    stats: player.stats,
                    scoutedBy: session.scoutedBy,
                    date: session.matchData?.Data || 'Unknown'
                });

                // Aggregate stats
                Object.keys(aggregatedStats.totalStats).forEach(category => {
                    Object.keys(aggregatedStats.totalStats[category]).forEach(type => {
                        aggregatedStats.totalStats[category][type] +=
                            (player.stats[category]?.[type] || 0);
                    });
                });
            }
        });

        // Convert positions Set to Array
        aggregatedStats.positions = Array.from(aggregatedStats.positions);

        // Calculate efficiency percentages
        aggregatedStats.efficiency = calculateEfficiency(aggregatedStats.totalStats);

        return aggregatedStats;
    } catch (error) {
        console.error('Error getting player statistics:', error);
        throw error;
    }
}

/**
 * Get aggregated statistics for all players
 * @returns {Promise<Array>} - Array of all players with their aggregated stats
 */
export async function getAllPlayersStatistics() {
    try {
        const sessions = await getAllScoutSessions();
        const playersMap = new Map();

        // Iterate through all sessions and collect unique players
        sessions.forEach(session => {
            session.players?.forEach(player => {
                const key = `${player.name.toLowerCase()}|${player.team.toLowerCase()}`;

                if (!playersMap.has(key)) {
                    playersMap.set(key, {
                        name: player.name,
                        team: player.team,
                        number: player.number,
                        positions: new Set([player.position]),
                        matchesPlayed: 0,
                        totalStats: {
                            serves: { ace: 0, error: 0, inPlay: 0 },
                            attacks: { kill: 0, error: 0, blocked: 0 },
                            blocks: { solo: 0, assist: 0, error: 0 },
                            digs: { successful: 0, error: 0 },
                            sets: { assist: 0, error: 0 },
                            receptions: { perfect: 0, good: 0, error: 0 }
                        }
                    });
                }

                const playerData = playersMap.get(key);
                playerData.matchesPlayed++;
                playerData.positions.add(player.position);

                // Aggregate stats
                Object.keys(playerData.totalStats).forEach(category => {
                    Object.keys(playerData.totalStats[category]).forEach(type => {
                        playerData.totalStats[category][type] +=
                            (player.stats[category]?.[type] || 0);
                    });
                });
            });
        });

        // Convert to array and add efficiency calculations
        const players = Array.from(playersMap.values()).map(player => ({
            ...player,
            positions: Array.from(player.positions),
            efficiency: calculateEfficiency(player.totalStats)
        }));

        console.log(`✅ Retrieved statistics for ${players.length} unique players`);
        return players;
    } catch (error) {
        console.error('Error getting all players statistics:', error);
        throw error;
    }
}

/**
 * Calculate efficiency percentages for various stats
 * @param {Object} stats - The statistics object
 * @returns {Object} - Calculated efficiencies
 */
function calculateEfficiency(stats) {
    const efficiency = {};

    // Attack efficiency: (kills - errors) / total attempts
    const totalAttacks = stats.attacks.kill + stats.attacks.error + stats.attacks.blocked;
    if (totalAttacks > 0) {
        efficiency.attack = Math.round(
            ((stats.attacks.kill - stats.attacks.error) / totalAttacks) * 100
        );
    } else {
        efficiency.attack = 0;
    }

    // Serve efficiency: aces / total serves
    const totalServes = stats.serves.ace + stats.serves.error + stats.serves.inPlay;
    if (totalServes > 0) {
        efficiency.serve = Math.round((stats.serves.ace / totalServes) * 100);
    } else {
        efficiency.serve = 0;
    }

    // Reception efficiency: (perfect*3 + good*2) / (total*3)
    const totalReceptions = stats.receptions.perfect + stats.receptions.good + stats.receptions.error;
    if (totalReceptions > 0) {
        efficiency.reception = Math.round(
            ((stats.receptions.perfect * 3 + stats.receptions.good * 2) / (totalReceptions * 3)) * 100
        );
    } else {
        efficiency.reception = 0;
    }

    // Block success rate: (solo + assist) / (solo + assist + error)
    const totalBlockAttempts = stats.blocks.solo + stats.blocks.assist + stats.blocks.error;
    if (totalBlockAttempts > 0) {
        efficiency.block = Math.round(
            ((stats.blocks.solo + stats.blocks.assist) / totalBlockAttempts) * 100
        );
    } else {
        efficiency.block = 0;
    }

    // Dig success rate
    const totalDigs = stats.digs.successful + stats.digs.error;
    if (totalDigs > 0) {
        efficiency.dig = Math.round((stats.digs.successful / totalDigs) * 100);
    } else {
        efficiency.dig = 0;
    }

    // Set success rate
    const totalSets = stats.sets.assist + stats.sets.error;
    if (totalSets > 0) {
        efficiency.set = Math.round((stats.sets.assist / totalSets) * 100);
    } else {
        efficiency.set = 0;
    }

    return efficiency;
}

/**
 * Delete a scout session from Firebase
 * @param {string} sessionId - The session ID to delete
 * @returns {Promise<void>}
 */
export async function deleteScoutSession(sessionId) {
    if (!scoutSessionsRef) {
        initializeFirebase();
    }

    try {
        await scoutSessionsRef.child(sessionId).remove();
        console.log(`✅ Scout session deleted: ${sessionId}`);
    } catch (error) {
        console.error('Error deleting scout session:', error);
        throw error;
    }
}

/**
 * Sanitize team name for use in Firebase paths
 * Firebase paths cannot contain: . # $ [ ]
 * @param {string} teamName - The team name to sanitize
 * @returns {string} - Sanitized team name
 */
function sanitizeTeamName(teamName) {
    return teamName.replace(/[.#$\[\]]/g, '_');
}

/**
 * Save player to team roster
 * @param {string} teamName - The team name
 * @param {Object} player - Player object with name, number, position
 * @returns {Promise<void>}
 */
export async function savePlayerToRoster(teamName, player) {
    if (!teamRostersRef) {
        initializeFirebase();
    }

    try {
        const sanitizedTeam = sanitizeTeamName(teamName);
        const playerId = player.id || `player-${Date.now()}`;
        const playerData = {
            name: player.name,
            number: player.number,
            position: player.position,
            team: teamName, // Store original team name in data
            createdAt: Date.now()
        };

        await teamRostersRef.child(sanitizedTeam).child(playerId).set(playerData);
        console.log(`✅ Saved ${player.name} to ${teamName} roster`);
    } catch (error) {
        console.error('Error saving player to roster:', error);
        throw error;
    }
}

/**
 * Get team roster from Firebase
 * @param {string} teamName - The team name
 * @returns {Promise<Array>} - Array of players in the team
 */
export async function getTeamRoster(teamName) {
    if (!teamRostersRef) {
        initializeFirebase();
    }

    try {
        const sanitizedTeam = sanitizeTeamName(teamName);
        const snapshot = await teamRostersRef.child(sanitizedTeam).once('value');
        const players = [];

        snapshot.forEach((childSnapshot) => {
            players.push({
                id: childSnapshot.key,
                ...childSnapshot.val()
            });
        });

        console.log(`✅ Retrieved ${players.length} players from ${teamName} roster`);
        return players;
    } catch (error) {
        console.error('Error getting team roster:', error);
        throw error;
    }
}

/**
 * Delete player from team roster
 * @param {string} teamName - The team name
 * @param {string} playerId - The player ID to delete
 * @returns {Promise<void>}
 */
export async function deletePlayerFromRoster(teamName, playerId) {
    if (!teamRostersRef) {
        initializeFirebase();
    }

    try {
        const sanitizedTeam = sanitizeTeamName(teamName);
        await teamRostersRef.child(sanitizedTeam).child(playerId).remove();
        console.log(`✅ Deleted player ${playerId} from ${teamName} roster`);
    } catch (error) {
        console.error('Error deleting player from roster:', error);
        throw error;
    }
}

/**
 * Delete a player from all scout sessions
 * @param {string} playerName - The player's name
 * @param {string} team - The player's team
 * @returns {Promise<number>} - Number of sessions updated
 */
export async function deletePlayerFromAllSessions(playerName, team) {
    if (!scoutSessionsRef) {
        initializeFirebase();
    }

    try {
        const sessions = await getAllScoutSessions();
        let updatedCount = 0;

        for (const session of sessions) {
            // Skip sessions without players array
            if (!session.players || !Array.isArray(session.players)) {
                continue;
            }

            // Find player in session
            const playerIndex = session.players.findIndex(
                p => p.name.toLowerCase() === playerName.toLowerCase() &&
                    p.team.toLowerCase() === team.toLowerCase()
            );

            if (playerIndex !== -1) {
                // Remove player from session
                session.players.splice(playerIndex, 1);

                // Update session in Firebase
                await scoutSessionsRef.child(session.sessionId).update({
                    players: session.players,
                    lastUpdated: Date.now()
                });

                updatedCount++;
            }
        }

        console.log(`✅ Deleted ${playerName} from ${updatedCount} sessions`);
        return updatedCount;
    } catch (error) {
        console.error('Error deleting player from all sessions:', error);
        throw error;
    }
}

