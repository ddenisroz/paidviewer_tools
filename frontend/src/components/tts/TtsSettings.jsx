// src/components/tts/TtsSettings.jsx
import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { ChevronDown } from 'lucide-react';

const TtsSettings = ({
    ttsSettings,
    setTtsSettings,
    onSaveSettings
}) => {
    const [isExpanded, setIsExpanded] = useState(false);
    
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
        <Card className="h-full border-gray-700/50 bg-gray-800/20">
            <CardHeader 
                className="cursor-pointer hover:bg-gray-800/40 transition-colors pb-2.5 border-b border-gray-700/30"
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-semibold">⚙️ Settings</CardTitle>
                    <ChevronDown 
                        className={`h-5 w-5 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
                    />
                </div>
            </CardHeader>
            {isExpanded && (
            <CardContent className="pt-3">
                <div className="space-y-3">
                    {/* Настройки смайлов в 2 колонки */}
                    <div className="grid grid-cols-2 gap-2">
                        <div className="flex items-center gap-3 p-2.5 bg-gray-800/50 rounded-lg">
                            <Switch
                                id="enable7TV"
                                checked={ttsSettings.enable7TV}
                                onCheckedChange={(checked) => handleSettingChange('enable7TV', checked)}
                            />
                            <Label htmlFor="enable7TV" className="text-sm font-medium cursor-pointer">
                                7TV смайлы
                            </Label>
                        </div>
                        
                        <div className="flex items-center gap-3 p-2.5 bg-gray-800/50 rounded-lg">
                            <Switch
                                id="enableTwitch"
                                checked={ttsSettings.enableTwitch}
                                onCheckedChange={(checked) => handleSettingChange('enableTwitch', checked)}
                            />
                            <Label htmlFor="enableTwitch" className="text-sm font-medium cursor-pointer">
                                Twitch смайлы
                            </Label>
                        </div>
                    </div>
                    
                    {/* Фильтры сообщений в 2 колонки */}
                    <div className="border-t border-gray-700/50 pt-4">
                        <div className="grid grid-cols-2 gap-2">
                            <div className="flex items-center gap-3 p-2.5 bg-gray-800/50 rounded-lg">
                                <Switch
                                    id="filterReplies"
                                    checked={ttsSettings.filterReplies || false}
                                    onCheckedChange={(checked) => handleSettingChange('filterReplies', checked)}
                                />
                                <Label htmlFor="filterReplies" className="text-sm font-medium cursor-pointer">
                                    Игнорировать ответы
                                </Label>
                            </div>
                            
                            <div className="flex items-center gap-3 p-2.5 bg-gray-800/50 rounded-lg">
                                <Switch
                                    id="filterMentions"
                                    checked={ttsSettings.filterMentions || false}
                                    onCheckedChange={(checked) => handleSettingChange('filterMentions', checked)}
                                />
                                <Label htmlFor="filterMentions" className="text-sm font-medium cursor-pointer">
                                    Игнорировать упоминания
                                </Label>
                            </div>
                        </div>
                    </div>
                </div>
            </CardContent>
            )}
        </Card>
    );
};

export default TtsSettings;

