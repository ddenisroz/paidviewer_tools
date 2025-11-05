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
        <Card className="border-green-500/30 bg-gradient-to-br from-green-950/40 to-gray-900/40 shadow-lg shadow-green-500/10">
            <CardHeader className="border-b border-green-500/20 pb-4">
                <CardTitle className="text-lg font-bold text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-purple-400">
                    Audio
                </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
                <div className="space-y-4">
                    {/* Громкость для сайта */}
                    <div>
                        <label className="block text-xs font-bold text-green-300 uppercase tracking-wider mb-4">Website Volume</label>
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
                                <span className="text-sm font-bold text-green-300 bg-green-500/20 px-3 py-1 rounded border border-green-500/50">
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
