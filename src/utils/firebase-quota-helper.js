/**
 * Firebase Quota Helper - Manages quota exceeded scenarios
 * Provides user-friendly messages and fallback strategies
 */

// Import quota status from firestoredb
import { isQuotaExceeded as firestoreIsQuotaExceeded, setQuotaExceeded as firestoreSetQuotaExceeded } from '../services/firestoredb.js';

let quotaStatus = {
    exceeded: false,
    lastCheck: 0,
    retryAfter: null
};

export function setQuotaStatus(status) {
    quotaStatus = { ...quotaStatus, ...status };
    // Also sync with firestoredb quota status
    if (status.exceeded !== undefined) {
        firestoreSetQuotaExceeded(status.exceeded);
    }
}

export function getQuotaStatus() {
    // Sync with firestoredb quota status
    const firestoreQuotaExceeded = firestoreIsQuotaExceeded();
    if (firestoreQuotaExceeded !== quotaStatus.exceeded) {
        quotaStatus.exceeded = firestoreQuotaExceeded;
    }
    return { ...quotaStatus };
}

export function isQuotaExceeded() {
    // Always check the firestoredb quota status first
    const firestoreQuotaExceeded = firestoreIsQuotaExceeded();
    if (firestoreQuotaExceeded !== quotaStatus.exceeded) {
        quotaStatus.exceeded = firestoreQuotaExceeded;
    }
    return quotaStatus.exceeded;
}

export function getQuotaMessage() {
    if (!isQuotaExceeded()) {
        return null;
    }
    
    if (quotaStatus.retryAfter) {
        const now = new Date();
        const retryTime = new Date(quotaStatus.retryAfter);
        const timeDiff = retryTime - now;
        
        if (timeDiff > 0) {
            const minutes = Math.ceil(timeDiff / (1000 * 60));
            return `Firebase quota exceeded. Please try again in ${minutes} minutes.`;
        }
    }
    
    return 'Firebase quota exceeded. Please try again later.';
}

export function getQuotaActionMessage() {
    if (!isQuotaExceeded()) {
        return null;
    }
    
    return {
        title: 'Quota Exceeded',
        message: 'Your Firebase project has reached its usage limits. Your changes are saved locally and will sync when the quota resets.',
        type: 'warning',
        actions: [
            {
                label: 'Continue Locally',
                action: 'continue'
            },
            {
                label: 'Learn More',
                action: 'help'
            }
        ]
    };
}

export function shouldRetryFirebaseOperation() {
    // Always check the current firestoredb quota status
    const firestoreQuotaExceeded = firestoreIsQuotaExceeded();
    if (firestoreQuotaExceeded !== quotaStatus.exceeded) {
        quotaStatus.exceeded = firestoreQuotaExceeded;
    }
    
    if (!quotaStatus.exceeded) {
        return true;
    }
    
    if (quotaStatus.retryAfter) {
        return new Date() > new Date(quotaStatus.retryAfter);
    }
    
    // Default retry after 1 hour
    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    return quotaStatus.lastCheck < oneHourAgo;
}

export function updateQuotaCheckTime() {
    quotaStatus.lastCheck = Date.now();
}

export function setQuotaRetryTime(retryAfter) {
    quotaStatus.retryAfter = retryAfter;
} 