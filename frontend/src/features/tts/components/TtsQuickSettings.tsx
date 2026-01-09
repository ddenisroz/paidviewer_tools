// src/components/TtsQuickSettings.tsx
import React, { useCallback, useEffect, useRef, useState } from 'react';

import { Settings, Volume2, VolumeX } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { useTts } from '@/context/TtsContext';
import { useLocalTtsConfig, useSetTtsEngine, useToggleTts, useTtsStatus, useWhitelistStatus } from '@/queries/tts/ttsQueries';
import { Button } from '@/shared/components/ui/button';
import { Switch } from '@/shared/components/ui/switch';
import { logger } from '@/utils/prodLogger';
import { toast } from '@/utils/toastManager';

const TtsQuickSettings: React.FC = () => {
    const navigate = useNavigate();
    const { ttsEnabled: contextTtsEnabled } = useTts();
    const [ttsEnabled, setTtsEnabled] = useState(false);
    const [aiTtsEnabled, setAiTtsEnabled] = useState(false);
    const [aiTtsAvailable, setAiTtsAvailable] = useState(false); // Доступен ли локальный TTS
    const [loading, setLoading] = useState(false);
    const audioContextRef = useRef<AudioContext | null>(null);
    const audioUnlockedRef = useRef(false);
    const initializedRef = useRef(false);

    // Синхронизация с TtsContext (push events)
    useEffect(() => {
        // FIX: Следим за initializedRef.current для предотвращения лишних toggle
        setTtsEnabled(contextTtsEnabled);
        logger.info('TtsQuickSettings: Synced with TtsContext', { contextTtsEnabled });
    }, [contextTtsEnabled]);

    // Следим за статусом Basic TTS (из событий)
    useEffect(() => {
        const handleTtsStatusChange = (event: CustomEvent<{ enabled: boolean }>) => {
            // FIX: Следим за initializedRef.current для предотвращения лишних toggle
            logger.info('TtsQuickSettings: Received tts-status-changed event', event.detail);
            setTtsEnabled(event.detail.enabled);
        };

        window.addEventListener('tts-status-changed', handleTtsStatusChange as EventListener);
        return () => window.removeEventListener('tts-status-changed', handleTtsStatusChange as EventListener);
    }, []);

    // Следим за статусом AI TTS (из событий)
    useEffect(() => {
        const handleAiTtsChange = (event: CustomEvent<{ enabled: boolean; engineType: string; isWhitelisted?: boolean }>) => {
            logger.info('TtsQuickSettings: Received ai-tts-changed event', event.detail);
            const { enabled, engineType, isWhitelisted: whitelisted } = event.detail;

            // Определяем состояние именно для переключателя F5-TTS
            // enabled = true означает включен F5-TTS (local или cloud если whitelisted)
            // enabled = false означает выключен (переключен на обычный cloud)
            const isTtsEnabled = enabled && ((engineType === 'local') || (engineType === 'cloud' && whitelisted));
            setAiTtsEnabled(isTtsEnabled ?? false);

            logger.info('TtsQuickSettings: AI TTS state updated:', {
                enabled,
                engineType,
                whitelisted,
                aiTtsEnabled: isTtsEnabled
            });
        };

        window.addEventListener('ai-tts-changed', handleAiTtsChange as EventListener);
        return () => window.removeEventListener('ai-tts-changed', handleAiTtsChange as EventListener);
    }, []);

    // [OK] Новый код: используем типизированные hooks для получения данных
    const { data: ttsStatusResponse } = useTtsStatus(null, {
        refetchInterval: 30000, // Обновляем каждые 30 секунд
        staleTime: 30 * 1000,
    });
    const ttsStatusData = ttsStatusResponse?.data;

    const { data: localTtsConfigResponse } = useLocalTtsConfig({
        retry: false, // Не повторять при ошибке
    });
    const localTtsConfigData = localTtsConfigResponse?.data;

    const { data: whitelistStatusResponse } = useWhitelistStatus({
        retry: false, // Не повторять при ошибке
    });
    const whitelistStatusData = whitelistStatusResponse?.data as { is_whitelisted?: boolean } | undefined;

    // [OK] Новый код: инициализируем состояние с данными из React Query
    useEffect(() => {
        if (ttsStatusData) {
            setTtsEnabled(ttsStatusData.enabled || false);

            // Состояние whitelist статуса
            const whitelistStatus = whitelistStatusData?.is_whitelisted || false;

            // Локальный TTS доступен если настроен и здоров (не проверяем whitelist)
            const isConfigured = localTtsConfigData?.configured || false;
            const isHealthy = localTtsConfigData?.healthy !== false;
            const hasLocalSetup = ttsStatusData.has_local_setup || false;

            // Доступен = настроен и здоров (whitelist не требуется для локального TTS)
            setAiTtsAvailable(isConfigured && isHealthy);

            // aiTtsEnabled = включен и (является локальным или в whitelist)
            // Критерий: engine_type === 'local' (локальный F5-TTS) ИЛИ (engine_type === 'cloud' и в whitelist)
            const engineType = ttsStatusData.engine_type;
            const isF5TtsEnabled = (engineType === 'local') || (engineType === 'cloud' && whitelistStatus);
            setAiTtsEnabled(isF5TtsEnabled);

            // Помечаем что инициализация завершена
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

    // [OK] Новый код: используем типизированные hooks для переключения TTS и движка
    const toggleTtsMutation = useToggleTts({
        onSuccess: (response, enabled) => {
            setTtsEnabled(enabled);
            // Уведомляем TtsContext и остальное (через custom event)
            window.dispatchEvent(new CustomEvent('tts-status-changed', {
                detail: { enabled }
            }));
            // toast уже показан в hook
        },
        onError: (error: unknown) => {
            // Откатываем состояние
            setTtsEnabled(!ttsEnabled);
            // Более детальная обработка ошибок
            const axiosError = error as { response?: { status?: number }; code?: string };
            if (axiosError.response?.status === 401) {
                toast.error('Требуется авторизация');
            } else if (axiosError.code === 'ERR_NETWORK') {
                toast.error('Ошибка соединения. Проверьте, запущен ли bot_service');
            }
            // toast уже показан в hook
        },
    });

    const setEngineMutation = useSetTtsEngine({
        onSuccess: (response, engineType) => {
            setAiTtsEnabled(engineType !== 'gtts');

            // Уведомляем другие компоненты об изменении в движке синтеза
            window.dispatchEvent(new CustomEvent('ai-tts-changed', {
                detail: {
                    enabled: engineType !== 'gtts',
                    engineType: engineType,
                    isWhitelisted
                }
            }));

            if (engineType === 'gtts') {
                toast.success('Переключено на обычный TTS');
            } else {
                toast.success(`Успех: ${engineType === 'cloud' ? 'Облачный F5-TTS' : 'Локальный F5-TTS'}`);
            }
        },
        onError: (error: unknown) => {
            // Откатываем состояние
            setAiTtsEnabled(!aiTtsEnabled);
            const axiosError = error as { response?: { status?: number }; code?: string };
            if (axiosError.response?.status === 401) {
                toast.error('Требуется авторизация');
            } else if (axiosError.response?.status === 403) {
                toast.error('F5-TTS доступен только для пользователей из whitelist');
            } else if (axiosError.code === 'ERR_NETWORK') {
                toast.error('Ошибка соединения');
            }
            // toast уже показан в hook
        },
    });

    // Слушаем изменение whitelist статуса (например, когда добавились в whitelist в админке)
    useEffect(() => {
        const handleWhitelistChange = () => {
            logger.info('TtsQuickSettings: Whitelist changed, invalidating queries...');
            // React Query автоматические обновит данные при изменении whitelist
        };

        window.addEventListener('whitelist-changed', handleWhitelistChange);
        return () => window.removeEventListener('whitelist-changed', handleWhitelistChange);
    }, []);

    // Разблокировка audio context при клике
    const unlockAudioContext = useCallback(async () => {
        if (audioUnlockedRef.current) return;

        try {
            if (!audioContextRef.current) {
                const AudioContextClass = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
                if (AudioContextClass) {
                    audioContextRef.current = new AudioContextClass();
                }
            }

            if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
                await audioContextRef.current.resume();
            }

            if (!audioContextRef.current) {
                logger.warn('[TTS] AudioContext not available');
                return;
            }

            // Создаем короткий звук для разблокировки
            const oscillator = audioContextRef.current.createOscillator();
            const gainNode = audioContextRef.current.createGain();

            gainNode.gain.value = 0.01;
            oscillator.connect(gainNode);
            gainNode.connect(audioContextRef.current.destination);

            oscillator.start(0);
            oscillator.stop(0.1);

            audioUnlockedRef.current = true;
            logger.info('[OK] Audio unlocked for TTS playback');
        } catch (err) {
            logger.error('Failed to unlock audio:', err);
        }
    }, []);

    const handleToggleTts = (enabled: boolean) => {
        if (toggleTtsMutation.isPending) return;

        setLoading(true);

        if (enabled) {
            // Разблокируем audio при включении
            unlockAudioContext();
        }

        // [OK] Новый код: используем типизированные mutation
        toggleTtsMutation.mutate(enabled, {
            onSettled: () => {
                setLoading(false);
            },
        });
    };

    const _handleToggleAiTts = (enabled: boolean) => {
        // Проверка доступности локального TTS
        if (enabled && !aiTtsAvailable && !isWhitelisted) {
            toast.error('F5-TTS не доступен. Настройте в настройках или для облака.');
            return;
        }

        if (setEngineMutation.isPending || toggleTtsMutation.isPending) return;

        setLoading(true);

        if (enabled) {
            // При включении F5-TTS должны включить обычный TTS как fallback (если он не включен)
            if (!ttsEnabled) {
                toggleTtsMutation.mutate(true, {
                    onSuccess: () => {
                        logger.info('[OK] Обычный TTS включен как fallback для F5-TTS');
                        // После активации обычного TTS включаем нужный движок
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
                // Если обычный TTS уже включен, просто переключаем движок
                const newEngine = isWhitelisted ? 'cloud' : 'local';
                setEngineMutation.mutate(newEngine, {
                    onSettled: () => {
                        setLoading(false);
                    },
                });
            }
        } else {
            // При отключении F5-TTS переключаемся на обычный TTS, но не выключаем систему TTS
            setEngineMutation.mutate('gtts', {
                onSettled: () => {
                    setLoading(false);
                },
            });
        }
    };

    // Автоматическое TTS должно отключаться только через WebSocket disconnect + таймер
    // Если пользователь не переподключился в течение 15 секунд - TTS выключается принудительно
    // Это поведение регулирует backend

    return (
        <div className="border border-border rounded-lg p-3 bg-background/50">
            <div className="flex items-center justify-between gap-3">
                {/* Иконка */}
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
