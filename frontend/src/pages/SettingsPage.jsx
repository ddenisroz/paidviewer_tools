// src/pages/SettingsPage.jsx
import React from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Twitch, Video } from 'lucide-react';
import { useIntegrations } from '../context/IntegrationsContext';
import { useAuth } from '../context/AuthContext';
import { Loader } from '@/components/ui/loader';

const SettingsPage = () => {
    const { user } = useAuth();
    const { integrations, isLoading, updateTwitchIntegration, updateVkIntegration } = useIntegrations();

    // В гостевом режиме показываем настройки без загрузки
    const isGuestMode = localStorage.getItem('guestModeEnabled') === 'true';
    
    if (isLoading && !isGuestMode) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
                    <p className="text-muted-foreground">Загрузка настроек...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold">Настройки</h1>
                <p className="text-muted-foreground">
                    Управление интеграциями и настройками бота
                </p>
            </div>

            <Card>
                <CardContent className="space-y-6 pt-6">
                    {/* Twitch Integration */}
                    <div className="flex items-center justify-between">
                        <div className="space-y-1">
                            <div className="flex items-center gap-2">
                                <Twitch className="h-5 w-5 text-purple-500" />
                                <Label htmlFor="twitch-integration" className="text-base font-medium">
                                    Twitch
                                </Label>
                            </div>
                            <p className="text-sm text-muted-foreground">
                                Подключение бота для работы с трансляцией
                            </p>
                        </div>
                        <Switch
                            id="twitch-integration"
                            checked={integrations.twitch?.enabled || false}
                            onCheckedChange={updateTwitchIntegration}
                        />
                    </div>

                    <Separator />

                    {/* VK Integration */}
                    <div className="flex items-center justify-between">
                        <div className="space-y-1">
                            <div className="flex items-center gap-2">
                                <Video className="h-5 w-5 text-blue-500" />
                                <Label htmlFor="vk-integration" className="text-base font-medium">
                                    VK Video Live
                                </Label>
                            </div>
                            <p className="text-sm text-muted-foreground">
                                Подключение бота для работы с трансляцией
                            </p>
                        </div>
                        <Switch
                            id="vk-integration"
                            checked={integrations.vk?.enabled || false}
                            onCheckedChange={updateVkIntegration}
                        />
                    </div>
                </CardContent>
            </Card>

            {/* User Info */}
            <Card>
                <CardHeader>
                    <CardTitle>Информация о пользователе</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-2">
                        <div className="flex justify-between">
                            <span className="text-sm text-muted-foreground">Имя пользователя:</span>
                            <span className="text-sm font-medium">{user?.username || user?.id}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-sm text-muted-foreground">ID:</span>
                            <span className="text-sm font-medium">{user?.id}</span>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

export default SettingsPage;
