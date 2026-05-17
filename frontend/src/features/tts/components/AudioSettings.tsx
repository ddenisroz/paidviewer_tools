// src/components/tts/AudioSettings.tsx
import React, { useCallback, useEffect, useRef, useState } from 'react';

import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Slider } from '@/shared/components/ui/slider';

// logger available for debugging
// import { logger } from '@/shared/utils/prodLogger';

interface AudioSettingsState {
    websiteVolume: number;
}

interface AudioSettingsProps {
    audioSettings: AudioSettingsState;
    setAudioSettings: React.Dispatch<React.SetStateAction<AudioSettingsState>>;
    listeningMode: string;
    onSaveSettings?: (settings: AudioSettingsState) => void;
}

const AudioSettings: React.FC<AudioSettingsProps> = ({
    audioSettings,
    setAudioSettings,
    listeningMode,
    onSaveSettings,
}) => {
    const [localVolume, setLocalVolume] = useState(audioSettings.websiteVolume);
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        setLocalVolume(audioSettings.websiteVolume);
    }, [audioSettings.websiteVolume]);

    const handleVolumeChange = useCallback(
        (value: number) => {
            setLocalVolume(value);
            const newSettings = { ...audioSettings, websiteVolume: value };
            setAudioSettings(newSettings);
            if (onSaveSettings) {
                if (timeoutRef.current) {
                    clearTimeout(timeoutRef.current);
                }
                timeoutRef.current = setTimeout(() => {
                    onSaveSettings(newSettings);
                }, 500);
            }
        },
        [audioSettings, setAudioSettings, onSaveSettings]
    );

    // Cleanup timeout on unmount
    useEffect(() => {
        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, []);

    // Скрываем карточку если выбран OBS
    if (listeningMode === 'obs') {
        return null;
    }

    return (
        <Card className="border-gray-700 bg-gray-900/30 h-full">
            <CardHeader className="pb-2.5 border-b border-gray-700/30">
                <CardTitle className="text-sm font-semibold text-white">Аудио</CardTitle>
            </CardHeader>
            <CardContent className="pt-3 space-y-2">
                {/* Громкость */}
                <div>
                    <div className="flex items-center justify-between mb-2">
                        <label className="text-xs font-semibold text-gray-400">Громкость</label>
                        <span className="text-xs font-bold text-purple-300 bg-purple-500/20 px-2 py-0.5 rounded">
                            {localVolume}%
                        </span>
                    </div>
                    <Slider
                        id="volume-slider"
                        min={0}
                        max={100}
                        step={1}
                        value={[localVolume]}
                        onValueChange={(value) => handleVolumeChange(value[0])}
                        className="flex-1"
                    />
                </div>
            </CardContent>
        </Card>
    );
};

export default AudioSettings;
