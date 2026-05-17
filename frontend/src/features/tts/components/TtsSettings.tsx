// src/components/tts/TtsSettings.tsx
import React from 'react';

import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Switch } from '@/shared/components/ui/switch';

interface TtsSettingsState {
    enable7TV?: boolean;
    enableTwitch?: boolean;
    filterReplies?: boolean;
    filterMentions?: boolean;
}

interface TtsSettingsProps {
    ttsSettings: TtsSettingsState;
    setTtsSettings: React.Dispatch<React.SetStateAction<TtsSettingsState>>;
}

const TtsSettings: React.FC<TtsSettingsProps> = ({ ttsSettings, setTtsSettings }) => {
    const handleToggle = (field: keyof TtsSettingsState) => {
        setTtsSettings((prev) => ({
            ...prev,
            [field]: !prev[field],
        }));
    };

    return (
        <Card className="border-gray-700 bg-gray-900/30 h-full">
            <CardHeader className="pb-2.5 border-b border-gray-700/30">
                <CardTitle className="text-sm font-semibold text-white">Дополнительно</CardTitle>
            </CardHeader>
            <CardContent className="pt-3 space-y-2">
                {/* Смайлы */}
                <div className="space-y-1.5">
                    <div className="text-xs font-semibold text-gray-400">Смайлы</div>
                    <div className="grid grid-cols-2 gap-2">
                        <div className="flex items-center justify-between p-2 rounded border border-gray-700/50 bg-gray-800/20">
                            <span className="text-xs text-gray-300">7TV</span>
                            <Switch
                                checked={ttsSettings.enable7TV || false}
                                onCheckedChange={() => handleToggle('enable7TV')}
                                className="scale-75"
                            />
                        </div>
                        <div className="flex items-center justify-between p-2 rounded border border-gray-700/50 bg-gray-800/20">
                            <span className="text-xs text-gray-300">Twitch</span>
                            <Switch
                                checked={ttsSettings.enableTwitch || false}
                                onCheckedChange={() => handleToggle('enableTwitch')}
                                className="scale-75"
                            />
                        </div>
                    </div>
                </div>

                {/* Фильтры */}
                <div className="space-y-1.5 pt-1">
                    <div className="text-xs font-semibold text-gray-400">Фильтры</div>
                    <div className="grid grid-cols-2 gap-2">
                        <div className="flex items-center justify-between p-2 rounded border border-gray-700/50 bg-gray-800/20">
                            <span className="text-xs text-gray-300">Ответы</span>
                            <Switch
                                checked={ttsSettings.filterReplies || false}
                                onCheckedChange={() => handleToggle('filterReplies')}
                                className="scale-75"
                            />
                        </div>
                        <div className="flex items-center justify-between p-2 rounded border border-gray-700/50 bg-gray-800/20">
                            <span className="text-xs text-gray-300">Упоминания</span>
                            <Switch
                                checked={ttsSettings.filterMentions || false}
                                onCheckedChange={() => handleToggle('filterMentions')}
                                className="scale-75"
                            />
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};

export default TtsSettings;
