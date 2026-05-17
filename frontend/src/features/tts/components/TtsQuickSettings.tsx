// src/components/TtsQuickSettings.tsx
import React, { useCallback, useRef } from 'react';

import { Settings, Volume2, VolumeX } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { useTts } from '@/context/TtsContext';
import { Button } from '@/shared/components/ui/button';
import { Switch } from '@/shared/components/ui/switch';
import { logger } from '@/shared/utils/prodLogger';

const TtsQuickSettings: React.FC = () => {
    const navigate = useNavigate();
    // Use TtsContext as the source of truth for synchronization
    const { ttsEnabled, toggleTts, isToggling } = useTts();

    // Audio context unlocking logic
    const audioContextRef = useRef<AudioContext | null>(null);
    const audioUnlockedRef = useRef(false);

    // Разблокировка audio context при клике
    const unlockAudioContext = useCallback(async () => {
        if (audioUnlockedRef.current) return;

        try {
            if (!audioContextRef.current) {
                const AudioContextClass =
                    window.AudioContext ||
                    (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
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
        if (isToggling) return;

        if (enabled) {
            // Разблокируем audio при включении
            unlockAudioContext();
        }

        // Use context method to toggle
        toggleTts();
    };

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
                    <span className="text-sm font-medium">Озвучка чата</span>
                </div>

                {/* Main Toggle */}
                <div className="flex items-center gap-2">
                    <Switch
                        id="main-tts-toggle"
                        checked={ttsEnabled}
                        onCheckedChange={handleToggleTts}
                        disabled={isToggling}
                    />
                    <span className="text-xs text-muted-foreground">{ttsEnabled ? 'ВКЛ' : 'ВЫКЛ'}</span>
                </div>

                {/* Кнопка настроек */}
                <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard/tts')} className="h-8 px-2">
                    <Settings className="w-4 h-4" />
                </Button>
            </div>
        </div>
    );
};

export default TtsQuickSettings;
