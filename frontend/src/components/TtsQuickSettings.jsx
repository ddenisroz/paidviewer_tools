// src/components/TtsQuickSettings.jsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Volume2, VolumeX, Settings } from 'lucide-react';
import { Switch } from './ui/switch';
import { Button } from './ui/button';
import { useNavigate } from 'react-router-dom';
import { botService } from '../services/microservices';
import { toast } from 'sonner';
import { useTts } from '../context/TtsContext';
import { logger } from '../utils/prodLogger';

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

    // Загрузка начального состояния при монтировании
    useEffect(() => {
        loadSettings();
    }, []);

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
            setAiTtsEnabled(event.detail.enabled);
        };

        window.addEventListener('ai-tts-changed', handleAiTtsChange);
        return () => window.removeEventListener('ai-tts-changed', handleAiTtsChange);
    }, []);

    const [isWhitelisted, setIsWhitelisted] = useState(false);

    const loadSettings = async () => {
        try {
            // 🚀 ОПТИМИЗАЦИЯ: Parallel API calls вместо sequential
            const [statusResponse, configResponse, whitelistResponse] = await Promise.all([
                botService.get('/api/tts/status'),
                botService.get('/api/local-tts/config').catch(() => ({ data: { configured: false } })),
                botService.get('/api/voices/whitelist-status').catch(() => ({ data: { is_whitelisted: false } }))
            ]);
            
            // Загружаем начальное состояние TTS из API
            setTtsEnabled(statusResponse.data.enabled || false);
            
            // Проверяем whitelist статус
            const whitelistStatus = whitelistResponse.data?.is_whitelisted || false;
            setIsWhitelisted(whitelistStatus);
            
            // Локальный TTS доступен если настроен И здоров (не требуется whitelist)
            const isConfigured = configResponse.data.configured || false;
            const isHealthy = configResponse.data.healthy !== false;
            const hasLocalSetup = statusResponse.data.has_local_setup || false;
            
            // Доступен = настроен И здоров (whitelist не требуется для локального TTS)
            setAiTtsAvailable(isConfigured && isHealthy);
            
            // aiTtsEnabled = включен И (настроен локальный ИЛИ в whitelist)
            setAiTtsEnabled(statusResponse.data.engine_type === 'local' && (whitelistStatus || hasLocalSetup));
            
            // Отмечаем что инициализация завершена
            initializedRef.current = true;
            
            logger.info('TtsQuickSettings: Loaded initial state', {
                ttsEnabled: statusResponse.data.enabled,
                aiTtsEnabled: statusResponse.data.engine_type === 'local',
                aiTtsAvailable: isConfigured && isHealthy,
                isConfigured,
                isHealthy,
                isWhitelisted: whitelistStatus,
                hasLocalSetup
            });
        } catch (error) {
            logger.error('Failed to load TTS settings:', error);
            // При ошибке устанавливаем false
            setTtsEnabled(false);
            setAiTtsAvailable(false);
            setIsWhitelisted(false);
            initializedRef.current = true;
        }
    };

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

    const handleToggleTts = async (enabled) => {
        setLoading(true);
        try {
            if (enabled) {
                // Разблокируем audio при включении
                await unlockAudioContext();
                
                await botService.post('/api/tts/enable');
                toast.success('🔊 Озвучка включена');
            } else {
                await botService.post('/api/tts/disable');
                toast.success('🔇 Озвучка отключена');
            }
            
            // Обновляем локальное состояние
            setTtsEnabled(enabled);
            
            // Уведомляем TtsContext о изменении (через custom event)
            window.dispatchEvent(new CustomEvent('tts-status-changed', { 
                detail: { enabled } 
            }));
        } catch (error) {
            // Более детальная обработка ошибок
            if (error.response?.status === 401) {
                toast.error('Требуется авторизация');
            } else if (error.code === 'ERR_NETWORK') {
                toast.error('Сервер недоступен. Проверьте, запущен ли bot_service');
            } else {
                toast.error('Ошибка переключения озвучки');
            }
            logger.error('Failed to toggle TTS:', error);
            // Откатываем состояние
            setTtsEnabled(!enabled);
        } finally {
            setLoading(false);
        }
    };

    const handleToggleAiTts = async (enabled) => {
        // Проверяем доступность локального TTS
        if (enabled && !aiTtsAvailable) {
            toast.error('Локальный TTS не настроен. Перейдите в настройки для его настройки.');
            return;
        }
        
        // Проверяем whitelist для F5-TTS
        if (enabled && !isWhitelisted) {
            toast.error('F5-TTS доступен только для пользователей из whitelist. Обратитесь к администратору.');
            return;
        }
        
        const newEngine = enabled ? 'local' : 'cloud';
        setLoading(true);
        try {
            await botService.post('/api/tts/engine', {
                engine_type: newEngine
            });
            setAiTtsEnabled(enabled);
            
            // Уведомляем другие компоненты об изменении
            window.dispatchEvent(new CustomEvent('ai-tts-changed', { 
                detail: { enabled } 
            }));
            
            toast.success(`Движок: ${enabled ? '💻 Локальный F5-TTS' : '☁️ Облачный'}`);
        } catch (error) {
            if (error.response?.status === 401) {
                toast.error('Требуется авторизация');
            } else if (error.response?.status === 403) {
                toast.error('F5-TTS доступен только для пользователей из whitelist');
            } else if (error.code === 'ERR_NETWORK') {
                toast.error('Сервер недоступен');
            } else {
                toast.error('Ошибка переключения движка');
            }
            logger.error('Failed to toggle engine:', error);
            // Откатываем состояние
            setAiTtsEnabled(!enabled);
        } finally {
            setLoading(false);
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

                {/* Toggles */}
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                        <Switch
                            id="main-tts-toggle"
                            checked={ttsEnabled}
                            onCheckedChange={handleToggleTts}
                            disabled={loading}
                        />
                        <span className="text-xs text-muted-foreground">Базовая</span>
                    </div>
                    
                    <div className="flex items-center gap-2">
                        <Switch
                            id="main-ai-toggle"
                            checked={aiTtsEnabled}
                            onCheckedChange={handleToggleAiTts}
                            disabled={loading || !ttsEnabled || !aiTtsAvailable}
                        />
                        <span className={`text-xs ${!aiTtsAvailable ? 'text-muted-foreground/50' : 'text-muted-foreground'}`}>
                            ИИ (F5){!aiTtsAvailable && ' (недоступна)'}
                        </span>
                    </div>
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

