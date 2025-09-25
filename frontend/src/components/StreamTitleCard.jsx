// src/components/StreamTitleCard.jsx
import React, { useState, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Edit3, CheckCircle, XCircle, Save, Loader, Link, Unlink } from 'lucide-react';
import { TwitchIcon, VKIcon } from './PlatformIcons';
import { useData } from '../context/DataContext';
import { useIntegrations } from '../context/IntegrationsContext';

const StreamTitleCard = () => {
    const { integrations } = useIntegrations();
    const { initialData, currentData, setCurrentData, saveChanges, status } = useData();
    
    const [isLinked, setIsLinked] = useState(false);

    const twitchEnabled = integrations.twitch?.enabled;
    const vkEnabled = integrations.vk?.enabled;
    const bothEnabled = twitchEnabled && vkEnabled;
    const hasAnyIntegration = twitchEnabled || vkEnabled;

    const handleTitleChange = (platform, value) => {
        if (isLinked && bothEnabled) {
            setCurrentData(prev => ({
                ...prev,
                twitch: { ...prev.twitch, title: value },
                vk: { ...prev.vk, title: value },
            }));
        } else {
            setCurrentData(prev => ({
                ...prev,
                [platform]: { ...prev[platform], title: value },
            }));
        }
    };

    const handleSave = (mode) => {
        const payload = {};
        
        if (mode === 'both') {
            // Объединенный режим - сохраняем одно и то же название для обеих платформ
            const title = currentData.twitch.title || '';
            if (title !== initialData.twitch.title || title !== initialData.vk.title) {
                if (twitchEnabled) payload.twitch = { title };
                if (vkEnabled) payload.vk = { title };
            }
        } else {
            // Индивидуальный режим - сохраняем только измененные поля
            if (twitchEnabled && currentData.twitch.title !== initialData.twitch.title) {
                payload.twitch = { title: currentData.twitch.title };
            }
            if (vkEnabled && currentData.vk.title !== initialData.vk.title) {
                payload.vk = { title: currentData.vk.title };
            }
        }
        
        if (Object.keys(payload).length > 0) {
            saveChanges(payload, 'saveTitle');
        }
    };
    
    const isChanged = useMemo(() => {
        return JSON.stringify(initialData) !== JSON.stringify(currentData);
    }, [initialData, currentData]);

    if (!hasAnyIntegration) {
        return (
            <Card className="h-full border-red-500/50 bg-red-500/5 opacity-60">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-red-500">
                        <Edit3 className="h-6 w-6" />
                        Смена названия
                    </CardTitle>
                </CardHeader>
                <CardContent className="flex items-center justify-center h-full text-center text-muted-foreground">
                    <div>
                        <p>Интеграции не подключены</p>
                        <p className="text-xs">Перейдите в настройки для подключения</p>
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="h-full">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Edit3 className="h-6 w-6 text-green-500" />
                    Смена названия
                </CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
                {/* Toggle объединения полей */}
                {bothEnabled && (
                    <div className="flex items-center justify-between p-3 bg-background/10 rounded-lg">
                        <Label htmlFor="link-titles" className="flex items-center gap-2 cursor-pointer font-medium">
                            {isLinked ? <Link className="h-4 w-4 text-green-500" /> : <Unlink className="h-4 w-4" />}
                            Объединить поля
                        </Label>
                        <Switch 
                            id="link-titles" 
                            checked={isLinked} 
                            onCheckedChange={setIsLinked} 
                            disabled={!bothEnabled} 
                        />
                    </div>
                )}

                {/* Поля ввода */}
                <div className="space-y-4">
                    {isLinked && bothEnabled ? (
                        <div className="space-y-3">
                            <Label className="flex items-center gap-2 font-medium">
                                <TwitchIcon /><VKIcon /> Общее название
                            </Label>
                            <Input 
                                value={currentData.twitch.title || ''} 
                                onChange={(e) => handleTitleChange('twitch', e.target.value)} 
                                placeholder="Введите общее название для обеих платформ..."
                                className="h-12 text-lg"
                            />
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {/* Поле Twitch */}
                            <div className={`space-y-2 ${!twitchEnabled ? 'opacity-50' : ''}`}>
                                <Label className="flex items-center gap-2 font-medium">
                                    <TwitchIcon /> Twitch
                                    {!twitchEnabled && <span className="text-xs text-muted-foreground">(отключено)</span>}
                                </Label>
                                <Input 
                                    value={currentData.twitch.title || ''} 
                                    onChange={(e) => handleTitleChange('twitch', e.target.value)} 
                                    placeholder={twitchEnabled ? "Название стрима на Twitch..." : "Интеграция отключена"}
                                    className={`h-12 text-lg ${!twitchEnabled ? 'bg-muted cursor-not-allowed blur-sm' : ''}`}
                                    disabled={!twitchEnabled}
                                />
                            </div>

                            {/* Поле VK Live */}
                            <div className={`space-y-2 ${!vkEnabled ? 'opacity-50' : ''}`}>
                                <Label className="flex items-center gap-2 font-medium">
                                    <VKIcon /> VK Live
                                    {!vkEnabled && <span className="text-xs text-muted-foreground">(отключено)</span>}
                                </Label>
                                <Input 
                                    value={currentData.vk.title || ''} 
                                    onChange={(e) => handleTitleChange('vk', e.target.value)} 
                                    placeholder={vkEnabled ? "Название стрима на VK Live..." : "Интеграция отключена"}
                                    className={`h-12 text-lg ${!vkEnabled ? 'bg-muted cursor-not-allowed blur-sm' : ''}`}
                                    disabled={!vkEnabled}
                                />
                            </div>
                        </div>
                    )}
                </div>

                {/* Кнопка сохранения */}
                {hasAnyIntegration && (
                    <div className="pt-2 flex justify-center">
                        <Button 
                            onClick={() => handleSave(isLinked && bothEnabled ? 'both' : 'individual')}
                            disabled={status.saveTitle === 'loading' || !isChanged}
                            className="w-full flex items-center gap-2"
                        >
                            {status.saveTitle === 'loading' ? (
                                <Loader className="h-4 w-4 animate-spin" />
                            ) : (
                                <Save className="h-4 w-4" />
                            )}
                            {status.saveTitle === 'loading' ? 'Сохранение...' : 'Сохранить'}
                        </Button>
                    </div>
                )}
            </CardContent>
        </Card>
    );
};

export default StreamTitleCard;
