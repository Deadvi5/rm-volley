// ====================================
// Utility Functions
// Performance optimization helpers
// ====================================

/**
 * Debounce function - delays execution until after wait time has elapsed
 * since the last time it was invoked
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @returns {Function} Debounced function
 */
export function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Throttle function - ensures function is called at most once per interval
 * @param {Function} func - Function to throttle
 * @param {number} limit - Minimum time between calls in milliseconds
 * @returns {Function} Throttled function
 */
export function throttle(func, limit) {
    let inThrottle;
    return function (...args) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

/**
 * Throttle using requestAnimationFrame for scroll/resize events
 * @param {Function} func - Function to throttle
 * @returns {Function} Throttled function
 */
export function throttleRAF(func) {
    let ticking = false;
    return function (...args) {
        if (!ticking) {
            window.requestAnimationFrame(() => {
                func.apply(this, args);
                ticking = false;
            });
            ticking = true;
        }
    };
}

/**
 * Split array into chunks of specified size
 * @param {Array} array - Array to chunk
 * @param {number} size - Chunk size
 * @returns {Array} Array of chunks
 */
export function chunkArray(array, size) {
    const chunks = [];
    for (let i = 0; i < array.length; i += size) {
        chunks.push(array.slice(i, i + size));
    }
    return chunks;
}

/**
 * Process array in chunks asynchronously to prevent UI blocking
 * @param {Array} array - Array to process
 * @param {Function} processor - Function to process each chunk
 * @param {number} chunkSize - Size of each chunk (default: 50)
 * @returns {Promise} Promise that resolves when all chunks are processed
 */
export async function processInChunks(array, processor, chunkSize = 50) {
    const chunks = chunkArray(array, chunkSize);

    for (const chunk of chunks) {
        await new Promise(resolve => {
            setTimeout(() => {
                processor(chunk);
                resolve();
            }, 0);
        });
    }
}

/**
 * Simple memoization function for caching results
 * @param {Function} func - Function to memoize
 * @returns {Function} Memoized function
 */
export function memoize(func) {
    const cache = new Map();
    return function (...args) {
        const key = JSON.stringify(args);
        if (cache.has(key)) {
            return cache.get(key);
        }
        const result = func.apply(this, args);
        cache.set(key, result);
        return result;
    };
}

/**
 * Check if two objects are deeply equal (for simple comparison)
 * @param {*} obj1 - First object
 * @param {*} obj2 - Second object
 * @returns {boolean} True if equal
 */
export function deepEqual(obj1, obj2) {
    return JSON.stringify(obj1) === JSON.stringify(obj2);
}
