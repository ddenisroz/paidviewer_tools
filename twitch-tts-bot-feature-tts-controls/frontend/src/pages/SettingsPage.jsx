// src/pages/SettingsPage.jsx
import React from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Twitch, Video, Inbox, Settings, Gift, AlertCircle } from 'lucide-react';
import { useIntegrations } from '../context/IntegrationsContext';
import { useDonationAlerts } from '../context/DonationAlertsContext';
import { useAuth } from '../context/AuthContext';
import { Loader } from '@/components/ui/loader';
import InboxPage from './InboxPage';

const SettingsPage = () => {
    const { user } = useAuth();
    const { integrations, isLoading, updateTwitchIntegration, updateVkIntegration } = useIntegrations();
    const { isConnected: daConnected, isLoading: daLoading, error: daError, connect: daConnect, disconnect: daDisconnect } = useDonationAlerts();
    const [activeTab, setActiveTab] = React.useState('settings');

    // Проверяем, есть ли хотя бы одна основная интеграция
    const hasMainIntegration = integrations.twitch?.enabled || integrations.vk?.enabled;

    const handleDonationAlertsConnect = async () => {
        if (!hasMainIntegration) {
            alert('Сначала подключите хотя бы одну основную платформу (Twitch или VK Live)');
            return;
        }
        
        await daConnect();
    };

    const handleDonationAlertsDisconnect = async () => {
        await daDisconnect();
    };

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
        <div className="container mx-auto p-6 space-y-6">
            <div>
                <h1 className="text-3xl font-bold mb-6 text-foreground">Настройки</h1>
                <p className="text-muted-foreground">
                    Управление интеграциями и настройками бота
                </p>
            </div>

            {/* Табы */}
            <div className="flex space-x-1 bg-muted p-1 rounded-lg w-fit">
                <button
                    onClick={() => setActiveTab('settings')}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                        activeTab === 'settings'
                            ? 'bg-background text-foreground shadow-sm'
                            : 'text-muted-foreground hover:text-foreground'
                    }`}
                >
                    <Settings className="w-4 h-4 mr-2 inline" />
                    Настройки
                </button>
                <button
                    onClick={() => setActiveTab('tickets')}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                        activeTab === 'tickets'
                            ? 'bg-background text-foreground shadow-sm'
                            : 'text-muted-foreground hover:text-foreground'
                    }`}
                >
                    <Inbox className="w-4 h-4 mr-2 inline" />
                    Мои тикеты
                </button>
            </div>

            {/* Содержимое табов */}
            {activeTab === 'settings' && (
            <>
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

            {/* DonationAlerts Integration */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <img 
                                src="https://donationalerts.com/favicon.ico" 
                                alt="DonationAlerts" 
                                className="h-5 w-5"
                            />
                            <CardTitle>
                                DonationAlerts
                            </CardTitle>
                        </div>
                        <Switch
                            checked={daConnected}
                            onCheckedChange={daConnected ? handleDonationAlertsDisconnect : handleDonationAlertsConnect}
                            disabled={daLoading || !hasMainIntegration}
                        />
                    </div>
                    <CardDescription>
                        {daConnected ? 'Подключен' : ''}
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    
                    {daConnected && !hasMainIntegration && (
                        <div className="flex items-center space-x-2 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-md">
                            <AlertCircle className="w-4 h-4 text-yellow-600" />
                            <p className="text-sm text-yellow-700 dark:text-yellow-300">
                                Сначала подключите основную платформу (Twitch или VK Live)
                            </p>
                        </div>
                    )}
                    
                    {daError && (
                        <div className="flex items-center space-x-2 p-3 bg-red-50 dark:bg-red-900/20 rounded-md">
                            <AlertCircle className="w-4 h-4 text-red-600" />
                            <p className="text-sm text-red-700 dark:text-red-300">
                                {daError}
                            </p>
                        </div>
                    )}
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
                            <span className="text-sm text-muted-foreground">ID личного кабинета:</span>
                            <span className="text-sm font-medium">{user?.id}</span>
                        </div>
                    </div>
                </CardContent>
            </Card>
            </>
            )}

            {/* Таб тикетов */}
            {activeTab === 'tickets' && (
                <InboxPage />
            )}
        </div>
    );
};

export default SettingsPage;
