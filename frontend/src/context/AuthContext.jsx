// src/context/AuthContext.jsx
import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { botService, loginVk } from '../services/microservices';
import { toast } from 'sonner';
import { authLogger as logger } from '../utils/logger';
import { API_BASE_URL } from '../constants';

// Глобальный флаг для предотвращения множественных проверок аутентификации
let globalAuthCheckInProgress = false;
let globalLastAuthCheckTime = 0;

export const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [isAuthenticated, setIsAuthenticated] = useState(null); // null = проверяем, true/false = результат
    const [isGuest, setIsGuest] = useState(false); // Состояние гостя
    const [isCheckingAuth, setIsCheckingAuth] = useState(true); // Состояние проверки аутентификации
    const [integrationsNeedRefresh, setIntegrationsNeedRefresh] = useState(false);

    const checkAuthStatus = useCallback(async (force = false) => {
        // Глобальная проверка - предотвращаем множественные одновременные запросы
        if (globalAuthCheckInProgress && !force) {
            logger.debug('AuthContext: Global auth check already in progress, skipping...');
            return;
        }
        
        // Дополнительная проверка времени - не проверяем слишком часто (кроме принудительного обновления)
        const now = Date.now();
        if (!force && now - globalLastAuthCheckTime < 1000) { // Уменьшено до 1 секунды для лучшей синхронизации
            logger.debug('AuthContext: Auth check too frequent, skipping...');
            return;
        }
        
        globalAuthCheckInProgress = true;
        globalLastAuthCheckTime = now;
        setIsCheckingAuth(true);
        
        try {
            // Проверяем статус аутентификации (токен автоматически отправляется в cookies)
            const response = await botService.get('/api/auth/status');
            const { authenticated, user: userData, integrations } = response.data;

            if (authenticated) {
                setIsAuthenticated(true);
                setIsGuest(userData.is_guest || false);
                setUser({ ...userData, integrations });
            } else {
                setIsAuthenticated(false);
                setIsGuest(false);
                setUser(null);
            }
        } catch (error) {
            logger.error('Authentication check failed:', error);
            // Только при HTTP 401/403 считаем, что пользователь не аутентифицирован
            if (error.response && (error.response.status === 401 || error.response.status === 403)) {
                setIsAuthenticated(false);
                setIsGuest(false);
                setUser(null);
            }
            // При других ошибках (сеть, 500, etc) не меняем состояние аутентификации
        } finally {
            setIsCheckingAuth(false);
            globalAuthCheckInProgress = false;
        }
    }, []);

    useEffect(() => {
        // Проверяем статус только при монтировании компонента
        let mounted = true;
        
        const initAuth = async () => {
            if (mounted) {
                await checkAuthStatus();
            }
        };
        
        initAuth();
        
        // Cleanup function для предотвращения обновления unmounted компонента
        return () => {
            mounted = false;
        };
    }, []); // Убираем все зависимости, проверяем только при монтировании

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
                    await botService.post('/api/sessions/clear-legacy');
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

    const loginWithTwitch = () => {
        // Прямой редирект на OAuth endpoint (бэкенд сделает 302 редирект на Twitch)
        window.location.href = `${API_BASE_URL}/auth/twitch/login`;
    };

    const loginWithVk = () => {
        try {
            console.log('🔵 [AUTH CONTEXT] loginWithVk() called');
            loginVk();
            console.log('🔵 [AUTH CONTEXT] loginVk() from microservices executed');
        } catch (error) {
            console.error('❌ [AUTH CONTEXT] VK login error:', error);
            logger.error("VK login error:", error);
            toast.error('Ошибка при входе через VK Live.');
        }
    };

    const logout = async () => {
        try {
            const userId = user?.id;
            
            await botService.post('/api/auth/logout');
            setIsAuthenticated(false);
            setUser(null);
            
            // Очищаем кэш пользователя
            if (userId) {
                const cacheManager = await import('../utils/cacheManager');
                cacheManager.default.invalidateUser(userId);
                logger.info('[AUTH] User cache cleared on logout');
            }
            
            toast.success('Вы успешно вышли из системы.');
        } catch (error) {
            logger.error('Logout failed:', error);
            toast.error('Ошибка при выходе из системы.');
        }
    };

    const markIntegrationsRefreshed = () => {
        setIntegrationsNeedRefresh(false);
    };
    
    // Функция для вызова обновления интеграций
    const triggerIntegrationsRefresh = () => {
        setIntegrationsNeedRefresh(true);
    };

    const setGuestMode = async (guestData) => {
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
    };

    const value = {
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
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};
