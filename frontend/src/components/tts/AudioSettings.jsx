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

    if (listeningMode === 'obs') {
        return null;
    }
    
    return (
        <Card className="border-gray-700 bg-gray-900/30 h-fit">
            <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold text-white">Аудио</CardTitle>
            </CardHeader>
            <CardContent className="pt-2">
                <div className="flex items-center gap-3">
                    <div className="flex-1">
                        <div className="text-xs text-gray-400 mb-2">Громкость</div>
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
                    <div className="text-sm font-semibold text-purple-300 bg-purple-500/20 px-2.5 py-1 rounded border border-purple-500/40 min-w-fit">
                        {localVolume}%
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};

export default AudioSettings;
