import React, { createContext, useState, useEffect, useContext, useCallback, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { ttsService } from '../services/microservices';
import { useAuth } from './AuthContext';

export const TtsHealthContext = createContext();

export const useTtsHealth = () => {
    const context = useContext(TtsHealthContext);
    if (!context) {
        throw new Error('useTtsHealth must be used within a TtsHealthProvider');
    }
    return context;
};

export const TtsHealthProvider = ({ children }) => {
    const { user } = useAuth();
    const location = useLocation();
    const checkInProgressRef = useRef(false);
    const lastCheckTimeRef = useRef(0);
    
    // Проверяем, является ли пользователь гостем
    const isGuest = user?.is_guest || user?.id === -1;
    
    // Всегда начинаем с false, проверяем статус при загрузке
    const [isHealthy, setIsHealthy] = useState(false);
    const [isChecking, setIsChecking] = useState(false);
    const [lastCheck, setLastCheck] = useState(null);

    // Убрали кэширование в localStorage

    const checkHealth = useCallback(async () => {
        // Не проверяем TTS для гостевых пользователей
        if (isGuest) {
            setIsHealthy(false);
            setIsChecking(false);
            return;
        }
        
        // Предотвращаем множественные одновременные запросы
        if (checkInProgressRef.current) {
            return;
        }
        const now = Date.now();
        checkInProgressRef.current = true;
        lastCheckTimeRef.current = now;
        setIsChecking(true);
        
        try {
            const response = await ttsService.get('/health');
            const data = response.data;
            const isOk = response.status === 200 && data.tts_engine_loaded;
            
            setIsHealthy(isOk);
            
            // Сохраняем успешный результат
            const status = {
                isHealthy: isOk,
                lastCheck: new Date()
            };
            setLastCheck(new Date());
            
        } catch (error) {
            console.error('TTS недоступен:', error.message);
            setIsHealthy(false);
            
            // Сохраняем неуспешный результат
            const status = {
                isHealthy: false,
                lastCheck: new Date()
            };
            setLastCheck(new Date());
        } finally {
            setIsChecking(false);
            checkInProgressRef.current = false;
        }
    }, [isGuest]);

    // Проверяем health при загрузке страницы и при смене пути
    useEffect(() => {
        // Проверяем только на дашборде и TTS страницах
        const isDashboardPage = location.pathname.startsWith('/dashboard') || location.pathname === '/';
        const isLoginPage = location.pathname === '/login';
        
        if (!isDashboardPage || isLoginPage) {
            return;
        }
        
        // Всегда проверяем статус заново
        checkHealth();
    }, [location.pathname, checkHealth]);

    // Принудительная проверка при фокусе на окне
    useEffect(() => {
        const handleFocus = () => {
            checkHealth();
        };

        window.addEventListener('focus', handleFocus);
        return () => window.removeEventListener('focus', handleFocus);
    }, [checkHealth]);

    // Принудительная проверка при инициализации контекста
    useEffect(() => {
        checkHealth();
    }, []);

    const value = {
        isHealthy,
        isChecking,
        lastCheck,
        checkTtsHealth: checkHealth,
        refreshHealth: checkHealth
    };


    return (
        <TtsHealthContext.Provider value={value}>
            {children}
        </TtsHealthContext.Provider>
    );
};
