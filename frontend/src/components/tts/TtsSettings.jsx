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
        <Card className="border-purple-500/30 bg-gradient-to-br from-purple-950/40 to-gray-900/40 shadow-lg shadow-purple-500/10">
            <CardHeader 
                className="cursor-pointer hover:bg-purple-500/10 transition-colors border-b border-purple-500/20 pb-4"
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <div className="flex items-center justify-between">
                    <CardTitle className="text-lg font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-green-400">
                        Settings
                    </CardTitle>
                    <ChevronDown 
                        className={`h-5 w-5 transition-transform duration-300 text-purple-300 ${isExpanded ? 'rotate-180' : ''}`}
                    />
                </div>
            </CardHeader>
            {isExpanded && (
            <CardContent className="pt-6">
                <div className="space-y-6">
                    {/* Настройки смайлов в 2 колонки */}
                    <div>
                        <label className="block text-xs font-bold text-purple-300 uppercase tracking-wider mb-3">Emotes</label>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="flex items-center gap-3 p-3 rounded-lg border border-purple-500/30 bg-purple-900/20 hover:bg-purple-900/40 transition-all">
                                <Switch
                                    id="enable7TV"
                                    checked={ttsSettings.enable7TV}
                                    onCheckedChange={(checked) => handleSettingChange('enable7TV', checked)}
                                />
                                <Label htmlFor="enable7TV" className="text-sm font-semibold text-gray-300 cursor-pointer">
                                    7TV
                                </Label>
                            </div>
                            
                            <div className="flex items-center gap-3 p-3 rounded-lg border border-green-500/30 bg-green-900/20 hover:bg-green-900/40 transition-all">
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
                        <label className="block text-xs font-bold text-purple-300 uppercase tracking-wider mb-3">Filters</label>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="flex items-center gap-3 p-3 rounded-lg border border-purple-500/30 bg-purple-900/20 hover:bg-purple-900/40 transition-all">
                                <Switch
                                    id="filterReplies"
                                    checked={ttsSettings.filterReplies || false}
                                    onCheckedChange={(checked) => handleSettingChange('filterReplies', checked)}
                                />
                                <Label htmlFor="filterReplies" className="text-sm font-semibold text-gray-300 cursor-pointer">
                                    Skip replies
                                </Label>
                            </div>
                            
                            <div className="flex items-center gap-3 p-3 rounded-lg border border-green-500/30 bg-green-900/20 hover:bg-green-900/40 transition-all">
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
