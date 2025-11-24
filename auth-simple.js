// ====================================
// Simple Client-Side Authentication
// No backend/Firebase required
// ====================================

let config = null;
let currentSession = null;

/**
 * Initialize and load config
 */
export async function initAuth() {
    try {
        const response = await fetch('config.json');
        config = await response.json();

        // Check for existing session
        const session = localStorage.getItem('scout_session');
        if (session) {
            const sessionData = JSON.parse(session);

            // Check if session is still valid
            if (sessionData.expiry > Date.now()) {
                currentSession = sessionData;
                console.log('✅ Session restored:', sessionData.email);
                return sessionData;
            } else {
                // Session expired, clear it
                localStorage.removeItem('scout_session');
                console.log('⏰ Session expired');
            }
        }

        return null;
    } catch (error) {
        console.error('Error loading config:', error);
        throw error;
    }
}

/**
 * Hash password using SHA-256
 */
async function hashPassword(password) {
    const msgUint8 = new TextEncoder().encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex;
}

/**
 * Sign in with email and password
 */
export async function signIn(email, password) {
    try {
        if (!config) {
            await initAuth();
        }

        // Hash the password
        const passwordHash = await hashPassword(password);

        // Find matching admin
        const admin = config.admins.find(a =>
            a.email.toLowerCase() === email.toLowerCase() &&
            a.passwordHash === passwordHash
        );

        if (!admin) {
            return {
                success: false,
                error: 'Email o password non corretti'
            };
        }

        // Create session
        const sessionTimeout = config.sessionTimeout || 28800000; // 8 hours default
        const session = {
            email: admin.email,
            name: admin.name || admin.email,
            loginTime: Date.now(),
            expiry: Date.now() + sessionTimeout
        };

        // Save session
        localStorage.setItem('scout_session', JSON.stringify(session));
        currentSession = session;

        console.log('✅ Login successful:', admin.email);
        return { success: true, user: session };

    } catch (error) {
        console.error('Login error:', error);
        return {
            success: false,
            error: 'Errore durante il login'
        };
    }
}

/**
 * Sign out
 */
export function signOut() {
    localStorage.removeItem('scout_session');
    currentSession = null;
    console.log('✅ Logged out');
    return { success: true };
}

/**
 * Check if user is authenticated
 */
export function isAuthenticated() {
    if (!currentSession) {
        // Try to restore session
        const session = localStorage.getItem('scout_session');
        if (session) {
            const sessionData = JSON.parse(session);
            if (sessionData.expiry > Date.now()) {
                currentSession = sessionData;
                return true;
            } else {
                // Expired
                localStorage.removeItem('scout_session');
                return false;
            }
        }
        return false;
    }

    // Check if current session is still valid
    if (currentSession.expiry < Date.now()) {
        signOut();
        return false;
    }

    return true;
}

/**
 * Get current user
 */
export function getCurrentUser() {
    if (isAuthenticated()) {
        return currentSession;
    }
    return null;
}

/**
 * Extend session (reset expiry)
 */
export function extendSession() {
    if (currentSession && config) {
        const sessionTimeout = config.sessionTimeout || 28800000;
        currentSession.expiry = Date.now() + sessionTimeout;
        localStorage.setItem('scout_session', JSON.stringify(currentSession));
    }
}

/**
 * Wait for auth initialization
 */
export async function waitForAuth() {
    if (config) {
        return getCurrentUser();
    }
    await initAuth();
    return getCurrentUser();
}

// Auto-extend session on activity
let activityTimer = null;
function resetActivityTimer() {
    if (activityTimer) {
        clearTimeout(activityTimer);
    }

    extendSession();

    // Set timer for inactivity check (every 5 minutes)
    activityTimer = setTimeout(() => {
        if (isAuthenticated()) {
            console.log('Session still active');
        }
    }, 300000);
}

// Listen for user activity to extend session
if (typeof window !== 'undefined') {
    ['click', 'keypress', 'scroll', 'touchstart'].forEach(event => {
        window.addEventListener(event, resetActivityTimer, { passive: true });
    });
}
