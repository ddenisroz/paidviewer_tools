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
            <CardContent className="pt-6">
                <div className="space-y-4">
                    {/* Громкость для сайта */}
                    <div>
                        <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">Громкость сайта</label>
                        <div className="flex items-center gap-4">
                            <Slider
                                id="volume-slider"
                                min={0}
                                max={100}
                                step={1}
                                value={[localVolume]}
                                onValueChange={(value) => handleVolumeChange(value[0])}
                                className="flex-1"
                            />
                            <div className="min-w-fit">
                                <span className="text-sm font-bold text-purple-300 bg-purple-500/20 px-3 py-1 rounded border border-purple-500/40">
                                    {localVolume}%
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};

export default AudioSettings;
