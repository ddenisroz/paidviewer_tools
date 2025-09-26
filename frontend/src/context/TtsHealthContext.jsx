import React, { createContext, useState, useEffect, useContext, useCallback } from 'react';
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
    
    // Загружаем сохраненный статус из localStorage при инициализации
    const [isHealthy, setIsHealthy] = useState(() => {
        const saved = localStorage.getItem('tts_health_status');
        return saved ? JSON.parse(saved).isHealthy : false;
    });
    const [isChecking, setIsChecking] = useState(true);
    const [lastChecked, setLastChecked] = useState(null);
    const [lastCheck, setLastCheck] = useState(() => {
        const saved = localStorage.getItem('tts_health_status');
        if (saved) {
            const data = JSON.parse(saved);
            return data.lastCheck ? new Date(data.lastCheck) : null;
        }
        return null;
    });
    const location = useLocation();
    
    // Проверяем, является ли пользователь гостем
    const isGuest = user?.is_guest || user?.id === -1;
    const [isInitialized, setIsInitialized] = useState(() => {
        const saved = localStorage.getItem('tts_health_status');
        return saved ? JSON.parse(saved).isInitialized : false;
    });
    const [cachedData, setCachedData] = useState(() => {
        const saved = localStorage.getItem('tts_health_status');
        return saved ? JSON.parse(saved).cachedData : null;
    });

    // Функция для сохранения статуса в localStorage
    const saveHealthStatus = (status) => {
        const dataToSave = {
            isHealthy: status.isHealthy,
            lastCheck: status.lastCheck,
            isInitialized: status.isInitialized,
            cachedData: status.cachedData,
            timestamp: Date.now()
        };
        localStorage.setItem('tts_health_status', JSON.stringify(dataToSave));
    };

    const checkHealth = useCallback(async () => {
        // Не проверяем TTS для гостевых пользователей
        if (isGuest) {
            setIsHealthy(false);
            setIsChecking(false);
            setLastChecked(Date.now());
            return;
        }
        
        setIsChecking(true);
        try {
            const response = await ttsService.get('/health');
            const data = response.data;
            const isOk = response.status === 200 && data.tts_engine_loaded;
            setIsHealthy(isOk);
        } catch (error) {
            console.error('TTS Health Check Failed:', error);
            setIsHealthy(false);
        } finally {
            setIsChecking(false);
            setLastChecked(Date.now());
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
        
        // Проверяем актуальность сохраненных данных
        const now = Date.now();
        const dataAge = cachedData ? (now - cachedData.timestamp) : Infinity;
        const maxAge = 5 * 60 * 1000; // 5 минут
        
        if (!isInitialized || dataAge > maxAge) {
            checkHealth();
            setIsInitialized(true);
        } else {
            // Обновляем состояние из кэша только если значения изменились
            if (isHealthy !== cachedData.isHealthy) {
                setIsHealthy(cachedData.isHealthy);
            }
            const newLastCheck = new Date(cachedData.timestamp);
            if (!lastCheck || !(lastCheck instanceof Date) || lastCheck.getTime() !== newLastCheck.getTime()) {
                setLastCheck(newLastCheck);
            }
        }
    }, [location.pathname, isInitialized, checkHealth]);

    const value = {
        isHealthy,
        isChecking,
        lastCheck,
        checkTtsHealth: checkHealth, // Алиас для ручного обновления
        refreshHealth: checkHealth // Алиас для ручного обновления
    };

    return (
        <TtsHealthContext.Provider value={value}>
            {children}
        </TtsHealthContext.Provider>
    );
};
