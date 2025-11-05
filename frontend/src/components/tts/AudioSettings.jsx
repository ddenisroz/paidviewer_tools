// src/components/tts/AudioSettings.jsx
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';

const AudioSettings = ({
    audioSettings,
    setAudioSettings,
    listeningMode,
    onSaveSettings
}) => {
    const currentVolume = listeningMode === 'obs' ? audioSettings.obsVolume : audioSettings.websiteVolume;
    const currentVolumeKey = listeningMode === 'obs' ? 'obsVolume' : 'websiteVolume';
    const [localVolume, setLocalVolume] = useState(currentVolume);
    const [debounceTimeout, setDebounceTimeout] = useState(null);

    useEffect(() => {
        setLocalVolume(currentVolume);
    }, [currentVolume, listeningMode]);

    const handleVolumeChange = (value) => {
        const newVolume = parseInt(value);
        setLocalVolume(newVolume);
        
        // Обновляем локальное состояние сразу для плавности UI
        const newSettings = {
            ...audioSettings,
            [currentVolumeKey]: newVolume
        };
        setAudioSettings(newSettings);
        
        // Отправляем запрос с debounce (1000ms для экономии запросов)
        if (debounceTimeout) {
            clearTimeout(debounceTimeout);
        }
        
        const newTimeout = setTimeout(() => {
            if (onSaveSettings) {
                onSaveSettings(newSettings);
            }
        }, 1000);
        
        setDebounceTimeout(newTimeout);
    };

    // Скрываем карточку если выбран OBS
    if (listeningMode === 'obs') {
        return null;
    }
    
    return (
        <Card className="border-gray-700 bg-gray-900/50">
            <CardHeader>
                <CardTitle className="text-base font-semibold">Audio</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    {/* Громкость для сайта */}
                    <div>
                        <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Website Volume</label>
                        <div className="flex items-center gap-3">
                            <Slider
                                id="volume-slider"
                                min={0}
                                max={100}
                                step={1}
                                value={[localVolume]}
                                onValueChange={(value) => handleVolumeChange(value[0])}
                                className="flex-1"
                            />
                            <span className="text-sm font-bold text-blue-400 bg-blue-400/10 px-3 py-1.5 rounded-lg min-w-[55px] text-center border border-blue-500/30">
                                {localVolume}%
                            </span>
                        </div>
                        <p className="text-xs text-gray-400 italic">
                            Применяется к аудио, воспроизводимому в браузере
                        </p>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};

export default AudioSettings;

