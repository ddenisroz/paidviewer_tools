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
                        <div className="flex flex-col">
                            <Label htmlFor="enable7TV" className="text-sm font-medium">
                                7TV смайлы
                            </Label>
                            <span className="text-xs text-gray-400 mt-1">
                                Озвучивать текстовые названия 7TV эмоций
                            </span>
                        </div>
                        <Switch
                            id="enable7TV"
                            checked={ttsSettings.enable7TV}
                            onCheckedChange={(checked) => handleSettingChange('enable7TV', checked)}
                        />
                    </div>
                    
                    <div className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg">
                        <div className="flex flex-col">
                            <Label htmlFor="enableTwitch" className="text-sm font-medium">
                                Twitch смайлы
                            </Label>
                            <span className="text-xs text-gray-400 mt-1">
                                Озвучивать текстовые названия Twitch эмоций
                            </span>
                        </div>
                        <Switch
                            id="enableTwitch"
                            checked={ttsSettings.enableTwitch}
                            onCheckedChange={(checked) => handleSettingChange('enableTwitch', checked)}
                        />
                    </div>
                    
                    {/* 🛡️ Фильтры сообщений */}
                    <div className="mt-4 pt-4 border-t border-gray-700">
                        <h3 className="text-sm font-semibold text-gray-300 mb-3">Фильтры сообщений</h3>
                        
                        <div className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg">
                            <div className="flex flex-col">
                                <Label htmlFor="filterReplies" className="text-sm font-medium">
                                    Игнорировать ответы
                                </Label>
                                <span className="text-xs text-gray-400 mt-1">
                                    Не озвучивать сообщения-ответы (reply)
                                </span>
                            </div>
                            <Switch
                                id="filterReplies"
                                checked={ttsSettings.filterReplies || false}
                                onCheckedChange={(checked) => handleSettingChange('filterReplies', checked)}
                            />
                        </div>
                        
                        <div className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg mt-3">
                            <div className="flex flex-col">
                                <Label htmlFor="filterMentions" className="text-sm font-medium">
                                    Игнорировать упоминания
                                </Label>
                                <span className="text-xs text-gray-400 mt-1">
                                    Не озвучивать сообщения с @упоминаниями
                                </span>
                            </div>
                            <Switch
                                id="filterMentions"
                                checked={ttsSettings.filterMentions || false}
                                onCheckedChange={(checked) => handleSettingChange('filterMentions', checked)}
                            />
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};

export default TtsSettings;

