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
import PageWrapper from '../components/PageWrapper';

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

    // Убираем глобальный прелоадер

    return (
        <PageWrapper 
            title="Настройки"
            description="Управление интеграциями и настройками бота"
        >

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

                    <Separator />

                    {/* DonationAlerts Integration */}
                    <div className="flex items-center justify-between">
                        <div className="space-y-1">
                            <div className="flex items-center gap-2">
                                <img 
                                    src="/src/images/logos/DA_Alert_Color.svg" 
                                    alt="DonationAlerts" 
                                    className="h-5 w-5"
                                    onError={(e) => {
                                        e.target.style.display = 'none';
                                        e.target.nextSibling.style.display = 'block';
                                    }}
                                />
                                <Gift className="h-5 w-5 text-orange-500" style={{display: 'none'}} />
                                <Label className="text-base font-medium">
                                    DonationAlerts
                                </Label>
                            </div>
                            <p className="text-sm text-muted-foreground">
                                {daConnected ? 'Подключен' : 'Подключение для получения донатов'}
                            </p>
                        </div>
                        <Switch
                            checked={daConnected}
                            onCheckedChange={daConnected ? handleDonationAlertsDisconnect : handleDonationAlertsConnect}
                            disabled={daLoading || !hasMainIntegration}
                        />
                    </div>
                </CardContent>
            </Card>

            {/* Дополнительная информация для DonationAlerts */}
            {(daConnected && !hasMainIntegration) || daError ? (
                <Card>
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
            ) : null}

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
        </PageWrapper>
    );
};

export default SettingsPage;
