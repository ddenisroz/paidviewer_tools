import React, { createContext, useState, useEffect, useContext } from 'react';

const TtsHealthContext = createContext();

export const useTtsHealth = () => {
    const context = useContext(TtsHealthContext);
    if (!context) {
        throw new Error('useTtsHealth must be used within a TtsHealthProvider');
    }
    return context;
};

export const TtsHealthProvider = ({ children }) => {
    const [isHealthy, setIsHealthy] = useState(false);
    const [isChecking, setIsChecking] = useState(false);
    const [lastCheck, setLastCheck] = useState(null);

    const checkTtsHealth = async () => {
        // Проверяем, что мы не на странице логина
        const currentPath = window.location.pathname;
        
        if (currentPath === '/login') {
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
            
            return healthy;
        } catch (error) {
            // Тихо обрабатываем ошибку без спама в консоль
            setIsHealthy(false);
            setLastCheck(new Date());
            
            return false;
        } finally {
            setIsChecking(false);
        }
    };

    // loadActiveChannels больше не нужен - это теперь в ActiveChannelsContext

    useEffect(() => {
        // Проверяем только при загрузке страницы
        checkTtsHealth();
    }, []);

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
