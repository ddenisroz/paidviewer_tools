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
    
    // Начинаем с проверки для не-гостевых пользователей
    const [isHealthy, setIsHealthy] = useState(false);
    const [isChecking, setIsChecking] = useState(!isGuest); // Начинаем с проверки если не гость
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
        const minCheckInterval = parseInt(import.meta.env.VITE_TTS_MIN_CHECK_INTERVAL || '2000', 10);
        if (now - globalLastCheckTime < minCheckInterval) { // Минимум 2 секунды между проверками
            console.log('TtsHealthContext: Health check too frequent, skipping...');
            return;
        }
        
        globalHealthCheckInProgress = true;
        globalLastCheckTime = now;
        checkInProgressRef.current = true;
        lastCheckTimeRef.current = now;
        setIsChecking(true);
        
        console.log('TtsHealthContext: Starting health check...');
        
        // Дополнительная защита - принудительно завершаем проверку через 6 секунд (на случай если что-то пойдёт не так)
        const forceCompleteTimeout = setTimeout(() => {
            if (checkInProgressRef.current && mountedRef.current) {
                console.warn('TtsHealthContext: Force completing health check due to timeout (6s)');
                setIsChecking(false);
                setIsHealthy(false);
                setLastCheck(new Date());
                checkInProgressRef.current = false;
                globalHealthCheckInProgress = false;
            }
        }, 6000);
        
        try {
            // Добавляем таймаут для проверки TTS сервера - 5 секунд максимум
            const healthCheckTimeout = 5000;
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('TTS health check timeout')), healthCheckTimeout)
            );
            
            const response = await Promise.race([
                ttsService.get('/health', { timeout: healthCheckTimeout }),
                timeoutPromise
            ]);
            
            const data = response.data;
            const isOk = response.status === 200 && data.tts_engine_loaded;
            
            console.log('TtsHealthContext: TTS server response:', { status: response.status, data, isOk });
            
            if (!mountedRef.current) {
                console.log('TtsHealthContext: Component unmounted during health check, aborting');
                return;
            }
            
            setIsHealthy(isOk);
            setLastCheck(new Date());
            
        } catch (error) {
            console.log('TtsHealthContext: TTS server check failed:', error.message || error.code);
            
            if (!mountedRef.current) {
                console.log('TtsHealthContext: Component unmounted during error handling, aborting');
                return;
            }
            
            setIsHealthy(false);
            setLastCheck(new Date());
        } finally {
            if (mountedRef.current) {
                console.log('TtsHealthContext: Health check completed, setting isChecking to false');
                clearTimeout(forceCompleteTimeout);
                setIsChecking(false);
            }
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
            console.log('TtsHealthContext: Guest user, skipping health check');
            return;
        }
        
        // Проверяем только один раз при монтировании компонента
        // Дополнительная защита от двойных вызовов в React Strict Mode
        if (!hasCheckedRef.current && !checkInProgressRef.current) {
            console.log('TtsHealthContext: Starting health check on mount');
            hasCheckedRef.current = true;
            // Добавляем небольшую задержку для предотвращения двойных вызовов
            const initialDelay = parseInt(import.meta.env.VITE_TTS_INITIAL_CHECK_DELAY || '100', 10);
            const timeoutId = setTimeout(() => {
                if (mountedRef.current && !checkInProgressRef.current) {
                    checkHealth();
                }
            }, initialDelay);
            
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
