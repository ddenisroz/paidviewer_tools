export const parseMemeAlertsTokenPayload = (
    raw: string
): { accessToken?: string; refreshToken?: string } => {
    const value = raw.trim();
    if (!value) return {};

    const extractFromParams = (params: URLSearchParams) => {
        const accessToken =
            params.get('access_token') ||
            params.get('accessToken') ||
            params.get('token') ||
            params.get('auth_token') ||
            params.get('jwt') ||
            undefined;
        const refreshToken = params.get('refresh_token') || params.get('refreshToken') || undefined;
        return { accessToken, refreshToken };
    };

    try {
        const url = new URL(value);
        const fromQuery = extractFromParams(url.searchParams);
        if (fromQuery.accessToken) return fromQuery;
        if (url.hash) {
            const fromHash = extractFromParams(new URLSearchParams(url.hash.replace(/^#/, '')));
            if (fromHash.accessToken) return fromHash;
        }
    } catch {
        // continue with fallback parsing
    }

    try {
        const fromText = extractFromParams(new URLSearchParams(value.replace(/^[#?]/, '')));
        if (fromText.accessToken) return fromText;
    } catch {
        // ignore malformed query text
    }

    if (value.split('.').length === 3 || value.length > 30) {
        return { accessToken: value };
    }

    return {};
};
