// src/context/TtsCardContext.jsx
import React, { createContext, useState, useEffect, useContext } from 'react';
import { useLocation } from 'react-router-dom';
import { TtsHealthContext } from './TtsHealthContext';

const TtsCardContext = createContext();

export const useTtsCard = () => {
    const context = useContext(TtsCardContext);
    if (!context) {
        throw new Error('useTtsCard must be used within a TtsCardProvider');
    }
    return context;
};

export const TtsCardProvider = ({ children }) => {
    const healthContext = useContext(TtsHealthContext);
    const location = useLocation();
    
    // Проверяем, доступен ли TtsHealthContext
    const hasHealthContext = healthContext !== null && healthContext !== undefined;
    
    // Безопасно получаем данные из TtsHealthContext
    const isHealthy = hasHealthContext ? (healthContext.isHealthy || false) : false;
    const isChecking = hasHealthContext ? (healthContext.isChecking || false) : false;
    const [cachedStatus, setCachedStatus] = useState({
        isHealthy: false,
        isChecking: true,
        lastUpdate: null
    });
    const [isInitialized, setIsInitialized] = useState(false);

    // Функция для проверки health, если TtsHealthContext недоступен
    const checkTtsHealth = async () => {
        if (hasHealthContext) {
            return; // Если контекст доступен, не проверяем самостоятельно
        }

        try {
            const response = await fetch('http://localhost:8001/health');
            const data = await response.json();
            const healthy = response.ok && data.tts_engine_loaded;
            
            setCachedStatus({
                isHealthy: healthy,
                isChecking: false,
                lastUpdate: Date.now()
            });
        } catch (error) {
            setCachedStatus({
                isHealthy: false,
                isChecking: false,
                lastUpdate: Date.now()
            });
        }
    };

    // Обновляем кэш только при реальных изменениях статуса
    useEffect(() => {
        // Обновляем статус только на дашборде и TTS страницах
        const isDashboardPage = location.pathname.startsWith('/dashboard') || location.pathname === '/';
        if (!isDashboardPage) {
            return; // Не логируем, чтобы не засорять консоль
        }
        
        // Если это первая инициализация, сразу устанавливаем статус
        if (!isInitialized) {
            setCachedStatus({
                isHealthy,
                isChecking,
                lastUpdate: Date.now()
            });
            setIsInitialized(true);
            
            // Если TtsHealthContext недоступен, проверяем health самостоятельно
            if (!hasHealthContext) {
                checkTtsHealth();
            }
            return;
        }

        // Проверяем, изменилось ли что-то
        const currentStatus = { isHealthy, isChecking };
        const lastStatus = { isHealthy: cachedStatus.isHealthy, isChecking: cachedStatus.isChecking };
        if (currentStatus.isHealthy === lastStatus.isHealthy && currentStatus.isChecking === lastStatus.isChecking) {
            return;
        }

        // Обновляем кэш если:
        // 1. Статус здоровья изменился (true/false)
        // 2. isChecking изменился (завершилась проверка)
        // 3. Или прошло больше 30 секунд с последнего обновления
        const now = Date.now();
        const shouldUpdate = 
            cachedStatus.isHealthy !== isHealthy || 
            cachedStatus.isChecking !== isChecking ||
            (now - cachedStatus.lastUpdate > 30000); // 30 секунд

        if (shouldUpdate) {
            setCachedStatus({
                isHealthy,
                isChecking,
                lastUpdate: now
            });
        }
    }, [isHealthy, isChecking, location.pathname]);

    // Функция для принудительного обновления (если нужно)
    const refreshStatus = () => {
        setCachedStatus({
            isHealthy,
            isChecking,
            lastUpdate: Date.now()
        });
    };

    const value = {
        ttsCardStatus: cachedStatus,
        refreshStatus
    };

    return (
        <TtsCardContext.Provider value={value}>
            {children}
        </TtsCardContext.Provider>
    );
};
