// src/context/AuthContext.tsx
import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo, ReactNode } from 'react';
import { toast } from 'sonner';
import { logger } from '../utils/prodLogger';
import { useAuthStatus, useLogout } from '../queries/auth/authQueries';
import { authService } from '../services/api/services/authService';
import type { User, GuestData, UserIntegrations } from '../types/user';

// Глобальный флаг для предотвращения множественных проверок аутентификации
let globalAuthCheckInProgress = false;
let globalLastAuthCheckTime = 0;

interface AuthStatusData {
  authenticated: boolean;
  user: User;
  integrations?: UserIntegrations;
}

interface AuthContextValue {
  user: User | null;
  isAuthenticated: boolean | null;
  isGuest: boolean;
  isCheckingAuth: boolean;
  integrations: UserIntegrations;
  loginWithTwitch: () => void;
  loginWithVk: () => void;
  logout: () => Promise<void>;
  setGuestMode: (guestData: GuestData) => Promise<void>;
  integrationsNeedRefresh: boolean;
  markIntegrationsRefreshed: () => void;
  triggerIntegrationsRefresh: () => void;
  refreshAuthStatus: (force?: boolean) => Promise<void>;
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
    const getCachedUser = (): User | null => {
        try {
            const cached = localStorage.getItem('cached_user');
            if (cached) {
                return JSON.parse(cached) as User;
            }
        } catch (e) {
            logger.error('Failed to parse cached user:', e);
        }
        return null;
    };

    const [user, setUser] = useState<User | null>(getCachedUser);
    const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(getCachedUser() ? true : null);
    const [isGuest, setIsGuest] = useState<boolean>(false);
    const [isCheckingAuth, setIsCheckingAuth] = useState<boolean>(true);
    const [integrationsNeedRefresh, setIntegrationsNeedRefresh] = useState<boolean>(false);

    const { data: authStatusData, isLoading: isCheckingAuthStatus, isError, error, refetch: refetchAuthStatus } = useAuthStatus({
        enabled: true,
        refetchOnMount: false,
        refetchOnWindowFocus: false,
    });

    useEffect(() => {
        if (authStatusData) {
            const { authenticated, user: userData, integrations } = authStatusData as unknown as AuthStatusData;
            
            if (authenticated) {
                const newUser: User = { ...userData, integrations };
                setIsAuthenticated(true);
                setIsGuest(userData.is_guest || false);
                setUser(newUser);
                try {
                    localStorage.setItem('cached_user', JSON.stringify(newUser));
                } catch (e) {
                    logger.error('Failed to cache user:', e);
                }
            } else {
                setIsAuthenticated(false);
                setIsGuest(false);
                setUser(null);
                localStorage.removeItem('cached_user');
            }
            
            const currentUrl = new URL(window.location.href);
            const hasAuthParams = currentUrl.searchParams.has('auth') || 
                                  currentUrl.searchParams.has('success') || 
                                  currentUrl.searchParams.has('error') ||
                                  currentUrl.searchParams.has('auth_link');
            
            if (hasAuthParams) {
                const authPlatform = currentUrl.searchParams.get('auth') || currentUrl.searchParams.get('auth_link');
                const authSuccess = currentUrl.searchParams.get('success') === '1';
                
                currentUrl.searchParams.delete('auth');
                currentUrl.searchParams.delete('success');
                currentUrl.searchParams.delete('error');
                currentUrl.searchParams.delete('auth_link');
                
                window.history.replaceState({}, '', currentUrl.pathname + currentUrl.search);
                logger.debug('Auth URL params cleaned');
                
                if (authSuccess || authPlatform) {
                    logger.log(`🔄 [AUTH] OAuth success for ${authPlatform}, triggering integrations refresh`);
                    setTimeout(() => {
                        window.dispatchEvent(new CustomEvent('auth_refresh_required'));
                    }, 200);
                }
            }
        }
    }, [authStatusData]);

    useEffect(() => {
        if (isError && error) {
            logger.error('Authentication check failed:', error);
            const axiosError = error as any;
            if (axiosError.response && (axiosError.response.status === 401 || axiosError.response.status === 403)) {
                setIsAuthenticated(false);
                setIsGuest(false);
                setUser(null);
                localStorage.removeItem('cached_user');
            }
        }
    }, [isError, error]);

    useEffect(() => {
        setIsCheckingAuth(isCheckingAuthStatus);
    }, [isCheckingAuthStatus]);

    const checkAuthStatus = useCallback(async (force: boolean = false): Promise<void> => {
        if (force) {
            await refetchAuthStatus();
        }
    }, [refetchAuthStatus]);

    useEffect(() => {
        const handleAuthRefresh = (): void => {
            logger.info('AuthContext: Received auth_refresh_required event, forcing refresh...');
            checkAuthStatus(true);
        };

        window.addEventListener('auth_refresh_required', handleAuthRefresh);
        
        return () => {
            window.removeEventListener('auth_refresh_required', handleAuthRefresh);
        };
    }, [checkAuthStatus]);

    useEffect(() => {
        let mounted = true;
        
        const clearLegacySessions = async (): Promise<void> => {
            if (isAuthenticated && user?.id && user.id > 0 && mounted) {
                try {
                    const { apiClient } = await import('../services/api/client');
                    await apiClient.post('/api/sessions/clear-legacy');
                    logger.debug('Legacy sessions cleared');
                } catch (error: any) {
                    logger.debug('Legacy sessions cleanup skipped:', error.message);
                }
            }
        };
        
        clearLegacySessions();
        
        return () => {
            mounted = false;
        };
    }, [isAuthenticated, user?.id]);

    const loginWithTwitch = useCallback((): void => {
        authService.loginWithTwitch();
    }, []);

    const loginWithVk = useCallback((): void => {
        try {
            logger.log('🔵 [AUTH CONTEXT] loginWithVk() called');
            authService.loginWithVk();
            logger.log('🔵 [AUTH CONTEXT] loginWithVk() executed');
        } catch (error) {
            logger.error('❌ [AUTH CONTEXT] VK login error:', error);
            toast.error('Ошибка при входе через VK Live.');
        }
    }, []);

    const logoutMutation = useLogout({
        onSuccess: async (): Promise<void> => {
            const userId = user?.id;
            setIsAuthenticated(false);
            setUser(null);
            
            if (userId) {
                const cacheManager = await import('../utils/cacheManager');
                cacheManager.default.invalidateUser(userId);
                logger.info('[AUTH] User cache cleared on logout');
                
                const { clearAllQueryCache } = await import('../utils/queryPersist');
                clearAllQueryCache();
                logger.info('[AUTH] Query cache cleared on logout');
            }
            
            try {
                const { getSharedWebSocket } = await import('../utils/sharedWebSocket');
                const wsManager = getSharedWebSocket(userId);
                if (wsManager) {
                    wsManager.cleanup();
                    logger.info('[AUTH] WebSocket cleaned up on logout');
                }
            } catch (error) {
                logger.error('[AUTH] Failed to cleanup WebSocket:', error);
            }
        },
    });

    const logout = useCallback(async (): Promise<void> => {
        logoutMutation.mutate();
    }, [logoutMutation]);

    const markIntegrationsRefreshed = useCallback((): void => {
        setIntegrationsNeedRefresh(false);
    }, []);
    
    const triggerIntegrationsRefresh = useCallback((): void => {
        setIntegrationsNeedRefresh(true);
    }, []);

    const setGuestMode = useCallback(async (guestData: GuestData): Promise<void> => {
        try {
            setIsAuthenticated(true);
            setIsGuest(true);
            setUser({
                id: -1,
                username: guestData.username,
                is_admin: false,
                is_guest: true,
                platform: guestData.platform,
                integrations: {}
            });
        } catch (error) {
            logger.error('Failed to set guest mode:', error);
            throw error;
        }
    }, []);

    const value = useMemo<AuthContextValue>(() => ({
        user,
        isAuthenticated,
        isGuest,
        isCheckingAuth,
        integrations: user?.integrations || {},
        loginWithTwitch,
        loginWithVk,
        logout,
        setGuestMode,
        integrationsNeedRefresh,
        markIntegrationsRefreshed,
        triggerIntegrationsRefresh,
        refreshAuthStatus: checkAuthStatus
    }), [user, isAuthenticated, isGuest, isCheckingAuth, integrationsNeedRefresh, loginWithTwitch, loginWithVk, logout, setGuestMode, markIntegrationsRefreshed, triggerIntegrationsRefresh, checkAuthStatus]);

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};

