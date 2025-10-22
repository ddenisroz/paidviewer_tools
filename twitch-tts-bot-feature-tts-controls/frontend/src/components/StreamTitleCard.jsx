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

    const handleKeyPress = (e) => {
        if (e.key === 'Enter' && isChanged && status.saveTitle !== 'loading') {
            handleSave(isLinked && bothEnabled ? 'both' : 'individual');
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
        // Проверяем изменения только в заголовках
        const titleChanged = 
            (twitchEnabled && initialData.twitch.title !== currentData.twitch.title) ||
            (vkEnabled && initialData.vk.title !== currentData.vk.title);
        return titleChanged;
    }, [initialData.twitch.title, initialData.vk.title, currentData.twitch.title, currentData.vk.title, twitchEnabled, vkEnabled]);

    if (!hasAnyIntegration) {
        return (
            <Card className="border-red-500/50 bg-red-500/5 opacity-60">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-red-500">
                        <Edit3 className="h-6 w-6" />
                        Смена названия
                    </CardTitle>
                </CardHeader>
                <CardContent className="flex items-center justify-center min-h-[300px]">
                    <div className="text-center space-y-4">
                        <div className="w-16 h-16 mx-auto flex items-center justify-center">
                            <svg className="w-12 h-12 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </div>
                        <p className="text-sm text-muted-foreground px-4">Авторизуйтесь для полного функционала</p>
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="flex flex-col min-h-[300px]">
            <CardHeader className="flex-shrink-0 pb-3">
                <CardTitle className="flex items-center gap-2">
                    <Edit3 className="h-5 w-5 text-green-500" />
                    Смена названия
                </CardTitle>
            </CardHeader>
            <CardContent className="p-4 flex-1 flex flex-col">
                {/* Toggle объединения полей */}
                {bothEnabled && (
                    <div className="flex items-center justify-between p-2 bg-background/10 rounded-lg mb-3">
                        <Label htmlFor="link-titles" className="flex items-center gap-2 cursor-pointer text-sm">
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
                <div className="flex-1 flex items-center justify-center py-4 min-h-[120px]">
                    <div className="w-full space-y-4">
                        {isLinked && bothEnabled ? (
                            <div className="space-y-3 h-[80px] flex flex-col justify-center">
                                <Label className="flex items-center gap-2 text-sm">
                                    <TwitchIcon /><VKIcon /> Общее название
                                </Label>
                                <Input 
                                    value={currentData.twitch.title || ''} 
                                    onChange={(e) => handleTitleChange('twitch', e.target.value)} 
                                    onKeyPress={handleKeyPress}
                                    placeholder="Введите общее название для обеих платформ..."
                                    className="h-10"
                                />
                            </div>
                        ) : (
                            <div className="space-y-4 h-[160px] flex flex-col justify-center">
                                {/* Поле Twitch */}
                                <div className={`space-y-3 ${!twitchEnabled ? 'opacity-50' : ''}`}>
                                    <Label className="flex items-center gap-2 text-sm">
                                        <TwitchIcon /> Twitch
                                        {!twitchEnabled && <span className="text-xs text-muted-foreground">(отключено)</span>}
                                    </Label>
                                    <Input 
                                        value={currentData.twitch.title || ''} 
                                        onChange={(e) => handleTitleChange('twitch', e.target.value)} 
                                        onKeyPress={handleKeyPress}
                                        placeholder={twitchEnabled ? "Название стрима на Twitch..." : "Интеграция отключена"}
                                        className={`h-10 ${!twitchEnabled ? 'bg-muted cursor-not-allowed blur-sm' : ''}`}
                                        disabled={!twitchEnabled}
                                    />
                                </div>

                                {/* Поле VK Live */}
                                <div className={`space-y-3 ${!vkEnabled ? 'opacity-50' : ''}`}>
                                    <Label className="flex items-center gap-2 text-sm">
                                        <VKIcon /> VK Live
                                        {!vkEnabled && <span className="text-xs text-muted-foreground">(отключено)</span>}
                                    </Label>
                                    <Input 
                                        value={currentData.vk.title || ''} 
                                        onChange={(e) => handleTitleChange('vk', e.target.value)} 
                                        onKeyPress={handleKeyPress}
                                        placeholder={vkEnabled ? "Название стрима на VK Live..." : "Интеграция отключена"}
                                        className={`h-10 ${!twitchEnabled ? 'bg-muted cursor-not-allowed blur-sm' : ''}`}
                                        disabled={!vkEnabled}
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Кнопка сохранения */}
                {hasAnyIntegration && (
                    <div className="mt-auto pt-4 flex justify-center">
                        <Button 
                            onClick={() => handleSave(isLinked && bothEnabled ? 'both' : 'individual')}
                            disabled={status.saveTitle === 'loading' || !isChanged}
                            size="sm"
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
