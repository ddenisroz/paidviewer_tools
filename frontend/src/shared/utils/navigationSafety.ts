export const getSafeNavigationUrl = (rawUrl: string): string | null => {
    if (!rawUrl || /[\r\n]/.test(rawUrl)) {
        return null;
    }

    try {
        const url = new URL(rawUrl, window.location.origin);

        if (!['http:', 'https:'].includes(url.protocol)) {
            return null;
        }

        // External redirects must stay on HTTPS.
        if (url.origin !== window.location.origin && url.protocol !== 'https:') {
            return null;
        }

        return url.toString();
    } catch {
        return null;
    }
};

export const getSafeBackendAuthUrl = (apiBaseUrl: string, authPath: string): string | null => {
    if (!apiBaseUrl || !authPath || /[\r\n]/.test(apiBaseUrl) || /[\r\n]/.test(authPath)) {
        return null;
    }

    if (!authPath.startsWith('/auth/')) {
        return null;
    }

    try {
        const base = new URL(apiBaseUrl);
        if (!['http:', 'https:'].includes(base.protocol)) {
            return null;
        }

        const target = new URL(authPath, base);
        if (target.origin !== base.origin) {
            return null;
        }
        if (!target.pathname.startsWith('/auth/')) {
            return null;
        }

        return target.toString();
    } catch {
        return null;
    }
};
