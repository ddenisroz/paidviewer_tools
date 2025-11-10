// src/context/AuthContext.jsx
import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { toast } from 'sonner';
import { logger } from '../utils/prodLogger';
import { API_BASE_URL } from '../constants';
import { useAuthStatus, useLogout } from '../queries/auth/authQueries';
import { authService } from '../services/api/services/authService';

// Глобальный флаг для предотвращения множественных проверок аутентификации
let globalAuthCheckInProgress = false;
let globalLastAuthCheckTime = 0;

export const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
    // 🚀 ANTI-FLASH: Инициализируем user из localStorage чтобы избежать мерцания
    const getCachedUser = () => {
        try {
            const cached = localStorage.getItem('cached_user');
            if (cached) {
                return JSON.parse(cached);
            }
        } catch (e) {
            logger.error('Failed to parse cached user:', e);
        }
        return null;
    };

    const [user, setUser] = useState(getCachedUser);
    const [isAuthenticated, setIsAuthenticated] = useState(getCachedUser() ? true : null); // null = проверяем, true/false = результат
    const [isGuest, setIsGuest] = useState(false); // Состояние гостя
    const [isCheckingAuth, setIsCheckingAuth] = useState(true); // Состояние проверки аутентификации
    const [integrationsNeedRefresh, setIntegrationsNeedRefresh] = useState(false);

    // React Query hook для проверки статуса аутентификации
    const { data: authStatusData, isLoading: isCheckingAuthStatus, refetch: refetchAuthStatus } = useAuthStatus({
        enabled: true,
        refetchOnMount: false,
        refetchOnWindowFocus: false,
        onSuccess: (data) => {
            const { authenticated, user: userData, integrations } = data;
            
            if (authenticated) {
                const newUser = { ...userData, integrations };
                setIsAuthenticated(true);
                setIsGuest(userData.is_guest || false);
                setUser(newUser);
                // 🚀 ANTI-FLASH: Кэшируем user в localStorage
                try {
                    localStorage.setItem('cached_user', JSON.stringify(newUser));
                } catch (e) {
                    logger.error('Failed to cache user:', e);
                }
            } else {
                setIsAuthenticated(false);
                setIsGuest(false);
                setUser(null);
                // 🚀 ANTI-FLASH: Очищаем кэш при logout
                localStorage.removeItem('cached_user');
            }
            
            // 🧹 Очищаем URL параметры после успешной проверки авторизации
            const currentUrl = new URL(window.location.href);
            const hasAuthParams = currentUrl.searchParams.has('auth') || 
                                  currentUrl.searchParams.has('success') || 
                                  currentUrl.searchParams.has('error') ||
                                  currentUrl.searchParams.has('auth_link');
            
            if (hasAuthParams) {
                const authPlatform = currentUrl.searchParams.get('auth') || currentUrl.searchParams.get('auth_link');
                const authSuccess = currentUrl.searchParams.get('success') === '1';
                
                // Удаляем параметры авторизации
                currentUrl.searchParams.delete('auth');
                currentUrl.searchParams.delete('success');
                currentUrl.searchParams.delete('error');
                currentUrl.searchParams.delete('auth_link');
                
                // Обновляем URL без перезагрузки страницы
                window.history.replaceState({}, '', currentUrl.pathname + currentUrl.search);
                logger.debug('Auth URL params cleaned');
                
                // 🔄 Отправляем событие для обновления интеграций если OAuth успешен
                if (authSuccess || authPlatform) {
                    logger.log(`🔄 [AUTH] OAuth success for ${authPlatform}, triggering integrations refresh`);
                    setTimeout(() => {
                        window.dispatchEvent(new CustomEvent('auth_refresh_required'));
                    }, 200);
                }
            }
        },
        onError: (error) => {
            logger.error('Authentication check failed:', error);
            // Только при HTTP 401/403 считаем, что пользователь не аутентифицирован
            if (error.response && (error.response.status === 401 || error.response.status === 403)) {
                setIsAuthenticated(false);
                setIsGuest(false);
                setUser(null);
                localStorage.removeItem('cached_user');
            }
        },
    });

    // Обновляем isCheckingAuth из React Query
    useEffect(() => {
        setIsCheckingAuth(isCheckingAuthStatus);
    }, [isCheckingAuthStatus]);

    // Обертка для совместимости
    const checkAuthStatus = useCallback(async (force = false) => {
        if (force) {
            await refetchAuthStatus();
        }
    }, [refetchAuthStatus]);

    // Слушаем события принудительного обновления
    useEffect(() => {
        const handleAuthRefresh = () => {
            logger.info('AuthContext: Received auth_refresh_required event, forcing refresh...');
            checkAuthStatus(true);
        };

        window.addEventListener('auth_refresh_required', handleAuthRefresh);
        
        return () => {
            window.removeEventListener('auth_refresh_required', handleAuthRefresh);
        };
    }, [checkAuthStatus]);

    // Очистка legacy сессий при аутентификации
    useEffect(() => {
        // Используем отдельную переменную для отслеживания монтирования
        let mounted = true;
        
        const clearLegacySessions = async () => {
            if (isAuthenticated && user?.id && user?.id > 0 && mounted) {
                try {
                    // Используем apiClient напрямую для этого специфичного запроса
                    const { apiClient } = await import('../services/api/client');
                    await apiClient.post('/api/sessions/clear-legacy');
                    logger.debug('Legacy sessions cleared');
                } catch (error) {
                    logger.debug('Legacy sessions cleanup skipped:', error.message);
                }
            }
        };
        
        clearLegacySessions();
        
        return () => {
            mounted = false;
        };
    }, [isAuthenticated, user?.id]); // Зависимости корректны - только меняющиеся значения

    const loginWithTwitch = useCallback(() => {
        // Используем authService для входа через Twitch
        authService.loginWithTwitch();
    }, []);

    const loginWithVk = useCallback(() => {
        try {
            logger.log('🔵 [AUTH CONTEXT] loginWithVk() called');
            authService.loginWithVk();
            logger.log('🔵 [AUTH CONTEXT] loginWithVk() executed');
        } catch (error) {
            logger.error('❌ [AUTH CONTEXT] VK login error:', error);
            toast.error('Ошибка при входе через VK Live.');
        }
    }, []);

    // React Query mutation для выхода
    const logoutMutation = useLogout({
        onSuccess: async () => {
            const userId = user?.id;
            setIsAuthenticated(false);
            setUser(null);
            
            // Очищаем кэш пользователя
            if (userId) {
                const cacheManager = await import('../utils/cacheManager');
                cacheManager.default.invalidateUser(userId);
                logger.info('[AUTH] User cache cleared on logout');
                
                // 🚀 ANTI-FLASH: Очищаем React Query persist кэш
                const { clearAllQueryCache } = await import('../utils/queryPersist');
                clearAllQueryCache();
                logger.info('[AUTH] Query cache cleared on logout');
            }
            
            // 🔌 Очищаем SharedWebSocket (глобальный cleanup)
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

    // Обертка для совместимости
    const logout = useCallback(async () => {
        logoutMutation.mutate();
    }, [logoutMutation]);

    const markIntegrationsRefreshed = useCallback(() => {
        setIntegrationsNeedRefresh(false);
    }, []);
    
    // Функция для вызова обновления интеграций
    const triggerIntegrationsRefresh = useCallback(() => {
        setIntegrationsNeedRefresh(true);
    }, []);

    const setGuestMode = useCallback(async (guestData) => {
        try {
            // Устанавливаем гостевой режим
            setIsAuthenticated(true);
            setIsGuest(true);
            setUser({
                id: -1, // Специальный ID для гостевого пользователя
                username: guestData.username,
                is_admin: false,
                is_guest: true,
                platform: guestData.platform,
                integrations: {}
            });
            
            // Можно добавить дополнительную логику для гостевого режима
        } catch (error) {
            logger.error('Failed to set guest mode:', error);
            throw error;
        }
    }, []);

    const value = useMemo(() => ({
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
        refreshAuthStatus: checkAuthStatus // Экспортируем функцию для обновления
    }), [user, isAuthenticated, isGuest, isCheckingAuth, integrationsNeedRefresh, loginWithTwitch, loginWithVk, logout, setGuestMode, markIntegrationsRefreshed, triggerIntegrationsRefresh, checkAuthStatus]);

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};
