import React, { createContext, useState, useEffect, useContext, useCallback } from 'react';
import { useLocation } from 'react-router-dom';

export const TtsHealthContext = createContext();

export const useTtsHealth = () => {
    const context = useContext(TtsHealthContext);
    if (!context) {
        throw new Error('useTtsHealth must be used within a TtsHealthProvider');
    }
    return context;
};

export const TtsHealthProvider = ({ children }) => {
    // Загружаем сохраненный статус из localStorage при инициализации
    const [isHealthy, setIsHealthy] = useState(() => {
        const saved = localStorage.getItem('tts_health_status');
        return saved ? JSON.parse(saved).isHealthy : false;
    });
    const [isChecking, setIsChecking] = useState(false);
    const [lastCheck, setLastCheck] = useState(() => {
        const saved = localStorage.getItem('tts_health_status');
        if (saved) {
            const data = JSON.parse(saved);
            return data.lastCheck ? new Date(data.lastCheck) : null;
        }
        return null;
    });
    const location = useLocation();
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

    const checkTtsHealth = useCallback(async () => {
        // Проверяем health только на дашборде и TTS страницах
        const currentPath = window.location.pathname;
        const isDashboardPage = currentPath.startsWith('/dashboard') || currentPath === '/';
        const isLoginPage = currentPath === '/login';
        
        if (!isDashboardPage || isLoginPage) {
            return false;
        }

        // Предотвращаем множественные проверки
        if (isChecking) {
            return false;
        }
        
        setIsChecking(true);
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 секунд таймаут
            
            const response = await fetch('http://localhost:8001/health', {
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            const data = await response.json();
            
            const healthy = response.ok && data.tts_engine_loaded;
            setIsHealthy(healthy);
            setLastCheck(new Date());
            
            // Сохраняем в кэш
            const newCachedData = {
                isHealthy: healthy,
                timestamp: Date.now(),
                data: data
            };
            setCachedData(newCachedData);
            
            // Сохраняем в localStorage
            saveHealthStatus({
                isHealthy: healthy,
                lastCheck: new Date(),
                isInitialized: true,
                cachedData: newCachedData
            });
            
            return healthy;
        } catch (error) {
            // Тихо обрабатываем ошибку без спама в консоль
            setIsHealthy(false);
            setLastCheck(new Date());
            
            // Сохраняем ошибку в кэш
            const errorCachedData = {
                isHealthy: false,
                timestamp: Date.now(),
                data: null
            };
            setCachedData(errorCachedData);
            
            // Сохраняем в localStorage
            saveHealthStatus({
                isHealthy: false,
                lastCheck: new Date(),
                isInitialized: true,
                cachedData: errorCachedData
            });
            
            return false;
        } finally {
            setIsChecking(false);
        }
    }, []);

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
            checkTtsHealth();
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
    }, [location.pathname, isInitialized, checkTtsHealth]);

    const value = {
        isHealthy,
        isChecking,
        lastCheck,
        checkTtsHealth,
        refreshHealth: checkTtsHealth // Алиас для ручного обновления
    };

    return (
        <TtsHealthContext.Provider value={value}>
            {children}
        </TtsHealthContext.Provider>
    );
};
