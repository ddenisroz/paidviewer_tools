// src/components/tts/AudioSettings.jsx
import React, { useState, useEffect } from 'react';
import { Slider } from '@/components/ui/slider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const AudioSettings = ({
    audioSettings,
    setAudioSettings,
    listeningMode,
    setListeningMode,
    onSaveSettings,
    obsUrl,
    onRegenerateObsUrl
}) => {
    const [localVolume, setLocalVolume] = useState(audioSettings.websiteVolume || 50);

    useEffect(() => {
        setLocalVolume(audioSettings.websiteVolume || 50);
    }, [audioSettings.websiteVolume]);

    const handleVolumeChange = (value) => {
        setLocalVolume(value);
        const newSettings = {
            ...audioSettings,
            websiteVolume: value
        };
        setAudioSettings(newSettings);
        onSaveSettings(newSettings);
    };

    // Скрываем карточку если выбран OBS
    if (listeningMode === 'obs') {
        return null;
    }
    
    return (
        <Card className="border-gray-700 bg-gray-900/30">
            <CardHeader>
                <CardTitle className="text-base font-semibold text-white">Аудио</CardTitle>
            </CardHeader>
            <CardContent className="pt-3">
                <div className="space-y-2">
                    {/* Громкость для сайта */}
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
                </div>
            </CardContent>
        </Card>
    );
};

export default AudioSettings;
