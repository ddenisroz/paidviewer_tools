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

// Глобальный флаг для предотвращения множественных проверок
let globalHealthCheckInProgress = false;
let globalLastCheckTime = 0;

export const TtsHealthProvider = ({ children }) => {
    const { user } = useAuth();
    const location = useLocation();
    const checkInProgressRef = useRef(false);
    const lastCheckTimeRef = useRef(0);
    const hasCheckedRef = useRef(false);
    const mountedRef = useRef(false);
    
    // Проверяем, является ли пользователь гостем
    const isGuest = user?.is_guest || user?.id === -1;
    
    // Всегда начинаем с false, проверяем статус при загрузке
    const [isHealthy, setIsHealthy] = useState(false);
    const [isChecking, setIsChecking] = useState(false);
    const [lastCheck, setLastCheck] = useState(null);

    // Убрали кэширование в localStorage

    const checkHealthRef = useRef();
    
    checkHealthRef.current = async () => {
        // Не проверяем TTS для гостевых пользователей
        if (isGuest) {
            setIsHealthy(false);
            setIsChecking(false);
            return;
        }
        
        // Проверяем что компонент всё ещё смонтирован
        if (!mountedRef.current) {
            return;
        }
        
        // Глобальная проверка - предотвращаем множественные одновременные запросы
        if (globalHealthCheckInProgress) {
            console.log('TtsHealthContext: Global health check already in progress, skipping...');
            return;
        }
        
        // Дополнительная проверка времени - не проверяем слишком часто
        const now = Date.now();
        if (now - globalLastCheckTime < 2000) { // Минимум 2 секунды между проверками
            console.log('TtsHealthContext: Health check too frequent, skipping...');
            return;
        }
        
        globalHealthCheckInProgress = true;
        globalLastCheckTime = now;
        checkInProgressRef.current = true;
        lastCheckTimeRef.current = now;
        setIsChecking(true);
        
        try {
            const response = await ttsService.get('/health');
            const data = response.data;
            const isOk = response.status === 200 && data.tts_engine_loaded;
            
            setIsHealthy(isOk);
            setLastCheck(new Date());
            
        } catch (error) {
            console.error('TTS недоступен:', error.message);
            setIsHealthy(false);
            setLastCheck(new Date());
        } finally {
            setIsChecking(false);
            checkInProgressRef.current = false;
            globalHealthCheckInProgress = false;
        }
    };
    
    const checkHealth = useCallback(() => {
        return checkHealthRef.current();
    }, []);

    // Проверяем health ТОЛЬКО при первой загрузке/обновлении страницы
    useEffect(() => {
        // Отмечаем что компонент смонтирован
        mountedRef.current = true;
        
        // Не проверяем для гостей
        if (isGuest) {
            return;
        }
        
        // Проверяем только один раз при монтировании компонента
        // Дополнительная защита от двойных вызовов в React Strict Mode
        if (!hasCheckedRef.current && !checkInProgressRef.current) {
            hasCheckedRef.current = true;
            // Добавляем небольшую задержку для предотвращения двойных вызовов
            const timeoutId = setTimeout(() => {
                if (mountedRef.current && !checkInProgressRef.current) {
                    checkHealth();
                }
            }, 100);
            
            return () => {
                clearTimeout(timeoutId);
                mountedRef.current = false;
            };
        }
        
        // Cleanup при размонтировании
        return () => {
            mountedRef.current = false;
        };
    }, []); // Убираем все зависимости!

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
