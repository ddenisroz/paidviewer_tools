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
    const [isChecking, setIsChecking] = useState(false); // Начинаем с false
    const [lastChecked, setLastChecked] = useState(null);
    const [lastCheck, setLastCheck] = useState(() => {
        const saved = localStorage.getItem('tts_health_status');
        if (saved) {
            const data = JSON.parse(saved);
            return data.lastCheck ? new Date(data.lastCheck) : null;
        }
        return null;
    });
    const [checkInProgress, setCheckInProgress] = useState(false); // Предотвращаем множественные запросы
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
        
        // Предотвращаем множественные одновременные запросы
        if (checkInProgress) {
            return;
        }
        
        setCheckInProgress(true);
        setIsChecking(true);
        
        try {
            const response = await ttsService.get('/health');
            const data = response.data;
            const isOk = response.status === 200 && data.tts_engine_loaded;
            setIsHealthy(isOk);
            
            // Сохраняем успешный результат
            const status = {
                isHealthy: isOk,
                lastCheck: new Date(),
                isInitialized: true,
                cachedData: { isHealthy: isOk, timestamp: Date.now() }
            };
            saveHealthStatus(status);
            
        } catch (error) {
            // Не логируем ошибки в консоль для ERR_CONNECTION_REFUSED
            if (!error.message?.includes('ERR_CONNECTION_REFUSED') && error.code !== 'ERR_NETWORK') {
                console.error('TTS Health Check Failed:', error);
            }
            setIsHealthy(false);
            
            // Сохраняем неуспешный результат
            const status = {
                isHealthy: false,
                lastCheck: new Date(),
                isInitialized: true,
                cachedData: { isHealthy: false, timestamp: Date.now() }
            };
            saveHealthStatus(status);
        } finally {
            setIsChecking(false);
            setCheckInProgress(false);
            setLastChecked(Date.now());
        }
    }, [isGuest, saveHealthStatus, checkInProgress]);

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
        const maxAge = 10 * 60 * 1000; // 10 минут (увеличили интервал)
        
        if (!isInitialized || dataAge > maxAge) {
            if (!checkInProgress) {
                checkHealth();
            }
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
    }, [location.pathname, isInitialized, cachedData, isHealthy, lastCheck, checkInProgress]);

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
