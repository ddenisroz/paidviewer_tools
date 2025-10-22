// src/components/tts/TtsSettings.jsx
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';

const TtsSettings = ({
    ttsSettings,
    setTtsSettings,
    onSaveSettings
}) => {
    const handleSettingChange = (key, value) => {
        const newSettings = {
            ...ttsSettings,
            [key]: value
        };
        setTtsSettings(newSettings);
        
        // Сохраняем настройки с задержкой для избежания частых запросов
        if (onSaveSettings) {
            clearTimeout(handleSettingChange.timeoutId);
            handleSettingChange.timeoutId = setTimeout(() => {
                onSaveSettings(newSettings);
            }, 500);
        }
    };

    return (
        <Card className="mt-6">
            <CardHeader>
                <CardTitle>Дополнительные настройки TTS</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="space-y-3">
                    {/* Настройки смайлов */}
                    <div className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg">
                        <div className="flex items-center space-x-3">
                            <Switch
                                checked={ttsSettings.enable7TV}
                                onCheckedChange={(checked) => handleSettingChange('enable7TV', checked)}
                            />
                            <Label htmlFor="enable7TV" className="text-sm font-medium">
                                7TV смайлы
                            </Label>
                        </div>
                    </div>
                    
                    <div className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg">
                        <div className="flex items-center space-x-3">
                            <Switch
                                checked={ttsSettings.enableTwitch}
                                onCheckedChange={(checked) => handleSettingChange('enableTwitch', checked)}
                            />
                            <Label htmlFor="enableTwitch" className="text-sm font-medium">
                                Twitch смайлы
                            </Label>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};

export default TtsSettings;

