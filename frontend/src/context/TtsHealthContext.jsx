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

    // Функция для сохранения статуса в localStorage
    const saveHealthStatus = useCallback((status) => {
        const dataToSave = {
            isHealthy: status.isHealthy,
            lastCheck: status.lastCheck,
            timestamp: Date.now()
        };
        localStorage.setItem('tts_health_status', JSON.stringify(dataToSave));
    }, []);

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
        
        // Проверяем, не слишком ли часто мы проверяем (минимум 30 секунд между проверками)
        const now = Date.now();
        if (now - lastCheckTimeRef.current < 30000) {
            return;
        }
        
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
            saveHealthStatus(status);
            setLastCheck(new Date());
            
        } catch (error) {
            // Не логируем ошибки в консоль для ERR_CONNECTION_REFUSED
            if (!error.message?.includes('ERR_CONNECTION_REFUSED') && error.code !== 'ERR_NETWORK') {
                console.error('TTS Health Check Failed:', error);
            }
            setIsHealthy(false);
            
            // Сохраняем неуспешный результат
            const status = {
                isHealthy: false,
                lastCheck: new Date()
            };
            saveHealthStatus(status);
            setLastCheck(new Date());
        } finally {
            setIsChecking(false);
            checkInProgressRef.current = false;
        }
    }, [isGuest, saveHealthStatus]);

    // Проверяем health при загрузке страницы и при смене пути
    useEffect(() => {
        // Проверяем только на дашборде и TTS страницах
        const isDashboardPage = location.pathname.startsWith('/dashboard') || location.pathname === '/';
        const isLoginPage = location.pathname === '/login';
        
        if (!isDashboardPage || isLoginPage) {
            return;
        }
        
        // Проверяем актуальность сохраненных данных
        const saved = localStorage.getItem('tts_health_status');
        if (saved) {
            const data = JSON.parse(saved);
            const now = Date.now();
            const dataAge = now - data.timestamp;
            const maxAge = 10 * 60 * 1000; // 10 минут
            
            if (dataAge > maxAge) {
                // Данные устарели, проверяем заново
                checkHealth();
            } else {
                // Используем кэшированные данные
                setIsHealthy(data.isHealthy);
                setLastCheck(new Date(data.lastCheck));
            }
        } else {
            // Нет сохраненных данных, проверяем
            checkHealth();
        }
    }, [location.pathname, checkHealth]);

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
