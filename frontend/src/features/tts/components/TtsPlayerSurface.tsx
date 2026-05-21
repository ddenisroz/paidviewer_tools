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
    const {
        liveMessages,
        currentItem,
        queue,
        isAudioUnlocked,
        isSocketConnected,
        clearQueue,
        skipCurrent,
        unlockAudio,
    } = useTtsPlayer();

    const { data: audioSettingsResponse } = useTtsAudioSettings();
    const saveAudioSettingsMutation = useSaveTtsAudioSettings();
    const [websiteVolume, setWebsiteVolume] = useState<number>(50);
    const volumeDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        const settings = audioSettingsResponse?.data as { websiteVolume?: number } | undefined;
        if (typeof settings?.websiteVolume === 'number') {
            setWebsiteVolume(settings.websiteVolume);
        }
    }, [audioSettingsResponse]);

    useEffect(() => {
        return () => {
            if (volumeDebounceRef.current) {
                clearTimeout(volumeDebounceRef.current);
            }
        };
    }, []);

    const handleVolumeChange = (value: number): void => {
        setWebsiteVolume(value);
        if (volumeDebounceRef.current) {
            clearTimeout(volumeDebounceRef.current);
        }
        volumeDebounceRef.current = setTimeout(() => {
            saveAudioSettingsMutation.mutate({ websiteVolume: value });
        }, 250);
    };

    const hasItems = Boolean(currentItem) || queue.length > 0;
    const compact = variant === 'dock';
    const messages = liveMessages.slice(0, compact ? 35 : 60);

    return (
        <main
            className={
                compact
                    ? 'mx-auto grid h-screen w-full max-w-[520px] grid-rows-[auto_minmax(0,1fr)] gap-3 overflow-hidden p-3'
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
                onSkipCurrent={skipCurrent}
                onUnlockAudio={() => void unlockAudio()}
                onVolumeChange={handleVolumeChange}
            />
            <TtsPlayerMessages compact={compact} messages={messages} />
        </main>
    );
};

export default TtsPlayerSurface;
