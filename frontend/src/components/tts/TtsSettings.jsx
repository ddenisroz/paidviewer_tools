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
        <Card className="border-gray-700 bg-gray-900/30">
            <CardHeader 
                className="cursor-pointer hover:bg-gray-800/20 transition-colors"
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <div className="flex items-center justify-between">
                    <CardTitle className="text-base font-semibold text-white">Settings</CardTitle>
                    <ChevronDown 
                        className={`h-5 w-5 transition-transform duration-300 text-gray-400 ${isExpanded ? 'rotate-180' : ''}`}
                    />
                </div>
            </CardHeader>
            {isExpanded && (
            <CardContent className="pt-6">
                <div className="space-y-6">
                    {/* Настройки смайлов в 2 колонки */}
                    <div>
                        <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Emotes</label>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="flex items-center gap-3 p-3 rounded-lg border border-gray-700/50 bg-gray-800/30">
                                <Switch
                                    id="enable7TV"
                                    checked={ttsSettings.enable7TV}
                                    onCheckedChange={(checked) => handleSettingChange('enable7TV', checked)}
                                />
                                <Label htmlFor="enable7TV" className="text-sm font-semibold text-gray-300 cursor-pointer">
                                    7TV
                                </Label>
                            </div>
                            
                            <div className="flex items-center gap-3 p-3 rounded-lg border border-gray-700/50 bg-gray-800/30">
                                <Switch
                                    id="enableTwitch"
                                    checked={ttsSettings.enableTwitch}
                                    onCheckedChange={(checked) => handleSettingChange('enableTwitch', checked)}
                                />
                                <Label htmlFor="enableTwitch" className="text-sm font-semibold text-gray-300 cursor-pointer">
                                    Twitch
                                </Label>
                            </div>
                        </div>
                    </div>
                    
                    {/* Фильтры сообщений в 2 колонки */}
                    <div>
                        <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Filters</label>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="flex items-center gap-3 p-3 rounded-lg border border-gray-700/50 bg-gray-800/30">
                                <Switch
                                    id="filterReplies"
                                    checked={ttsSettings.filterReplies || false}
                                    onCheckedChange={(checked) => handleSettingChange('filterReplies', checked)}
                                />
                                <Label htmlFor="filterReplies" className="text-sm font-semibold text-gray-300 cursor-pointer">
                                    Skip replies
                                </Label>
                            </div>
                            
                            <div className="flex items-center gap-3 p-3 rounded-lg border border-gray-700/50 bg-gray-800/30">
                                <Switch
                                    id="filterMentions"
                                    checked={ttsSettings.filterMentions || false}
                                    onCheckedChange={(checked) => handleSettingChange('filterMentions', checked)}
                                />
                                <Label htmlFor="filterMentions" className="text-sm font-semibold text-gray-300 cursor-pointer">
                                    Skip mentions
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
