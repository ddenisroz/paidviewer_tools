// src/components/tts/AudioSettings.jsx
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';

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
        <Card className="mt-6">
            <CardHeader className="pb-2">
                <CardTitle className="text-base">Громкость</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
                <div className="space-y-3">
                    {/* Громкость для сайта */}
                    <div className="space-y-3">
                        <div className="flex items-center gap-3 px-2">
                            <input
                                type="range"
                                id="volume-slider"
                                min="0"
                                max="100"
                                value={localVolume}
                                onChange={(e) => handleVolumeChange(e.target.value)}
                                className="flex-1 h-3 bg-gray-700 rounded-lg appearance-none slider cursor-pointer accent-blue-500"
                                style={{
                                    background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${localVolume}%, #374151 ${localVolume}%, #374151 100%)`
                                }}
                            />
                            <span className="text-sm font-bold text-blue-400 bg-blue-400/10 px-2 py-1 rounded min-w-[50px] text-center">
                                {localVolume}%
                            </span>
                            <style>{`
                                input[type="range"]::-webkit-slider-thumb {
                                    appearance: none;
                                    width: 24px;
                                    height: 24px;
                                    border-radius: 50%;
                                    background: #3b82f6;
                                    cursor: pointer;
                                    box-shadow: 0 0 8px rgba(59, 130, 246, 0.5);
                                    border: 2px solid #1e3a8a;
                                }
                                input[type="range"]::-moz-range-thumb {
                                    width: 24px;
                                    height: 24px;
                                    border-radius: 50%;
                                    background: #3b82f6;
                                    cursor: pointer;
                                    box-shadow: 0 0 8px rgba(59, 130, 246, 0.5);
                                    border: 2px solid #6b21a8;
                                }
                            `}</style>
                        </div>
                        <p className="text-xs text-gray-500">
                            Применяется к аудио, воспроизводимому в браузере
                        </p>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};

export default AudioSettings;

