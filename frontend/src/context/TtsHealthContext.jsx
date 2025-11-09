import React, { createContext, useState, useEffect, useContext, useCallback, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { ttsService } from '../services/microservices';
import { useAuth } from './AuthContext';
import { logger } from '../utils/prodLogger';

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
    const [isChecking, setIsChecking] = useState(false); // НЕ начинаем с проверки, чтобы избежать мерцания
    const [lastCheck, setLastCheck] = useState(null);

    // Убрали кэширование в localStorage

    const checkHealthRef = useRef();
    // ✅ ИСПРАВЛЕНИЕ: Ref для хранения всех таймаутов для правильной очистки
    const timeoutsRef = useRef([]);
    
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
            logger.log('TtsHealthContext: Global health check already in progress, skipping...');
            return;
        }
        
        // Дополнительная проверка времени - не проверяем слишком часто
        const now = Date.now();
        const minCheckInterval = parseInt(import.meta.env.VITE_TTS_MIN_CHECK_INTERVAL || '2000', 10);
        if (now - globalLastCheckTime < minCheckInterval) { // Минимум 2 секунды между проверками
            logger.log('TtsHealthContext: Health check too frequent, skipping...');
            return;
        }
        
        globalHealthCheckInProgress = true;
        globalLastCheckTime = now;
        checkInProgressRef.current = true;
        lastCheckTimeRef.current = now;
        setIsChecking(true);
        
        logger.log('TtsHealthContext: Starting health check...');
        
        // ✅ ИСПРАВЛЕНИЕ: Очищаем предыдущие таймауты перед созданием новых
        timeoutsRef.current.forEach(timeout => clearTimeout(timeout));
        timeoutsRef.current = [];
        
        // Дополнительная защита - принудительно завершаем проверку через 6 секунд (на случай если что-то пойдёт не так)
        const forceCompleteTimeout = setTimeout(() => {
            if (checkInProgressRef.current && mountedRef.current) {
                logger.warn('TtsHealthContext: Force completing health check due to timeout (6s)');
                setIsChecking(false);
                setIsHealthy(false);
                setLastCheck(new Date());
                checkInProgressRef.current = false;
                globalHealthCheckInProgress = false;
            }
        }, 6000);
        timeoutsRef.current.push(forceCompleteTimeout);
        
        // ✅ ИСПРАВЛЕНИЕ: Ref для таймаута Promise.race, чтобы можно было его очистить
        let healthCheckTimeoutId = null;
        
        try {
            // Добавляем таймаут для проверки TTS сервера - 5 секунд максимум
            const healthCheckTimeout = 5000;
            const timeoutPromise = new Promise((_, reject) => {
                healthCheckTimeoutId = setTimeout(() => {
                    reject(new Error('TTS health check timeout'));
                }, healthCheckTimeout);
                timeoutsRef.current.push(healthCheckTimeoutId);
            });
            
            const response = await Promise.race([
                ttsService.get('/health', { timeout: healthCheckTimeout }),
                timeoutPromise
            ]);
            
            // ✅ ИСПРАВЛЕНИЕ: Очищаем таймаут Promise.race если запрос завершился успешно
            if (healthCheckTimeoutId) {
                clearTimeout(healthCheckTimeoutId);
                timeoutsRef.current = timeoutsRef.current.filter(id => id !== healthCheckTimeoutId);
                healthCheckTimeoutId = null;
            }
            
            const data = response.data;
            const isOk = response.status === 200 && data.tts_engine_loaded;
            
            logger.log('TtsHealthContext: TTS server response:', { status: response.status, data, isOk });
            
            if (!mountedRef.current) {
                logger.log('TtsHealthContext: Component unmounted during health check, aborting');
                return;
            }
            
            setIsHealthy(isOk);
            setLastCheck(new Date());
            
        } catch (error) {
            logger.log('TtsHealthContext: TTS server check failed:', error.message || error.code);
            
            if (!mountedRef.current) {
                logger.log('TtsHealthContext: Component unmounted during error handling, aborting');
                return;
            }
            
            setIsHealthy(false);
            setLastCheck(new Date());
        } finally {
            // ✅ ИСПРАВЛЕНИЕ: Очищаем все таймауты в finally
            timeoutsRef.current.forEach(timeout => clearTimeout(timeout));
            timeoutsRef.current = [];
            
            if (mountedRef.current) {
                logger.log('TtsHealthContext: Health check completed, setting isChecking to false');
                setIsChecking(false);
            }
            checkInProgressRef.current = false;
            globalHealthCheckInProgress = false;
        }
    };
    
    const checkHealth = useCallback(() => {
        return checkHealthRef.current();
    }, []);

    // Проверяем health ТОЛЬКО при первой загрузке/обновлении страницы И ТОЛЬКО на TTS-страницах
    useEffect(() => {
        // Отмечаем что компонент смонтирован
        mountedRef.current = true;
        
        // Не проверяем для гостей
        if (isGuest) {
            logger.log('TtsHealthContext: Guest user, skipping health check');
            return;
        }
        
        // 🛡️ Не проверяем TTS на страницах где это не нужно
        const ttsRelatedPaths = ['/dashboard/tts', '/tts'];
        const isTtsPage = ttsRelatedPaths.some(path => location.pathname.startsWith(path));
        
        if (!isTtsPage) {
            logger.log('TtsHealthContext: Not a TTS page, skipping health check');
            setIsChecking(false);
            return;
        }
        
        // Проверяем только один раз при монтировании компонента
        // Дополнительная защита от двойных вызовов в React Strict Mode
        if (!hasCheckedRef.current && !checkInProgressRef.current) {
            logger.log('TtsHealthContext: Starting health check on mount');
            hasCheckedRef.current = true;
            // Небольшая задержка чтобы страница успела отрендериться и пользователь не видел мерцание
            const timeoutId = setTimeout(() => {
                if (mountedRef.current && !checkInProgressRef.current) {
                    checkHealth();
                }
            }, 50);
            
            return () => {
                clearTimeout(timeoutId);
                mountedRef.current = false;
            };
        }
        
        // ✅ ИСПРАВЛЕНИЕ: Cleanup при размонтировании - очищаем все таймауты
        return () => {
            mountedRef.current = false;
            // Очищаем все активные таймауты при размонтировании
            timeoutsRef.current.forEach(timeout => clearTimeout(timeout));
            timeoutsRef.current = [];
        };
    }, []); // Убрали зависимость от pathname - проверяем только при монтировании провайдера

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
