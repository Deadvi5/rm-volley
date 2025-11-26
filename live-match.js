// ====================================
// Live Match - Real-time Chat & Score
// Firebase Realtime Database
// ====================================

import firebaseConfig from './firebase-config.js';

// Initialize Firebase
let database = null;
let currentMatch = null;
let username = null;
let messagesRef = null;
let scoresRef = null;
const MESSAGE_EXPIRY = 4 * 60 * 60 * 1000; // 4 hours

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Initialize Firebase
        if (!firebase.apps.length) {
            firebase.initializeApp(firebaseConfig);
        }
        database = firebase.database();

        // Get match data from URL
        const params = new URLSearchParams(window.location.search);
        const matchData = params.get('match');

        if (!matchData) {
            alert('No match data found');
            window.location.href = 'index.html';
            return;
        }

        currentMatch = JSON.parse(decodeURIComponent(matchData));

        // Setup Firebase references
        const matchKey = getMatchKey();
        messagesRef = database.ref(`live-matches/${matchKey}/messages`);
        scoresRef = database.ref(`live-matches/${matchKey}/scores`);

        // Load match info
        loadMatchInfo();

        // Check for username
        username = localStorage.getItem('live_chat_username');
        if (!username) {
            showUsernameModal();
        }

        // Setup event listeners
        setupEventListeners();

        // Listen for real-time score updates
        listenToScores();

        // Listen for real-time messages
        listenToMessages();

        // Listen for completed sets
        listenToCompletedSets();

        // Clean expired messages periodically
        cleanExpiredMessages();
        setInterval(cleanExpiredMessages, 60000); // Every minute

        console.log('✅ Live match initialized with Firebase');
    } catch (error) {
        console.error('Error initializing live match:', error);

        // Check if it's a Firebase config issue
        if (error.message.includes('apiKey') || error.message.includes('projectId')) {
            alert('⚠️ Firebase not configured!\n\nPlease add your Firebase credentials to firebase-config.js\n\nSee implementation_plan.md for setup instructions.');
        } else {
            alert('Error loading live match: ' + error.message);
        }

        // Still allow page to load for testing
        loadMatchInfo();
        setupEventListeners();
        showUsernameModal();
    }
});

// Get match storage key
function getMatchKey() {
    return `${currentMatch.SquadraCasa}_vs_${currentMatch.SquadraOspite}_${currentMatch.Data}`
        .replace(/\s+/g, '_')
        .replace(/\//g, '-');
}

// Load match information
function loadMatchInfo() {
    document.getElementById('homeTeam').textContent = currentMatch.SquadraCasa || 'Home Team';
    document.getElementById('awayTeam').textContent = currentMatch.SquadraOspite || 'Away Team';
    document.getElementById('matchDate').textContent = `📅 ${currentMatch.Data} • ⏰ ${currentMatch.Ora || 'TBD'}`;
    document.getElementById('matchLocation').textContent = `📍 ${currentMatch.Impianto || 'Location TBD'}`;
}

// Setup event listeners
function setupEventListeners() {
    // Chat input
    const chatInput = document.getElementById('chatInput');
    const sendBtn = document.getElementById('sendBtn');

    sendBtn.addEventListener('click', sendMessage);
    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });

    // Refresh button
    document.getElementById('refreshBtn').addEventListener('click', () => {
        // Firebase auto-refreshes, just visual feedback
        const btn = document.getElementById('refreshBtn');
        btn.style.transform = 'rotate(360deg)';
        btn.style.transition = 'transform 0.6s';
        setTimeout(() => {
            btn.style.transform = '';
        }, 600);
    });
}

// Show username modal
function showUsernameModal() {
    const modal = document.getElementById('usernameModal');
    modal.style.display = 'flex';

    const input = document.getElementById('usernameInput');
    const btn = document.getElementById('setUsernameBtn');

    btn.onclick = () => {
        const name = input.value.trim();
        if (name.length < 2) {
            alert('Please enter a name with at least 2 characters');
            return;
        }

        username = name;
        localStorage.setItem('live_chat_username', name);
        modal.style.display = 'none';

        // Focus chat input
        document.getElementById('chatInput').focus();
    };

    // Allow Enter key
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            btn.click();
        }
    });

    // Focus input
    input.focus();
}

// Update score (writes to Firebase)
window.updateScore = function (team, delta) {
    if (!scoresRef) {
        console.error('Firebase not initialized');
        return;
    }

    scoresRef.once('value').then((snapshot) => {
        const current = snapshot.val() || { home: 0, away: 0 };
        const newScore = Math.max(0, (current[team] || 0) + delta);

        scoresRef.update({
            [team]: newScore,
            lastUpdate: Date.now()
        });
    }).catch((error) => {
        console.error('Error updating score:', error);
    });
};

// Listen to real-time score updates
function listenToScores() {
    if (!scoresRef) return;

    scoresRef.on('value', (snapshot) => {
        const scores = snapshot.val() || { home: 0, away: 0 };
        document.getElementById('homeScore').textContent = scores.home || 0;
        document.getElementById('awayScore').textContent = scores.away || 0;
    });
}

// Send message (writes to Firebase)
function sendMessage() {
    if (!username) {
        showUsernameModal();
        return;
    }

    if (!messagesRef) {
        console.error('Firebase not initialized');
        return;
    }

    const input = document.getElementById('chatInput');
    const text = input.value.trim();

    if (!text) return;

    // Create new message
    const message = {
        username: username,
        text: text,
        timestamp: Date.now(),
        expiresAt: Date.now() + MESSAGE_EXPIRY
    };

    // Push to Firebase (auto-generates unique ID)
    messagesRef.push(message)
        .then(() => {
            // Clear input
            input.value = '';
        })
        .catch((error) => {
            console.error('Error sending message:', error);
            alert('Failed to send message. Please check your connection.');
        });
}

// Listen to real-time messages
function listenToMessages() {
    if (!messagesRef) return;

    messagesRef.on('value', (snapshot) => {
        const messages = [];
        const now = Date.now();

        snapshot.forEach((childSnapshot) => {
            const msg = childSnapshot.val();
            // Only include non-expired messages
            if (msg.expiresAt > now) {
                messages.push({
                    id: childSnapshot.key,
                    ...msg
                });
            }
        });

        // Sort by timestamp
        messages.sort((a, b) => a.timestamp - b.timestamp);

        renderMessages(messages);
    });
}

// Render messages
function renderMessages(messages) {
    const container = document.getElementById('chatMessages');

    if (messages.length === 0) {
        container.innerHTML = '<div class="chat-empty">No messages yet. Be the first to comment!</div>';
        return;
    }

    container.innerHTML = messages.map(msg => {
        const isOwn = msg.username === username;
        const time = new Date(msg.timestamp).toLocaleTimeString('it-IT', {
            hour: '2-digit',
            minute: '2-digit'
        });

        return `
            <div class="chat-message ${isOwn ? 'own' : ''}">
                <div class="message-header">
                    <span class="message-username">${escapeHtml(msg.username)}</span>
                    <span class="message-time">${time}</span>
                </div>
                <div class="message-text">${escapeHtml(msg.text)}</div>
            </div>
        `;
    }).join('');

    // Scroll to bottom
    container.scrollTop = container.scrollHeight;

    // Update online count (approximate based on recent messages)
    const recentMessages = messages.filter(m => m.timestamp > Date.now() - 5 * 60 * 1000); // Last 5 min
    const uniqueUsers = new Set(recentMessages.map(m => m.username)).size;
    document.getElementById('onlineCount').textContent = `${uniqueUsers} recent participant${uniqueUsers !== 1 ? 's' : ''}`;
}

// Clean expired messages
function cleanExpiredMessages() {
    if (!messagesRef) return;

    const now = Date.now();

    messagesRef.once('value').then((snapshot) => {
        const updates = {};
        let removedCount = 0;

        snapshot.forEach((childSnapshot) => {
            const msg = childSnapshot.val();
            if (msg.expiresAt <= now) {
                updates[childSnapshot.key] = null; // null deletes in Firebase
                removedCount++;
            }
        });

        if (removedCount > 0) {
            messagesRef.update(updates);
            console.log(`Cleaned ${removedCount} expired messages`);
        }
    }).catch((error) => {
        console.error('Error cleaning messages:', error);
    });
}

// Show end set modal
window.showEndSetModal = function () {
    const modal = document.getElementById('endSetModal');
    modal.style.display = 'flex';

    // Update labels with team names
    document.getElementById('homeTeamLabel').textContent = currentMatch.SquadraCasa || 'Home';
    document.getElementById('awayTeamLabel').textContent = currentMatch.SquadraOspite || 'Away';

    // Pre-fill with current scores
    scoresRef.once('value').then((snapshot) => {
        const scores = snapshot.val() || { home: 0, away: 0 };
        document.getElementById('homeSetScore').value = scores.home || 25;
        document.getElementById('awaySetScore').value = scores.away || 23;
    });
};

// Close end set modal
window.closeEndSetModal = function () {
    document.getElementById('endSetModal').style.display = 'none';
};

// Confirm end set
window.confirmEndSet = function () {
    const homeScore = parseInt(document.getElementById('homeSetScore').value);
    const awayScore = parseInt(document.getElementById('awaySetScore').value);

    if (isNaN(homeScore) || isNaN(awayScore) || homeScore < 0 || awayScore < 0) {
        alert('Please enter valid scores');
        return;
    }

    // Validate volleyball set rules (winner must have at least 25 and lead by 2)
    const maxScore = Math.max(homeScore, awayScore);
    const minScore = Math.min(homeScore, awayScore);

    if (maxScore < 25 || (maxScore - minScore < 2)) {
        const confirm = window.confirm(
            'This score doesn\'t follow standard volleyball rules (winner needs 25+ and lead by 2).\n\nContinue anyway?'
        );
        if (!confirm) return;
    }

    // Get match reference
    const matchKey = getMatchKey();
    const setsRef = database.ref(`live-matches/${matchKey}/sets`);

    // Add new set
    setsRef.push({
        home: homeScore,
        away: awayScore,
        timestamp: Date.now()
    }).then(() => {
        // Reset current set scores to 0
        scoresRef.update({
            home: 0,
            away: 0,
            lastUpdate: Date.now()
        });

        // Close modal
        closeEndSetModal();

        // Show success message
        console.log(`✅ Set completed: ${homeScore}-${awayScore}`);
    }).catch((error) => {
        console.error('Error ending set:', error);
        alert('Failed to end set. Please try again.');
    });
};

// Listen to completed sets
function listenToCompletedSets() {
    if (!database) return;

    const matchKey = getMatchKey();
    const setsRef = database.ref(`live-matches/${matchKey}/sets`);

    setsRef.on('value', (snapshot) => {
        const sets = [];
        snapshot.forEach((childSnapshot) => {
            sets.push({
                id: childSnapshot.key,
                ...childSnapshot.val()
            });
        });

        // Sort by timestamp
        sets.sort((a, b) => a.timestamp - b.timestamp);

        renderCompletedSets(sets);
    });
}

// Render completed sets
function renderCompletedSets(sets) {
    const container = document.getElementById('completedSets');

    if (sets.length === 0) {
        container.style.display = 'none';
        return;
    }

    container.style.display = 'block';

    // Calculate set wins
    let homeWins = 0;
    let awayWins = 0;

    const setsHTML = sets.map((set, index) => {
        const homeWon = set.home > set.away;
        if (homeWon) homeWins++;
        else awayWins++;

        return `<span class="set-score-badge">Set ${index + 1}: ${set.home}-${set.away}</span>`;
    }).join('');

    container.innerHTML = `
        <div class="completed-sets-title">Completed Sets (${homeWins}-${awayWins})</div>
        <div class="sets-list">${setsHTML}</div>
    `;
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Clean up Firebase listeners
function cleanupFirebaseListeners() {
    if (scoresRef) {
        scoresRef.off();
        console.log('🧹 Cleaned up scores listener');
    }
    if (messagesRef) {
        messagesRef.off();
        console.log('🧹 Cleaned up messages listener');
    }
}

// Export cleanup function for external use
window.cleanupLiveMatch = cleanupFirebaseListeners;

// Clean up on page unload
window.addEventListener('beforeunload', cleanupFirebaseListeners);

// Also clean up on visibility change (when user navigates away)
document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        cleanupFirebaseListeners();
    }
});
