const normalizeStreamerId = (value: string | null): string | undefined => {
    const text = (value || '').trim();
    if (!text) return undefined;
    if (/^[a-f0-9]{24}$/i.test(text)) return text;
    if (/^\d{1,32}$/.test(text)) return text;
    return undefined;
};

export const parseMemeAlertsTokenPayload = (raw: string): {
    accessToken?: string;
    refreshToken?: string;
    streamerId?: string;
} => {
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
        const streamerId =
            normalizeStreamerId(params.get('streamer_id')) ||
            normalizeStreamerId(params.get('streamerId')) ||
            normalizeStreamerId(params.get('tid')) ||
            normalizeStreamerId(params.get('user_id')) ||
            normalizeStreamerId(params.get('userId')) ||
            normalizeStreamerId(params.get('channel_id')) ||
            normalizeStreamerId(params.get('channelId'));
        return { accessToken, refreshToken, streamerId };
    };

    try {
        const urlValue =
            value.startsWith('memealerts.com/') || value.startsWith('www.memealerts.com/') ? `https://${value}` : value;
        const url = new URL(urlValue);
        const fromQuery = extractFromParams(url.searchParams);
        if (fromQuery.accessToken) return fromQuery;
        if (url.hash) {
            const normalizedHash = url.hash.replace(/^#/, '');
            const fromHash = extractFromParams(new URLSearchParams(normalizedHash));
            if (fromHash.accessToken) return fromHash;
            const hashQueryIndex = normalizedHash.indexOf('?');
            if (hashQueryIndex >= 0) {
                const fromHashQuery = extractFromParams(new URLSearchParams(normalizedHash.slice(hashQueryIndex + 1)));
                if (fromHashQuery.accessToken) return fromHashQuery;
            }
        }
    } catch {
        // continue with fallback parsing
    }

    try {
        const fromText = extractFromParams(new URLSearchParams(value.replace(/^[#?]/, '')));
        if (fromText.accessToken) return fromText;
        const normalizedText = value.replace(/^#/, '');
        const hashQueryIndex = normalizedText.indexOf('?');
        if (hashQueryIndex >= 0) {
            const fromTextHashQuery = extractFromParams(new URLSearchParams(normalizedText.slice(hashQueryIndex + 1)));
            if (fromTextHashQuery.accessToken) return fromTextHashQuery;
        }
    } catch {
        // ignore malformed query text
    }

    try {
        const parsed = JSON.parse(value) as {
            access_token?: string;
            accessToken?: string;
            token?: string;
            jwt?: string;
            refresh_token?: string;
            refreshToken?: string;
            streamer_id?: string;
            streamerId?: string;
            tid?: string;
            user_id?: string;
            userId?: string;
        };
        const accessToken = parsed.access_token || parsed.accessToken || parsed.token || parsed.jwt;
        if (accessToken) {
            return {
                accessToken,
                refreshToken: parsed.refresh_token || parsed.refreshToken,
                streamerId:
                    normalizeStreamerId(parsed.streamer_id || null) ||
                    normalizeStreamerId(parsed.streamerId || null) ||
                    normalizeStreamerId(parsed.tid || null) ||
                    normalizeStreamerId(parsed.user_id || null) ||
                    normalizeStreamerId(parsed.userId || null),
            };
        }
    } catch {
        // ignore malformed JSON
    }

    if (value.split('.').length === 3 || value.length > 30) {
        return { accessToken: value };
    }

    return {};
};
