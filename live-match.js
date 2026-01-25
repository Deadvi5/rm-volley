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
let setsRef = null;
const MESSAGE_EXPIRY = 4 * 60 * 60 * 1000; // 4 hours

// Connection management
let reconnectTimeout = null;
let isListenersActive = true;
let pageVisibilityState = 'visible';

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

        // Check if match is actually live (10 minutes before) vs just chat available (12 hours before)
        checkMatchLiveStatus();

        // Setup Firebase references and listeners
        initializeFirebaseListeners();

        // Load match info
        loadMatchInfo();

        // Check for username
        username = localStorage.getItem('live_chat_username');
        if (!username) {
            showUsernameModal();
        }

        // Setup event listeners
        setupEventListeners();

        // Clean expired messages periodically
        cleanExpiredMessages();
        setInterval(cleanExpiredMessages, 60000); // Every minute

// Setup scroll tracking for smart auto-scroll
setupScrollTracking();

// Setup keyboard detection for mobile
setupKeyboardDetection();

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
        .replace(/\//g, '-')
        .replace(/[.#$\[\]]/g, '_'); // Remove Firebase-invalid characters
}

// Check if match is actually live (10 minutes before) vs just chat available
function checkMatchLiveStatus() {
    const now = new Date();

    // Parse match date and time
    const [day, month, year] = currentMatch.Data.split('/');
    const matchDate = new Date(year, month - 1, day);

    const timeParts = (currentMatch.Ora || '00:00').split(':');
    const matchTime = new Date(matchDate);
    matchTime.setHours(parseInt(timeParts[0]), parseInt(timeParts[1]), 0, 0);

    // Calculate if match is actually live (10 minutes before)
    const tenMinutesBefore = new Date(matchTime.getTime() - 10 * 60 * 1000);
    const twoHoursAfter = new Date(matchTime.getTime() + 2 * 60 * 60 * 1000);
    const isActuallyLive = now >= tenMinutesBefore && now <= twoHoursAfter;

    // Disable score controls if not actually live
    if (!isActuallyLive) {
        // Hide/disable score controls
        const scoreButtons = document.querySelectorAll('.score-btn');
        scoreButtons.forEach(btn => {
            btn.disabled = true;
            btn.style.opacity = '0.3';
            btn.style.cursor = 'not-allowed';
        });

        // Hide end set button
        const endSetBtn = document.getElementById('endSetBtn');
        if (endSetBtn) {
            endSetBtn.style.display = 'none';
        }

        // Update header badge to show "Chat Available" instead of "LIVE"
        const liveBadge = document.querySelector('.live-badge');
        if (liveBadge) {
            liveBadge.textContent = '💬 Chat Available';
            liveBadge.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
        }

        console.log('📅 Chat available but match not yet live. Score controls disabled.');
    } else {
        console.log('🔴 Match is LIVE. All controls enabled.');
    }
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

    // Send on Enter, new line on Shift+Enter
    chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    // Disable send button when input is empty
    chatInput.addEventListener('input', () => {
        sendBtn.disabled = !chatInput.value.trim();
    });

    // Refresh button - actually reload messages
    document.getElementById('refreshBtn').addEventListener('click', refreshMessages);
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
    const sendBtn = document.getElementById('sendBtn');
    const text = input.value.trim();

    if (!text) return;

    // Disable button while sending
    sendBtn.disabled = true;

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
            // Focus back on input
            input.focus();
        })
        .catch((error) => {
            console.error('Error sending message:', error);
            alert('Failed to send message. Please check your connection.');
            sendBtn.disabled = false;
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

        renderMessagesIncremental(messages);
    });
}

// Track if user is scrolled to bottom
let isUserAtBottom = true;
let lastMessageCount = 0;
let lastProcessedTimestamp = 0;
let renderedMessageIds = new Set();

// Render messages incrementally (performance optimized)
function renderMessagesIncremental(messages) {
    const container = document.getElementById('chatMessages');
    const wasAtBottom = isNearBottom(container);

    if (messages.length === 0) {
        container.innerHTML = '<div class="chat-empty">No messages yet. Be the first to comment!</div>';
        lastProcessedTimestamp = 0;
        renderedMessageIds.clear();
        return;
    }

    // Find new messages (messages with timestamp > lastProcessedTimestamp)
    const newMessages = messages.filter(msg => 
        msg.timestamp > lastProcessedTimestamp && !renderedMessageIds.has(msg.id)
    );

    // Update last processed timestamp
    if (messages.length > 0) {
        lastProcessedTimestamp = Math.max(...messages.map(m => m.timestamp));
    }

    // If this is the first render or there are many new messages, do full render
    if (renderedMessageIds.size === 0 || newMessages.length > 10) {
        renderFullMessageList(messages, wasAtBottom);
        return;
    }

    // Add new messages incrementally
    const hasNewMessages = newMessages.length > 0;
    
    if (hasNewMessages) {
        newMessages.forEach(msg => {
            const messageElement = createMessageElement(msg);
            container.appendChild(messageElement);
            renderedMessageIds.add(msg.id);
        });
    }

    // Smart scroll: only auto-scroll if user was at bottom or it's their own message
    if (wasAtBottom || (hasNewMessages && newMessages[newMessages.length - 1]?.username === username)) {
        scrollToBottom(container, true);
    } else if (hasNewMessages && !wasAtBottom) {
        showNewMessagesIndicator();
    }

    // Update online count (approximate based on recent messages)
    const recentMessages = messages.filter(m => m.timestamp > Date.now() - 5 * 60 * 1000);
    const uniqueUsers = new Set(recentMessages.map(m => m.username)).size;
    document.getElementById('onlineCount').textContent = `${uniqueUsers} online`;
}

// Full message list render (fallback)
function renderFullMessageList(messages, wasAtBottom) {
    const container = document.getElementById('chatMessages');
    
    container.innerHTML = messages.map(msg => {
        const isOwn = msg.username === username;
        const time = formatMessageTime(msg.timestamp);
        const messageClass = msg.username === username ? 'own' : '';
        
        return createMessageHTML(msg, messageClass, time);
    }).join('');

    // Reset tracking
    renderedMessageIds = new Set(messages.map(m => m.id));
    lastProcessedTimestamp = messages.length > 0 ? Math.max(...messages.map(m => m.timestamp)) : 0;
    lastMessageCount = messages.length;

    // Auto-scroll if user was at bottom
    if (wasAtBottom) {
        scrollToBottom(container, true);
    }
}

// Create individual message element
function createMessageElement(msg) {
    const isOwn = msg.username === username;
    const time = formatMessageTime(msg.timestamp);
    const messageClass = isOwn ? 'own' : '';
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `chat-message ${messageClass}`;
    messageDiv.innerHTML = createMessageHTML(msg, messageClass, time);
    
    return messageDiv;
}

// Create message HTML (reusable)
function createMessageHTML(msg, messageClass, time) {
    return `
        <div class="chat-message ${messageClass}">
            <div class="message-header">
                <span class="message-username">${escapeHtml(msg.username)}</span>
                <span class="message-time">${time}</span>
            </div>
            <div class="message-text">${escapeHtml(msg.text)}</div>
        </div>
    `;
}

// Check if user is near bottom of chat
function isNearBottom(container, threshold = 100) {
    return container.scrollHeight - container.scrollTop - container.clientHeight < threshold;
}

// Scroll to bottom with optional smooth animation
function scrollToBottom(container, smooth = false) {
    if (smooth) {
        container.scrollTo({
            top: container.scrollHeight,
            behavior: 'smooth'
        });
    } else {
        container.scrollTop = container.scrollHeight;
    }
}

// Format message timestamp
function formatMessageTime(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
        // Today - show time
        return date.toLocaleTimeString('it-IT', {
            hour: '2-digit',
            minute: '2-digit'
        });
    } else if (diffDays === 1) {
        return 'Yesterday';
    } else if (diffDays < 7) {
        return date.toLocaleDateString('it-IT', { weekday: 'short' });
    } else {
        return date.toLocaleDateString('it-IT', { month: 'short', day: 'numeric' });
    }
}

// Show new messages indicator
function showNewMessagesIndicator() {
    // Remove existing indicator if any
    const existing = document.querySelector('.new-messages-indicator');
    if (existing) existing.remove();

    const indicator = document.createElement('div');
    indicator.className = 'new-messages-indicator';
    indicator.textContent = '↓ New messages';
    indicator.onclick = () => {
        const container = document.getElementById('chatMessages');
        scrollToBottom(container, true);
        indicator.remove();
    };

    document.querySelector('.chat-section').appendChild(indicator);

    // Auto-remove after 5 seconds
    setTimeout(() => indicator.remove(), 5000);
}

// Refresh messages manually
function refreshMessages() {
    if (!messagesRef) return;

    const btn = document.getElementById('refreshBtn');
    const container = document.getElementById('chatMessages');

    // Visual feedback
    btn.style.transform = 'rotate(360deg)';
    btn.style.transition = 'transform 0.6s';
    btn.disabled = true;

    // Show loading
    const loading = document.createElement('div');
    loading.className = 'chat-loading';
    loading.textContent = 'Refreshing...';
    container.prepend(loading);

    // Reload messages from Firebase
    messagesRef.once('value').then((snapshot) => {
        const messages = [];
        const now = Date.now();

        snapshot.forEach((childSnapshot) => {
            const msg = childSnapshot.val();
            if (msg.expiresAt > now) {
                messages.push({
                    id: childSnapshot.key,
                    ...msg
                });
            }
        });

        messages.sort((a, b) => a.timestamp - b.timestamp);

        // Remove loading
        loading.remove();

        // Render messages
        renderMessages(messages);

        console.log(`✅ Refreshed ${messages.length} messages`);
    }).catch((error) => {
        console.error('Error refreshing messages:', error);
        loading.textContent = 'Failed to refresh';
        setTimeout(() => loading.remove(), 2000);
    }).finally(() => {
        btn.disabled = false;
        setTimeout(() => {
            btn.style.transform = '';
        }, 600);
    });
}

// Track scroll position
function setupScrollTracking() {
    const container = document.getElementById('chatMessages');
    if (!container) return;

    container.addEventListener('scroll', () => {
        isUserAtBottom = isNearBottom(container);

        // Remove new messages indicator if user scrolls to bottom
        if (isUserAtBottom) {
            const indicator = document.querySelector('.new-messages-indicator');
            if (indicator) indicator.remove();
        }
    });
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

// Listen to completed sets (moved to initializeFirebaseListeners)
function listenToCompletedSets() {
    if (!setsRef) return;

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
    if (setsRef) {
        setsRef.off();
        console.log('🧹 Cleaned up sets listener');
    }
    isListenersActive = false;
}

// Pause listeners instead of cleaning up
function pauseFirebaseListeners() {
    if (scoresRef) {
        scoresRef.off();
        console.log('⏸️ Paused scores listener');
    }
    if (messagesRef) {
        messagesRef.off();
        console.log('⏸️ Paused messages listener');
    }
    if (setsRef) {
        setsRef.off();
        console.log('⏸️ Paused sets listener');
    }
    isListenersActive = false;
}

// Resume Firebase listeners
function resumeFirebaseListeners() {
    if (!database || !isListenersActive) {
        // Re-initialize listeners if they were cleaned up
        if (database && !messagesRef && !scoresRef) {
            initializeFirebaseListeners();
            return;
        }
    }
    
    if (!isListenersActive && messagesRef && scoresRef && setsRef) {
        console.log('▶️ Resuming Firebase listeners...');
        
        // Resume messages listener
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
        
        // Resume scores listener
        scoresRef.on('value', (snapshot) => {
            const scores = snapshot.val() || { home: 0, away: 0 };
            document.getElementById('homeScore').textContent = scores.home || 0;
            document.getElementById('awayScore').textContent = scores.away || 0;
        });
        
        // Resume sets listener
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
        
        isListenersActive = true;
        console.log('✅ Firebase listeners resumed');
    }
}

// Initialize all Firebase listeners
function initializeFirebaseListeners() {
    if (!database || !currentMatch) return;
    
    const matchKey = getMatchKey();
    messagesRef = database.ref(`live-matches/${matchKey}/messages`);
    scoresRef = database.ref(`live-matches/${matchKey}/scores`);
    setsRef = database.ref(`live-matches/${matchKey}/sets`);
    
    // Start listening
    listenToMessages();
    listenToScores();
    listenToCompletedSets();
    isListenersActive = true;
}

// Export cleanup function for external use
window.cleanupLiveMatch = cleanupFirebaseListeners;

// Clean up on page unload
window.addEventListener('beforeunload', cleanupFirebaseListeners);

// Setup keyboard detection
function setupKeyboardDetection() {
    const visualViewport = window.visualViewport;
    let initialViewportHeight = window.innerHeight;
    
    if (visualViewport) {
        // Use Visual Viewport API for better keyboard detection
        visualViewport.addEventListener('resize', () => {
            const keyboardVisible = visualViewport.height < window.innerHeight * 0.75;
            
            if (keyboardVisible) {
                document.body.classList.add('keyboard-visible');
                console.log('⌨️ Keyboard detected, adjusting layout');
            } else {
                document.body.classList.remove('keyboard-visible');
                console.log('📱 Keyboard hidden, restoring layout');
            }
            
            // Adjust chat scroll position if needed
            adjustChatScroll();
        });
    } else {
        // Fallback for browsers without Visual Viewport API
        let keyboardCheckInterval;
        
        const startKeyboardDetection = () => {
            keyboardCheckInterval = setInterval(() => {
                const currentHeight = window.innerHeight;
                const keyboardVisible = currentHeight < initialViewportHeight * 0.75;
                
                if (keyboardVisible) {
                    document.body.classList.add('keyboard-visible');
                } else {
                    document.body.classList.remove('keyboard-visible');
                }
                
                adjustChatScroll();
            }, 250);
        };
        
        // Start detection when chat input is focused
        const chatInput = document.getElementById('chatInput');
        if (chatInput) {
            chatInput.addEventListener('focus', startKeyboardDetection);
            chatInput.addEventListener('blur', () => {
                clearInterval(keyboardCheckInterval);
                document.body.classList.remove('keyboard-visible');
            });
        }
    }
}

// Adjust chat scroll when keyboard appears/disappears
function adjustChatScroll() {
    const container = document.getElementById('chatMessages');
    if (container && isUserAtBottom) {
        // Small delay to allow layout adjustment
        setTimeout(() => {
            scrollToBottom(container, false);
        }, 100);
    }
}

// Smart visibility change handling
document.addEventListener('visibilitychange', () => {
    pageVisibilityState = document.hidden ? 'hidden' : 'visible';
    
    if (document.hidden) {
        // Don't cleanup immediately - user might just be switching apps briefly
        // Use a timeout to avoid disconnection for quick screen locks
        reconnectTimeout = setTimeout(() => {
            if (document.hidden) {
                console.log('📱 Screen hidden for >30s, pausing Firebase listeners');
                pauseFirebaseListeners();
            }
        }, 30000); // 30 second delay
    } else {
        // Clear timeout and resume immediately when page becomes visible
        if (reconnectTimeout) {
            clearTimeout(reconnectTimeout);
            reconnectTimeout = null;
        }
        console.log('📱 Screen visible, resuming Firebase listeners');
        resumeFirebaseListeners();
    }
});

// Handle page show/focus events for better reconnection
window.addEventListener('pageshow', () => {
    console.log('📄 Page show event');
    resumeFirebaseListeners();
});

window.addEventListener('focus', () => {
    console.log('🎯 Window focus event');
    resumeFirebaseListeners();
});

// Handle online/offline events
window.addEventListener('online', () => {
    console.log('🌐 Network connection restored');
    resumeFirebaseListeners();
});

window.addEventListener('offline', () => {
    console.log('📵 Network connection lost');
    pauseFirebaseListeners();
});
