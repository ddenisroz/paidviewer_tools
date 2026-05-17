import { AxiosError } from 'axios';
import { toast } from 'sonner';
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

import { authService } from '@/services/api/services/authService';
import { clearChatWebSocketTokenCache } from '@/shared/utils/websocketAuth';
import { clearAllQueryCache } from '@/shared/utils/queryPersist';

import { logger } from '../shared/utils/prodLogger';

import type { User } from '@/types/user';

// 🚀 ANTI-FLASH: Global flags to prevent multiple auth checks
let globalAuthCheckInProgress = false;
let globalLastAuthCheckTime = 0;

// 🚀 ANTI-FLASH: Get cached user from localStorage
const getCachedUser = (): User | null => {
    try {
        const cached = localStorage.getItem('cached_user');
        if (cached) {
            return JSON.parse(cached);
        }
    } catch (e) {
        logger.error('[AuthStore] Failed to parse cached user:', e);
    }
    return null;
};

interface AuthState {
    user: User | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    isCheckingAuth: boolean;
    error: string | null;
    integrationsNeedRefresh: boolean;

    // Actions
    checkAuth: (force?: boolean) => Promise<void>;
    logout: () => Promise<void>;
    loginWithTwitch: () => void;
    loginWithVk: () => void;
    setUser: (user: User | null) => void;
    setError: (error: string | null) => void;
    refreshAuthStatus: (force?: boolean) => Promise<void>;
    markIntegrationsRefreshed: () => void;
    triggerIntegrationsRefresh: () => void;
}

interface AuthStatusPayload {
    authenticated?: boolean;
    user?: User;
    integrations?: User['integrations'];
}

type AuthStateSetter = (partial: Partial<AuthState>) => void;

const getAuthErrorStatus = (error: unknown): number | undefined =>
    error instanceof AxiosError ? error.response?.status : undefined;

const isAuthRejectionStatus = (status: number | undefined): boolean => status === 401 || status === 403;

const applyAuthCheckFailure = (error: unknown, setAuthState: AuthStateSetter): void => {
    if (isAuthRejectionStatus(getAuthErrorStatus(error))) {
        setAuthState({ user: null, isAuthenticated: false, isLoading: false, isCheckingAuth: false });
        localStorage.removeItem('cached_user');
        clearChatWebSocketTokenCache();
        return;
    }

    setAuthState({ isLoading: false, isCheckingAuth: false });
};

const maybeToastAuthCheckFailure = (error: unknown): void => {
    const status = getAuthErrorStatus(error);

    if (error instanceof AxiosError && !isAuthRejectionStatus(status) && status !== 429) {
        toast.error(`Auth Check Failed: ${error.message || 'Unknown error'}`);
    }
};

export const useAuthStore = create<AuthState>()(
    devtools(
        (set, get) => ({
            // 🚀 ANTI-FLASH: Initialize from localStorage
            user: getCachedUser(),
            isAuthenticated: getCachedUser() !== null,
            isLoading: false,
            isCheckingAuth: true,
            error: null,
            integrationsNeedRefresh: false,

            setUser: (user) => {
                set({ user, isAuthenticated: !!user });
                // 🚀 ANTI-FLASH: Cache user
                if (user) {
                    try {
                        localStorage.setItem('cached_user', JSON.stringify(user));
                    } catch (e) {
                        logger.error('[AuthStore] Failed to cache user:', e);
                    }
                } else {
                    localStorage.removeItem('cached_user');
                    clearChatWebSocketTokenCache();
                }
            },
            setError: (error) => set({ error }),
            markIntegrationsRefreshed: () => set({ integrationsNeedRefresh: false }),
            triggerIntegrationsRefresh: () => set({ integrationsNeedRefresh: true }),

            checkAuth: async (force = false) => {
                // 🚀 Global check - prevent duplicate requests
                if (globalAuthCheckInProgress && !force) {
                    logger.debug('[AuthStore] Global auth check already in progress, skipping...');
                    return;
                }

                // Rate limiting check
                const now = Date.now();
                if (!force && now - globalLastAuthCheckTime < 1000) {
                    logger.debug('[AuthStore] Auth check too frequent, skipping...');
                    return;
                }

                globalAuthCheckInProgress = true;
                globalLastAuthCheckTime = now;
                set({ isLoading: true, isCheckingAuth: true, error: null });

                try {
                    const response = await authService.getAuthStatus();
                    const authData = response.data as AuthStatusPayload;

                    if (authData?.authenticated && authData.user) {
                        const userData = authData.user;
                        const userWithIntegrations = {
                            ...userData,
                            integrations: authData.integrations || userData.integrations,
                        };

                        set({
                            user: userWithIntegrations,
                            isAuthenticated: true,
                            isLoading: false,
                            isCheckingAuth: false,
                        });

                        // 🚀 ANTI-FLASH: Cache user
                        try {
                            localStorage.setItem('cached_user', JSON.stringify(userWithIntegrations));
                        } catch (e) {
                            logger.error('[AuthStore] Failed to cache user:', e);
                        }

                        logger.log('[AuthStore] Auth success');
                    } else {
                        set({
                            user: null,
                            isAuthenticated: false,
                            isLoading: false,
                            isCheckingAuth: false,
                            error: null,
                        });
                        // 🚀 ANTI-FLASH: Clear cache
                        localStorage.removeItem('cached_user');
                    }

                    // 🧹 Clean URL params after auth check
                    const currentUrl = new URL(window.location.href);
                    const hasAuthParams =
                        currentUrl.searchParams.has('auth') ||
                        currentUrl.searchParams.has('success') ||
                        currentUrl.searchParams.has('error') ||
                        currentUrl.searchParams.has('auth_link');

                    if (hasAuthParams) {
                        const authPlatform =
                            currentUrl.searchParams.get('auth') || currentUrl.searchParams.get('auth_link');
                        const authSuccess = currentUrl.searchParams.get('success') === '1';

                        currentUrl.searchParams.delete('auth');
                        currentUrl.searchParams.delete('success');
                        currentUrl.searchParams.delete('error');
                        currentUrl.searchParams.delete('auth_link');

                        window.history.replaceState({}, '', currentUrl.pathname + currentUrl.search);
                        logger.debug('[AuthStore] Auth URL params cleaned');

                        // Trigger integrations refresh if OAuth success
                        if (authSuccess || authPlatform) {
                            logger.log(`[AuthStore] OAuth success for ${authPlatform}, triggering refresh`);
                            setTimeout(() => {
                                window.dispatchEvent(new CustomEvent('auth_refresh_required'));
                            }, 200);
                        }
                    }
                } catch (error) {
                    applyAuthCheckFailure(error, set);
                    logger.error('[AuthStore] Check auth failed:', error);
                    maybeToastAuthCheckFailure(error);
                } finally {
                    globalAuthCheckInProgress = false;
                }
            },

            refreshAuthStatus: async (force = false) => {
                await get().checkAuth(force);
            },

            logout: async () => {
                const userId = get().user?.id;
                set({ isLoading: true });

                try {
                    await authService.logout();
                } catch (error) {
                    logger.error('[AuthStore] Logout failed (API step):', error);
                } finally {
                    // SOFT LOGOUT: Clear state without page reload
                    set({
                        user: null,
                        isAuthenticated: false,
                        isLoading: false,
                        isCheckingAuth: false,
                    });

                    // 🚀 ANTI-FLASH: Clear all caches
                    localStorage.removeItem('cached_user');
                    localStorage.removeItem('tts_enabled');
                    localStorage.removeItem('tts_has_local_setup');
                    clearChatWebSocketTokenCache();

                    if (userId) {
                        // Clear query cache
                        clearAllQueryCache();
                        logger.info('[AuthStore] Query cache cleared on logout');
                    }

                    // Note: We don't need window.location.reload() or explicit navigate here
                    // because AuthGuard will automatically redirect to /login when isAuthenticated becomes false.
                }
            },

            loginWithTwitch: () => {
                authService.loginWithTwitch();
            },

            loginWithVk: () => {
                authService.loginWithVk();
            },
        }),
        { name: 'AuthStore' }
    )
);
