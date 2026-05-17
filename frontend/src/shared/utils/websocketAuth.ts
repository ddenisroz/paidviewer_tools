import { authService } from '@/services/api/services/authService';

let cachedToken: string | null = null;
let pendingTokenRequest: Promise<string | null> | null = null;

export const clearChatWebSocketTokenCache = (): void => {
    cachedToken = null;
    pendingTokenRequest = null;
};

export const getChatWebSocketToken = async (force = false): Promise<string | null> => {
    if (!force && cachedToken) {
        return cachedToken;
    }

    if (!force && pendingTokenRequest) {
        return pendingTokenRequest;
    }

    pendingTokenRequest = (async () => {
        try {
            const response = await authService.getChatWebSocketToken();
            const payload = response.data;
            const nested =
                payload && typeof payload === 'object' && payload.data && typeof payload.data === 'object'
                    ? payload.data
                    : null;
            const rawToken =
                payload && typeof payload === 'object' && 'token' in payload
                    ? (payload as { token?: unknown }).token
                    : nested && 'token' in nested
                      ? (nested as { token?: unknown }).token
                      : null;
            const token = typeof rawToken === 'string' ? rawToken.trim() : '';
            cachedToken = token || null;
            return cachedToken;
        } catch {
            cachedToken = null;
            return null;
        } finally {
            pendingTokenRequest = null;
        }
    })();

    return pendingTokenRequest;
};
