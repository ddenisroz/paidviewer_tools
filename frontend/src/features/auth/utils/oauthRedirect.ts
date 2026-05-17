import { logger } from '@/shared/utils/prodLogger';

const RETURN_URL_KEY = 'oauth_return_url';
const RETURN_URL_TIMESTAMP = 'oauth_return_timestamp';
const MAX_AGE_MS = 5 * 60 * 1000;

export function saveReturnUrl(): void {
    try {
        const currentPath = window.location.pathname + window.location.search;
        if (
            currentPath === '/dashboard' ||
            currentPath === '/login' ||
            currentPath === '/' ||
            currentPath.startsWith('/dashboard?')
        ) {
            logger.log('[REFRESH] [OAuth] Skipping save - already on main page or has query params');
            return;
        }
        localStorage.setItem(RETURN_URL_KEY, currentPath);
        localStorage.setItem(RETURN_URL_TIMESTAMP, Date.now().toString());
        logger.log('[DB] [OAuth] Saved return URL:', currentPath);
    } catch (error) {
        logger.error('[ERROR] [OAuth] Failed to save return URL:', error);
    }
}

export function getAndClearReturnUrl(): string | null {
    try {
        const returnUrl = localStorage.getItem(RETURN_URL_KEY);
        const timestamp = localStorage.getItem(RETURN_URL_TIMESTAMP);
        localStorage.removeItem(RETURN_URL_KEY);
        localStorage.removeItem(RETURN_URL_TIMESTAMP);

        if (!returnUrl) {
            logger.log('[INFO] [OAuth] No saved return URL');
            return null;
        }

        if (timestamp) {
            const age = Date.now() - parseInt(timestamp, 10);
            if (age > MAX_AGE_MS) {
                logger.log('[TIMEOUT] [OAuth] Return URL expired, ignoring');
                return null;
            }
        }

        if (
            returnUrl === '/dashboard' ||
            returnUrl === '/' ||
            returnUrl.startsWith('/dashboard?') ||
            returnUrl.startsWith('/login')
        ) {
            logger.log('[REFRESH] [OAuth] Return URL is main page or login, ignoring');
            return null;
        }

        logger.log('[OK] [OAuth] Retrieved return URL:', returnUrl);
        return returnUrl;
    } catch (error) {
        logger.error('[ERROR] [OAuth] Failed to get return URL:', error);
        return null;
    }
}

export function clearReturnUrl(): void {
    try {
        localStorage.removeItem(RETURN_URL_KEY);
        localStorage.removeItem(RETURN_URL_TIMESTAMP);
        logger.log('[DELETE] [OAuth] Cleared return URL');
    } catch (error) {
        logger.error('[ERROR] [OAuth] Failed to clear return URL:', error);
    }
}
