/**
 * RM Volley RAG Chat Interface
 * Modern chat interface for volleyball statistics
 */

// Configuration
const API_BASE_URL = 'http://localhost:8000';
const API_TIMEOUT = 60000;

// State
let isProcessing = false;
let conversationHistory = [];
let hasMessages = false;

/**
 * Initialize the chat interface
 */
document.addEventListener('DOMContentLoaded', async () => {
    console.log('RM Volley AI Assistant initialized');

    // Check backend health
    await checkBackendHealth();

    // Auto-resize textarea
    const textarea = document.getElementById('question-input');
    textarea.addEventListener('input', autoResize);

    // Focus on input
    textarea.focus();
});

/**
 * Check if backend is available
 */
async function checkBackendHealth() {
    const statusDot = document.getElementById('status-dot');
    const statusText = document.getElementById('status-text');

    try {
        const response = await fetch(`${API_BASE_URL}/health`, {
            signal: AbortSignal.timeout(5000)
        });

        if (response.ok) {
            const data = await response.json();
            statusDot.classList.remove('disconnected');
            statusText.textContent = `Online (${data.database_count} doc)`;
        } else {
            throw new Error('Backend not healthy');
        }
    } catch (error) {
        console.error('Backend health check failed:', error);
        statusDot.classList.add('disconnected');
        statusText.textContent = 'Offline';
    }
}

/**
 * Ask a question to the RAG system
 */
async function askQuestion() {
    const input = document.getElementById('question-input');
    const question = input.value.trim();

    if (!question || isProcessing) return;

    // Clear input
    input.value = '';
    autoResize();

    // Hide welcome screen on first message
    hideWelcomeScreen();

    // Send question
    await sendQuestion(question);
}

/**
 * Ask a pre-defined quick question
 */
function askQuickQuestion(question) {
    const input = document.getElementById('question-input');
    input.value = question;
    askQuestion();
}

/**
 * Hide welcome screen
 */
function hideWelcomeScreen() {
    const welcomeScreen = document.getElementById('welcome-screen');
    if (welcomeScreen) {
        welcomeScreen.style.display = 'none';
    }
    hasMessages = true;
}

/**
 * Send question to backend
 */
async function sendQuestion(question) {
    isProcessing = true;
    updateSendButton(true);

    // Add user message
    addUserMessage(question);

    // Add loading message
    const loadingId = addLoadingMessage();

    try {
        const response = await fetch(`${API_BASE_URL}/ask`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                question: question,
                n_results: 10,
                temperature: 0.5
            }),
            signal: AbortSignal.timeout(API_TIMEOUT)
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || 'API request failed');
        }

        const data = await response.json();

        // Remove loading message
        removeMessage(loadingId);

        // Add assistant response
        addAssistantMessage(data.answer, data.sources);

        // Save to history
        conversationHistory.push({
            question: question,
            answer: data.answer,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Error asking question:', error);
        removeMessage(loadingId);

        if (error.name === 'TimeoutError') {
            addErrorMessage('La richiesta ha impiegato troppo tempo. Riprova.');
        } else if (error.message.includes('Failed to fetch')) {
            addErrorMessage('Impossibile connettersi al server. Verifica che sia avviato.');
        } else {
            addErrorMessage(`Errore: ${error.message}`);
        }
    } finally {
        isProcessing = false;
        updateSendButton(false);
        document.getElementById('question-input').focus();
    }
}

/**
 * Add user message to chat
 */
function addUserMessage(text) {
    const messagesDiv = document.getElementById('chat-messages');

    const messageDiv = document.createElement('div');
    messageDiv.className = 'message user';
    messageDiv.innerHTML = `
        <div class="message-avatar">👤</div>
        <div class="message-body">
            <div class="message-role">Tu</div>
            <div class="message-content">${escapeHtml(text)}</div>
        </div>
    `;

    messagesDiv.appendChild(messageDiv);
    scrollToBottom();
}

/**
 * Add assistant message to chat
 */
function addAssistantMessage(text, sources = []) {
    const messagesDiv = document.getElementById('chat-messages');

    const messageDiv = document.createElement('div');
    messageDiv.className = 'message assistant';

    // Format text with line breaks
    const formattedText = formatMessage(text);

    let sourcesHtml = '';
    if (sources && sources.length > 0) {
        const matchSources = sources.filter(s => s.type === 'match').slice(0, 3);
        const standingSources = sources.filter(s => s.type === 'standing').slice(0, 2);

        let sourceItems = '';

        matchSources.forEach(source => {
            sourceItems += `
                <div class="source-item">
                    <div class="source-icon">⚽</div>
                    <div class="source-info">
                        <div class="source-title">${source.home_team || ''} vs ${source.away_team || ''}</div>
                        <div class="source-meta">${source.date || ''} • ${source.league || ''}</div>
                    </div>
                </div>
            `;
        });

        standingSources.forEach(source => {
            sourceItems += `
                <div class="source-item">
                    <div class="source-icon">🏆</div>
                    <div class="source-info">
                        <div class="source-title">${source.league || 'Classifica'}</div>
                        <div class="source-meta">${source.num_teams || ''} squadre</div>
                    </div>
                </div>
            `;
        });

        if (sourceItems) {
            sourcesHtml = `
                <div class="sources-card">
                    <div class="sources-header">
                        <span>📚</span>
                        <span>Fonti utilizzate</span>
                    </div>
                    <div class="sources-list">
                        ${sourceItems}
                    </div>
                </div>
            `;
        }
    }

    messageDiv.innerHTML = `
        <div class="message-avatar">🏐</div>
        <div class="message-body">
            <div class="message-role">Assistente</div>
            <div class="message-content">${formattedText}</div>
            ${sourcesHtml}
        </div>
    `;

    messagesDiv.appendChild(messageDiv);
    scrollToBottom();
}

/**
 * Add loading message
 */
function addLoadingMessage() {
    const messagesDiv = document.getElementById('chat-messages');

    const messageDiv = document.createElement('div');
    messageDiv.className = 'message assistant';
    messageDiv.id = 'loading-message';
    messageDiv.innerHTML = `
        <div class="message-avatar">🏐</div>
        <div class="message-body">
            <div class="message-role">Assistente</div>
            <div class="typing-indicator">
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
            </div>
        </div>
    `;

    messagesDiv.appendChild(messageDiv);
    scrollToBottom();
    return 'loading-message';
}

/**
 * Add error message
 */
function addErrorMessage(text) {
    const messagesDiv = document.getElementById('chat-messages');

    const messageDiv = document.createElement('div');
    messageDiv.className = 'message assistant';
    messageDiv.innerHTML = `
        <div class="message-avatar" style="background: linear-gradient(135deg, #ef4444, #f97316);">⚠️</div>
        <div class="message-body">
            <div class="message-role">Sistema</div>
            <div class="message-content" style="color: #fca5a5;">${escapeHtml(text)}</div>
        </div>
    `;

    messagesDiv.appendChild(messageDiv);
    scrollToBottom();
}

/**
 * Remove a message by ID
 */
function removeMessage(id) {
    const message = document.getElementById(id);
    if (message) {
        message.remove();
    }
}

/**
 * Scroll to bottom of chat
 */
function scrollToBottom() {
    const container = document.getElementById('messages-container');
    container.scrollTop = container.scrollHeight;
}

/**
 * Update send button state
 */
function updateSendButton(disabled) {
    const button = document.getElementById('send-button');
    button.disabled = disabled;
}

/**
 * Auto-resize textarea
 */
function autoResize() {
    const textarea = document.getElementById('question-input');
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 200) + 'px';
}

/**
 * Handle keyboard shortcuts
 */
function handleKeyDown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        askQuestion();
    }
}

/**
 * Format message text
 */
function formatMessage(text) {
    // Escape HTML first
    let formatted = escapeHtml(text);

    // Convert line breaks to <br>
    formatted = formatted.replace(/\n/g, '<br>');

    // Convert numbered lists
    formatted = formatted.replace(/^(\d+)\.\s/gm, '<strong>$1.</strong> ');

    return formatted;
}

/**
 * Escape HTML entities
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Clear conversation history
 */
function clearHistory() {
    conversationHistory = [];
    hasMessages = false;

    // Clear UI
    const messagesDiv = document.getElementById('chat-messages');
    messagesDiv.innerHTML = `
        <div class="welcome-screen" id="welcome-screen">
            <div class="welcome-icon">🏐</div>
            <h2 class="welcome-title">Ciao! Sono l'assistente RM Volley</h2>
            <p class="welcome-subtitle">
                Posso aiutarti con risultati, classifiche, calendario e statistiche delle squadre RM Volley.
            </p>
            <div class="suggestion-grid">
                <div class="suggestion-card" onclick="askQuickQuestion('Qual è la classifica della Serie D Femminile?')">
                    <div class="suggestion-icon">🏆</div>
                    <div class="suggestion-text">Mostrami la classifica della Serie D Femminile</div>
                </div>
                <div class="suggestion-card" onclick="askQuickQuestion('Prossima partita RM VOLLEY PIACENZA')">
                    <div class="suggestion-icon">📅</div>
                    <div class="suggestion-text">Quando gioca RM Volley Piacenza?</div>
                </div>
                <div class="suggestion-card" onclick="askQuickQuestion('Com\\'è andata l\\'ultima partita di RM VOLLEY PIACENZA?')">
                    <div class="suggestion-icon">⚡</div>
                    <div class="suggestion-text">Risultato ultima partita Serie D</div>
                </div>
                <div class="suggestion-card" onclick="askQuickQuestion('Risultati recenti RM VOLLEY #18')">
                    <div class="suggestion-icon">📊</div>
                    <div class="suggestion-text">Come sta andando l'Under 18?</div>
                </div>
            </div>
        </div>
    `;

    document.getElementById('question-input').focus();
}
