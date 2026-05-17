// src/utils/urlUtils.ts
/**
 * URL utility functions.
 */

/**
 * Get the API base URL based on environment.
 */
export const getApiUrl = (): string => {
    if (import.meta.env.VITE_API_URL) {
        return import.meta.env.VITE_API_URL;
    }
    return window.location.origin;
};

/**
 * Get the WebSocket base URL based on environment.
 */
export const getWsUrl = (): string => {
    if (import.meta.env.VITE_WS_BASE_URL) {
        return import.meta.env.VITE_WS_BASE_URL;
    }
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${window.location.host}`;
};

/**
 * Build URL with query parameters.
 */
export const buildUrlWithParams = (
    baseUrl: string,
    params: Record<string, string | number | boolean | null | undefined>
): string => {
    const url = new URL(baseUrl, window.location.origin);
    Object.entries(params).forEach(([key, value]) => {
        if (value !== null && value !== undefined) {
            url.searchParams.set(key, String(value));
        }
    });
    return url.toString();
};

/**
 * Extract query parameter from URL.
 */
export const getQueryParam = (name: string, url: string = window.location.href): string | null => {
    const urlObj = new URL(url);
    return urlObj.searchParams.get(name);
};

/**
 * Check if URL is external.
 */
export const isExternalUrl = (url: string): boolean => {
    try {
        const urlObj = new URL(url, window.location.origin);
        return urlObj.origin !== window.location.origin;
    } catch {
        return false;
    }
};

/**
 * Save current URL as return URL.
 */
export const saveReturnUrl = (): void => {
    localStorage.setItem('returnUrl', window.location.pathname + window.location.search);
};

/**
 * Get and clear return URL.
 */
export const getAndClearReturnUrl = (): string | null => {
    const primaryKey = 'returnUrl';
    const legacyKey = 'oauth_return_url';
    const legacyTimestampKey = 'oauth_return_timestamp';

    const rawPrimary = localStorage.getItem(primaryKey);
    const rawLegacy = localStorage.getItem(legacyKey);
    const legacyTimestamp = localStorage.getItem(legacyTimestampKey);

    localStorage.removeItem(primaryKey);
    localStorage.removeItem(legacyKey);
    localStorage.removeItem(legacyTimestampKey);

    const raw = rawPrimary || rawLegacy;
    if (!raw) {
        return null;
    }

    const url = raw.trim();

    // Keep compatibility with older OAuth return URL storage (5 minutes max age).
    if (!rawPrimary && legacyTimestamp) {
        const ageMs = Date.now() - Number.parseInt(legacyTimestamp, 10);
        if (!Number.isFinite(ageMs) || ageMs > 5 * 60 * 1000) {
            return null;
        }
    }

    // Allow only app-internal relative routes.
    if (!url.startsWith('/') || url.startsWith('//') || /[\r\n]/.test(url)) {
        return null;
    }

    // Block common external/protocol-style payloads just in case.
    const lower = url.toLowerCase();
    if (
        lower.startsWith('/http:') ||
        lower.startsWith('/https:') ||
        lower.startsWith('/javascript:') ||
        lower.startsWith('/data:')
    ) {
        return null;
    }

    // Avoid redirect loops/no-op redirects.
    if (url === '/' || url === '/dashboard' || url.startsWith('/dashboard?') || url.startsWith('/login')) {
        return null;
    }

    return url;
};

export default {
    getApiUrl,
    getWsUrl,
    buildUrlWithParams,
    getQueryParam,
    isExternalUrl,
    saveReturnUrl,
    getAndClearReturnUrl,
};
