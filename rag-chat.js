/**
 * RM Volley RAG Chat Interface
 * Handles communication with the RAG backend API
 */

// Configuration
const API_BASE_URL = 'http://localhost:8000';
const API_TIMEOUT = 60000; // 60 seconds

// State
let isProcessing = false;
let conversationHistory = [];

/**
 * Initialize the chat interface
 */
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🏐 RM Volley AI Assistant initialized');

    // Check backend health
    await checkBackendHealth();

    // Auto-resize textarea
    const textarea = document.getElementById('question-input');
    textarea.addEventListener('input', autoResize);

    // Focus on input
    textarea.focus();

    // Load conversation history from localStorage
    loadConversationHistory();
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
            statusText.textContent = `Connesso (${data.database_count} documenti)`;
        } else {
            throw new Error('Backend not healthy');
        }
    } catch (error) {
        console.error('Backend health check failed:', error);
        statusDot.classList.add('disconnected');
        statusText.textContent = 'Server non disponibile';
        addSystemMessage(
            '⚠️ Impossibile connettersi al server RAG. Assicurati che il backend sia avviato con "uvicorn main:app --reload"'
        );
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
 * Send question to backend
 */
async function sendQuestion(question) {
    // Disable input
    isProcessing = true;
    updateSendButton(true);

    // Add user message
    addUserMessage(question);

    // Add loading message
    const loadingId = addLoadingMessage();

    try {
        // Call RAG API
        const response = await fetch(`${API_BASE_URL}/ask`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                question: question,
                n_results: 5,
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
        saveConversationHistory();

    } catch (error) {
        console.error('Error asking question:', error);

        // Remove loading message
        removeMessage(loadingId);

        // Show error
        if (error.name === 'TimeoutError') {
            addErrorMessage('⏱️ Timeout: la richiesta ha impiegato troppo tempo. Riprova.');
        } else if (error.message.includes('Failed to fetch')) {
            addErrorMessage('🔌 Errore di connessione. Verifica che il server RAG sia avviato.');
        } else {
            addErrorMessage(`❌ Errore: ${error.message}`);
        }
    } finally {
        // Re-enable input
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

    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    avatar.textContent = 'U';

    const content = document.createElement('div');
    content.className = 'message-content';
    content.textContent = text;

    messageDiv.appendChild(avatar);
    messageDiv.appendChild(content);
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

    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    avatar.textContent = '🤖';

    const content = document.createElement('div');
    content.className = 'message-content';

    // Format text (preserve line breaks)
    const formattedText = text.replace(/\n/g, '<br>');
    content.innerHTML = formattedText;

    // Add sources if available
    if (sources && sources.length > 0) {
        const sourcesDiv = document.createElement('div');
        sourcesDiv.className = 'sources';

        const sourcesTitle = document.createElement('div');
        sourcesTitle.className = 'sources-title';
        sourcesTitle.textContent = '📚 Fonti:';
        sourcesDiv.appendChild(sourcesTitle);

        // Group sources by type
        const matchSources = sources.filter(s => s.type === 'match');
        const standingSources = sources.filter(s => s.type === 'standing');

        if (matchSources.length > 0) {
            matchSources.slice(0, 3).forEach(source => {
                const sourceItem = document.createElement('div');
                sourceItem.className = 'source-item';
                sourceItem.innerHTML = `
                    <strong>Partita:</strong> ${source.home_team || ''} vs ${source.away_team || ''}<br>
                    <small>${source.date || ''} - ${source.league || ''}</small>
                `;
                sourcesDiv.appendChild(sourceItem);
            });
        }

        if (standingSources.length > 0) {
            standingSources.slice(0, 2).forEach(source => {
                const sourceItem = document.createElement('div');
                sourceItem.className = 'source-item';
                sourceItem.innerHTML = `
                    <strong>Classifica:</strong> ${source.team || ''}<br>
                    <small>${source.league || ''} - Posizione ${source.position || ''}</small>
                `;
                sourcesDiv.appendChild(sourceItem);
            });
        }

        content.appendChild(sourcesDiv);
    }

    messageDiv.appendChild(avatar);
    messageDiv.appendChild(content);
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

    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    avatar.textContent = '🤖';

    const content = document.createElement('div');
    content.className = 'message-content loading';
    content.innerHTML = `
        Sto cercando informazioni
        <span class="loading-dots">
            <span></span>
            <span></span>
            <span></span>
        </span>
    `;

    messageDiv.appendChild(avatar);
    messageDiv.appendChild(content);
    messagesDiv.appendChild(messageDiv);

    scrollToBottom();
    return 'loading-message';
}

/**
 * Add system message
 */
function addSystemMessage(text) {
    const messagesDiv = document.getElementById('chat-messages');

    const messageDiv = document.createElement('div');
    messageDiv.className = 'message system';

    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    avatar.textContent = 'ℹ️';

    const content = document.createElement('div');
    content.className = 'message-content';
    content.innerHTML = text;

    messageDiv.appendChild(avatar);
    messageDiv.appendChild(content);
    messagesDiv.appendChild(messageDiv);

    scrollToBottom();
}

/**
 * Add error message
 */
function addErrorMessage(text) {
    const messagesDiv = document.getElementById('chat-messages');

    const messageDiv = document.createElement('div');
    messageDiv.className = 'message error';

    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    avatar.textContent = '⚠️';

    const content = document.createElement('div');
    content.className = 'message-content';
    content.textContent = text;

    messageDiv.appendChild(avatar);
    messageDiv.appendChild(content);
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
    const messagesDiv = document.getElementById('chat-messages');
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

/**
 * Update send button state
 */
function updateSendButton(disabled) {
    const button = document.getElementById('send-button');
    button.disabled = disabled;
    button.textContent = disabled ? 'Invio...' : 'Invia';
}

/**
 * Auto-resize textarea
 */
function autoResize() {
    const textarea = document.getElementById('question-input');
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
}

/**
 * Handle keyboard shortcuts
 */
function handleKeyDown(event) {
    // Send on Enter (without Shift)
    if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        askQuestion();
    }
}

/**
 * Save conversation history to localStorage
 */
function saveConversationHistory() {
    try {
        localStorage.setItem('rm-volley-chat-history', JSON.stringify(conversationHistory));
    } catch (error) {
        console.error('Failed to save conversation history:', error);
    }
}

/**
 * Load conversation history from localStorage
 */
function loadConversationHistory() {
    try {
        const saved = localStorage.getItem('rm-volley-chat-history');
        if (saved) {
            conversationHistory = JSON.parse(saved);
            console.log(`Loaded ${conversationHistory.length} previous messages`);
        }
    } catch (error) {
        console.error('Failed to load conversation history:', error);
        conversationHistory = [];
    }
}

/**
 * Clear conversation history
 */
function clearHistory() {
    if (confirm('Vuoi cancellare tutta la cronologia della conversazione?')) {
        conversationHistory = [];
        localStorage.removeItem('rm-volley-chat-history');

        // Clear UI (except welcome message)
        const messagesDiv = document.getElementById('chat-messages');
        const messages = messagesDiv.querySelectorAll('.message:not(.system)');
        messages.forEach(msg => msg.remove());

        addSystemMessage('Cronologia cancellata.');
    }
}
