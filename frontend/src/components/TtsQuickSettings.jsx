// src/components/TtsQuickSettings.jsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Volume2, VolumeX, Settings } from 'lucide-react';
import { Switch } from './ui/switch';
import { Button } from './ui/button';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useTts } from '../context/TtsContext';
import { logger } from '../utils/prodLogger';
import { useTtsStatus, useToggleTts, useSetTtsEngine, useLocalTtsConfig, useWhitelistStatus } from '../queries/tts/ttsQueries';

const TtsQuickSettings = () => {
    const navigate = useNavigate();
    const { ttsEnabled: contextTtsEnabled } = useTts();
    const [ttsEnabled, setTtsEnabled] = useState(false);
    const [aiTtsEnabled, setAiTtsEnabled] = useState(false);
    const [aiTtsAvailable, setAiTtsAvailable] = useState(false); // Доступен ли локальный TTS
    const [loading, setLoading] = useState(false);
    const audioContextRef = useRef(null);
    const audioUnlockedRef = useRef(false);
    const initializedRef = useRef(false);

    // Синхронизация с TtsContext после загрузки
    useEffect(() => {
        // 🐛 FIX: Убираем проверку initializedRef.current для немедленного обновления toggle
        setTtsEnabled(contextTtsEnabled);
        logger.info('TtsQuickSettings: Synced with TtsContext', { contextTtsEnabled });
    }, [contextTtsEnabled]);

    // Слушаем изменения Basic TTS из настроек
    useEffect(() => {
        const handleTtsStatusChange = (event) => {
            // 🐛 FIX: Убираем проверку initializedRef.current для немедленного обновления toggle
            logger.info('TtsQuickSettings: Received tts-status-changed event', event.detail);
            setTtsEnabled(event.detail.enabled);
        };

        window.addEventListener('tts-status-changed', handleTtsStatusChange);
        return () => window.removeEventListener('tts-status-changed', handleTtsStatusChange);
    }, []);

    // Слушаем изменения AI TTS из настроек
    useEffect(() => {
        const handleAiTtsChange = (event) => {
            logger.info('TtsQuickSettings: Received ai-tts-changed event', event.detail);
            const { enabled, engineType, isWhitelisted: whitelisted } = event.detail;
            
            // Обновляем состояние только если это действительно F5-TTS
            // enabled = true означает включен F5-TTS (local или cloud для whitelisted)
            // enabled = false означает выключен (переключились на обычный cloud)
            const isTtsEnabled = enabled && ((engineType === 'local') || (engineType === 'cloud' && whitelisted));
            setAiTtsEnabled(isTtsEnabled);
            
            logger.info('TtsQuickSettings: AI TTS state updated:', {
                enabled,
                engineType,
                whitelisted,
                aiTtsEnabled: isTtsEnabled
            });
        };

        window.addEventListener('ai-tts-changed', handleAiTtsChange);
        return () => window.removeEventListener('ai-tts-changed', handleAiTtsChange);
    }, []);

    // ✅ НОВЫЙ КОД: Используем централизованные hooks для загрузки данных
    const { data: ttsStatusResponse } = useTtsStatus(null, {
        refetchInterval: 30000, // Обновляем каждые 30 секунд
        staleTime: 30 * 1000,
    });
    const ttsStatusData = ttsStatusResponse?.data;

    const { data: localTtsConfigResponse } = useLocalTtsConfig({
        retry: false, // Не повторяем при ошибке
    });
    const localTtsConfigData = localTtsConfigResponse?.data;

    const { data: whitelistStatusResponse } = useWhitelistStatus({
        retry: false, // Не повторяем при ошибке
    });
    const whitelistStatusData = whitelistStatusResponse?.data;

    // ✅ НОВЫЙ КОД: Синхронизируем состояние с данными из React Query
    useEffect(() => {
        if (ttsStatusData) {
            setTtsEnabled(ttsStatusData.enabled || false);
            
            // Проверяем whitelist статус
            const whitelistStatus = whitelistStatusData?.is_whitelisted || false;
            setIsWhitelisted(whitelistStatus);
            
            // Локальный TTS доступен если настроен И здоров (не требуется whitelist)
            const isConfigured = localTtsConfigData?.configured || false;
            const isHealthy = localTtsConfigData?.healthy !== false;
            const hasLocalSetup = ttsStatusData.has_local_setup || false;
            
            // Доступен = настроен И здоров (whitelist не требуется для локального TTS)
            setAiTtsAvailable(isConfigured && isHealthy);
            
            // aiTtsEnabled = включен И (настроен локальный ИЛИ в whitelist)
            // Проверяем: engine_type === 'local' (локальный F5-TTS) ИЛИ (engine_type === 'cloud' И в whitelist)
            const engineType = ttsStatusData.engine_type;
            const isF5TtsEnabled = (engineType === 'local') || (engineType === 'cloud' && whitelistStatus);
            setAiTtsEnabled(isF5TtsEnabled);
            
            // Отмечаем что инициализация завершена
            initializedRef.current = true;
            
            logger.info('TtsQuickSettings: Loaded initial state', {
                ttsEnabled: ttsStatusData.enabled,
                aiTtsEnabled: engineType === 'local',
                aiTtsAvailable: isConfigured && isHealthy,
                isConfigured,
                isHealthy,
                isWhitelisted: whitelistStatus,
                hasLocalSetup
            });
        }
    }, [ttsStatusData, localTtsConfigData, whitelistStatusData]);

    const isWhitelisted = whitelistStatusData?.is_whitelisted || false;

    // ✅ НОВЫЙ КОД: Используем централизованные hooks для переключения TTS и движка
    const toggleTtsMutation = useToggleTts({
        onSuccess: (response, enabled) => {
            setTtsEnabled(enabled);
            // Уведомляем TtsContext о изменении (через custom event)
            window.dispatchEvent(new CustomEvent('tts-status-changed', { 
                detail: { enabled } 
            }));
            // toast уже показан в hook
        },
        onError: (error) => {
            // Откатываем состояние
            setTtsEnabled(!ttsEnabled);
            // Более детальная обработка ошибок
            if (error.response?.status === 401) {
                toast.error('Требуется авторизация');
            } else if (error.code === 'ERR_NETWORK') {
                toast.error('Сервер недоступен. Проверьте, запущен ли bot_service');
            }
            // toast уже показан в hook
        },
    });

    const setEngineMutation = useSetTtsEngine({
        onSuccess: (response, engineType) => {
            setAiTtsEnabled(engineType !== 'gtts');
            
            // Уведомляем другие компоненты об изменении с полными данными
            window.dispatchEvent(new CustomEvent('ai-tts-changed', { 
                detail: { 
                    enabled: engineType !== 'gtts',
                    engineType: engineType,
                    isWhitelisted
                } 
            }));
            
            if (engineType === 'gtts') {
                toast.success('☁️ Переключено на базовый TTS');
            } else {
                toast.success(`Движок: ${engineType === 'cloud' ? '☁️ Облачный F5-TTS' : '💻 Локальный F5-TTS'}`);
            }
        },
        onError: (error) => {
            // Откатываем состояние
            setAiTtsEnabled(!aiTtsEnabled);
            if (error.response?.status === 401) {
                toast.error('Требуется авторизация');
            } else if (error.response?.status === 403) {
                toast.error('F5-TTS доступен только для пользователей из whitelist');
            } else if (error.code === 'ERR_NETWORK') {
                toast.error('Сервер недоступен');
            }
            // toast уже показан в hook
        },
    });

    // Слушаем изменения whitelist статуса (например, после добавления в whitelist в админке)
    useEffect(() => {
        const handleWhitelistChange = () => {
            logger.info('TtsQuickSettings: Whitelist changed, invalidating queries...');
            // React Query автоматически обновит данные при изменении whitelist
        };

        window.addEventListener('whitelist-changed', handleWhitelistChange);
        return () => window.removeEventListener('whitelist-changed', handleWhitelistChange);
    }, []);

    // Разблокировка audio context при клике
    const unlockAudioContext = useCallback(async () => {
        if (audioUnlockedRef.current) return;
        
        try {
            if (!audioContextRef.current) {
                audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
            }
            
            if (audioContextRef.current.state === 'suspended') {
                await audioContextRef.current.resume();
            }
            
            // Проигрываем беззвучный звук для разблокировки
            const oscillator = audioContextRef.current.createOscillator();
            const gainNode = audioContextRef.current.createGain();
            
            gainNode.gain.value = 0.01;
            oscillator.connect(gainNode);
            gainNode.connect(audioContextRef.current.destination);
            
            oscillator.start(0);
            oscillator.stop(0.1);
            
            audioUnlockedRef.current = true;
            logger.info('✅ Audio unlocked for TTS playback');
        } catch (err) {
            logger.error('Failed to unlock audio:', err);
        }
    }, []);

    const handleToggleTts = (enabled) => {
        if (toggleTtsMutation.isPending) return;
        
        setLoading(true);
        
        if (enabled) {
            // Разблокируем audio при включении
            unlockAudioContext();
        }
        
        // ✅ НОВЫЙ КОД: Используем централизованный mutation
        toggleTtsMutation.mutate(enabled, {
            onSettled: () => {
                setLoading(false);
            },
        });
    };

    const handleToggleAiTts = (enabled) => {
        // Проверяем доступность локального TTS
        if (enabled && !aiTtsAvailable && !isWhitelisted) {
            toast.error('F5-TTS не настроен. Перейдите в настройки для его настройки.');
            return;
        }
        
        if (setEngineMutation.isPending || toggleTtsMutation.isPending) return;
        
        setLoading(true);
        
        if (enabled) {
            // При включении F5-TTS сначала включаем базовую TTS как fallback (если еще не включена)
            if (!ttsEnabled) {
                toggleTtsMutation.mutate(true, {
                    onSuccess: () => {
                        logger.info('✅ Базовая TTS включена как fallback для F5-TTS');
                        // После включения базовой TTS переключаем движок
                        const newEngine = isWhitelisted ? 'cloud' : 'local';
                        setEngineMutation.mutate(newEngine, {
                            onSettled: () => {
                                setLoading(false);
                            },
                        });
                    },
                    onError: () => {
                        logger.error('Failed to enable basic TTS as fallback');
                        setLoading(false);
                    },
                });
            } else {
                // Если базовая TTS уже включена, просто переключаем движок
                const newEngine = isWhitelisted ? 'cloud' : 'local';
                setEngineMutation.mutate(newEngine, {
                    onSettled: () => {
                        setLoading(false);
                    },
                });
            }
        } else {
            // При выключении F5-TTS переключаемся на базовый TTS, но НЕ выключаем базовую TTS
            setEngineMutation.mutate('gtts', {
                onSettled: () => {
                    setLoading(false);
                },
            });
        }
    };

    // Автоотключение TTS теперь управляется бэкендом через WebSocket disconnect + таймер
    // Если пользователь не переподключится в течение 15 секунд - TTS отключится автоматически
    // Это позволяет сохранить TTS при перезагрузке страницы

    return (
        <div className="border border-border rounded-lg p-3 bg-background/50">
            <div className="flex items-center justify-between gap-3">
                {/* Статус */}
                <div className="flex items-center gap-2">
                    {ttsEnabled ? (
                        <Volume2 className="w-4 h-4 text-purple-400" />
                    ) : (
                        <VolumeX className="w-4 h-4 text-muted-foreground" />
                    )}
                    <span className="text-sm font-medium">
                        Озвучка чата
                    </span>
                </div>

                {/* Main Toggle */}
                <div className="flex items-center gap-2">
                    <Switch
                        id="main-tts-toggle"
                        checked={ttsEnabled}
                        onCheckedChange={handleToggleTts}
                        disabled={loading}
                    />
                    <span className="text-xs text-muted-foreground">
                        {ttsEnabled ? 'ВКЛ' : 'ВЫКЛ'}
                    </span>
                </div>

                {/* Кнопка настроек */}
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate('/dashboard/tts')}
                    className="h-8 px-2"
                >
                    <Settings className="w-4 h-4" />
                </Button>
            </div>
        </div>
    );
};

export default TtsQuickSettings;

