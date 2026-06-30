import React, { useEffect, useRef, useState } from 'react';

import { useTtsPlayer } from '@/context/TtsPlayerContext';
import { TtsPlayerControls } from '@/features/tts/components/TtsPlayerControls';
import { TtsPlayerMessages } from '@/features/tts/components/TtsPlayerMessages';
import { useSaveTtsAudioSettings, useTtsAudioSettings } from '@/queries/tts/ttsQueries';

type TtsPlayerSurfaceVariant = 'full' | 'dock';

interface TtsPlayerSurfaceProps {
    variant?: TtsPlayerSurfaceVariant;
}

const TtsPlayerSurface: React.FC<TtsPlayerSurfaceProps> = ({ variant = 'full' }) => {
    const compact = variant === 'dock';
    const {
        liveMessages,
        currentItem,
        queue,
        isAudioUnlocked,
        isSocketConnected,
        clearQueue,
        skipCurrent,
        startPlayback,
        stopPlayback,
        unlockAudio,
        setOutputVolume,
    } = useTtsPlayer();

    const { data: audioSettingsResponse } = useTtsAudioSettings({ enabled: !compact });
    const saveAudioSettingsMutation = useSaveTtsAudioSettings({
        onSuccess: () => undefined,
        onError: () => undefined,
    });
    const [websiteVolume, setWebsiteVolume] = useState<number>(() => {
        if (typeof window === 'undefined' || !compact) return 50;
        const stored = Number(window.localStorage.getItem('tts_obs_dock_volume'));
        return Number.isFinite(stored) ? Math.max(0, Math.min(100, Math.round(stored))) : 50;
    });
    const volumeDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        if (!compact) return;
        setOutputVolume(websiteVolume);
    }, [compact, setOutputVolume, websiteVolume]);

    useEffect(() => {
        if (compact) return;
        const settings = audioSettingsResponse?.data as { websiteVolume?: number } | undefined;
        if (typeof settings?.websiteVolume === 'number') {
            setWebsiteVolume(settings.websiteVolume);
            setOutputVolume(settings.websiteVolume);
        }
    }, [audioSettingsResponse, compact, setOutputVolume]);

    useEffect(() => {
        return () => {
            if (volumeDebounceRef.current) {
                clearTimeout(volumeDebounceRef.current);
            }
        };
    }, []);

    const handleVolumeChange = (value: number): void => {
        setWebsiteVolume(value);
        setOutputVolume(value);
        if (compact) {
            window.localStorage.setItem('tts_obs_dock_volume', String(value));
            return;
        }
        if (volumeDebounceRef.current) {
            clearTimeout(volumeDebounceRef.current);
        }
        volumeDebounceRef.current = setTimeout(() => {
            saveAudioSettingsMutation.mutate({ websiteVolume: value });
        }, 250);
    };

    const hasItems = Boolean(currentItem) || queue.length > 0;
    const messages = liveMessages.slice(0, compact ? 35 : 60);

    return (
        <main
            className={
                compact
                    ? 'grid h-full w-full grid-rows-[auto_minmax(0,1fr)] gap-2 overflow-hidden p-2.5'
                    : 'mx-auto flex h-screen w-full max-w-4xl flex-col gap-3 overflow-hidden p-3'
            }
        >
            <TtsPlayerControls
                compact={compact}
                hasItems={hasItems}
                isAudioUnlocked={isAudioUnlocked}
                isSocketConnected={isSocketConnected}
                websiteVolume={websiteVolume}
                onClearQueue={clearQueue}
                onSkipCurrent={() => {
                    void unlockAudio();
                    skipCurrent();
                }}
                onStart={() => {
                    void unlockAudio();
                    startPlayback();
                }}
                onStop={stopPlayback}
                onUnlockAudio={() => void unlockAudio()}
                onVolumeChange={handleVolumeChange}
            />
            <TtsPlayerMessages compact={compact} messages={messages} />
        </main>
    );
};

export default TtsPlayerSurface;
