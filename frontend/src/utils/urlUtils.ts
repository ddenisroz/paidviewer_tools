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
    if (import.meta.env.DEV) {
        return 'http://localhost:8000';
    }
    return window.location.origin;
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
    const url = localStorage.getItem('returnUrl');
    if (url) {
        localStorage.removeItem('returnUrl');
    }
    return url;
};

export default {
    getApiUrl,
    buildUrlWithParams,
    getQueryParam,
    isExternalUrl,
    saveReturnUrl,
    getAndClearReturnUrl,
};
