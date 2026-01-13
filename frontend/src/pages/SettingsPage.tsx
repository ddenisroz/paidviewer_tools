// src/pages/SettingsPage.tsx
import React, { useState } from 'react';

import { AlertCircle, Inbox, Settings, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';


import { API_BASE_URL } from '@/constants';
import { useAudioPriority } from '@/context/AudioPriorityContext';
import { useAuth } from '@/context/AuthContext';
import { useDonationAlerts } from '@/context/DonationAlertsContext';
import { useIntegrations } from '@/context/IntegrationsContext';
// BotManagementCard removed as per requirements (moved to Admin)
import DeleteAccountModal from '@/shared/components/DeleteAccountModal';
import PageWrapper from '@/shared/components/PageWrapper';
import { TwitchIcon, VKIcon, DonationAlertsIcon } from '@/shared/components/PlatformIcons';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';

import { Label } from '@/shared/components/ui/label';
import { Switch } from '@/shared/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';

import InboxPage from './InboxPage';


type TabType = 'settings' | 'tickets';

const SettingsPage: React.FC = () => {
    const navigate = useNavigate();
    const { user, isAuthenticated } = useAuth();
    const { integrations, updateTwitchIntegration, updateVkIntegration } = useIntegrations();
    const { isConnected: daConnected, isLoading: daLoading, connect: daConnect, disconnect: daDisconnect } = useDonationAlerts();
    const { ttsPreference, setTtsPreference } = useAudioPriority();
    const [activeTab, setActiveTab] = useState<TabType>('settings');
    const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false);

    const hasMainIntegration = integrations.twitch?.enabled || integrations.vk?.enabled;

    const handlePlatformConnect = (platform: 'twitch' | 'vk'): void => {
        const authUrl = `${API_BASE_URL}/auth/${platform}/login`;
        window.location.href = authUrl;
    };

    const handleTwitchToggle = (checked: boolean) => {
        if (checked && !integrations.twitch?.enabled) {
            handlePlatformConnect('twitch');
        } else {
            updateTwitchIntegration(checked, null);
        }
    };

    const handleVkToggle = (checked: boolean) => {
        if (checked && !integrations.vk?.enabled) {
            handlePlatformConnect('vk');
        } else {
            updateVkIntegration(checked, null);
        }
    };

    const handleDonationAlertsToggle = async (checked: boolean) => {
        if (!hasMainIntegration) {
            alert('Сначала подключите хотя бы одну основную платформу (Twitch или VK Live)');
            return;
        }

        if (checked) {
            await daConnect();
        } else {
            await daDisconnect();
        }
    };

    if (!isAuthenticated) {
        return (
            <PageWrapper title="Настройки">
                <Card className="border-gray-700">
                    <CardContent className="pt-16 pb-16 flex flex-col items-center justify-center text-center space-y-6">
                        <div className="w-20 h-20 rounded-full bg-gray-800 flex items-center justify-center">
                            <AlertCircle className="w-10 h-10 text-gray-500" />
                        </div>
                        <div className="space-y-2 max-w-md">
                            <h3 className="text-xl font-semibold text-gray-200">
                                Требуется авторизация
                            </h3>
                            <p className="text-gray-400 text-sm">
                                Для доступа к настройкам необходимо войти в систему
                            </p>
                        </div>
                        <Button
                            onClick={() => navigate('/login')}
                            className="gap-2"
                        >
                            <Settings className="w-4 h-4" />
                            Войти в систему
                        </Button>
                    </CardContent>
                </Card>
            </PageWrapper>
        );
    }

    return (
        <PageWrapper title="Настройки">
            {/* Табы */}
            <div className="flex space-x-1 bg-muted p-1 rounded-lg w-fit">
                <button
                    onClick={() => setActiveTab('settings')}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'settings'
                        ? 'bg-background text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                        }`}
                >
                    <Settings className="w-4 h-4 mr-2 inline" />
                    Настройки
                </button>
                <button
                    onClick={() => setActiveTab('tickets')}
                    className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'tickets'
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
                <div className="space-y-6">

                    {/* Секция Интеграций - как в Legacy, простые карточки с тогглами */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* Twitch Integration */}
                        <Card className="p-4 flex flex-col justify-between h-full">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <TwitchIcon width="24" height="24" />
                                    <div className="flex flex-col">
                                        <Label className="text-base font-medium">Twitch</Label>
                                        <span className="text-xs text-muted-foreground">
                                            {integrations.twitch?.username || 'Не подключено'}
                                        </span>
                                    </div>
                                </div>
                                <Switch
                                    checked={integrations.twitch?.enabled || false}
                                    onCheckedChange={handleTwitchToggle}
                                    className="data-[state=checked]:bg-[#9146FF]"
                                />
                            </div>
                        </Card>

                        {/* VK Integration */}
                        <Card className="p-4 flex flex-col justify-between h-full">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <VKIcon width="24" height="24" />
                                    <div className="flex flex-col">
                                        <Label className="text-base font-medium">VK Live</Label>
                                        <span className="text-xs text-muted-foreground">
                                            {integrations.vk?.username || 'Не подключено'}
                                        </span>
                                    </div>
                                </div>
                                <Switch
                                    checked={integrations.vk?.enabled || false}
                                    onCheckedChange={handleVkToggle}
                                    className="data-[state=checked]:bg-[#0077FF]"
                                />
                            </div>
                        </Card>

                        {/* DonationAlerts Integration */}
                        <Card className="p-4 flex flex-col justify-between h-full">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <DonationAlertsIcon width="24" height="24" />
                                    <div className="flex flex-col">
                                        <Label className="text-base font-medium">DonationAlerts</Label>
                                        <span className="text-xs text-muted-foreground">
                                            {daConnected ? 'Подключено' : 'Не подключено'}
                                        </span>
                                    </div>
                                </div>
                                <Switch
                                    checked={daConnected}
                                    onCheckedChange={handleDonationAlertsToggle}
                                    disabled={daLoading || !hasMainIntegration}
                                    className="data-[state=checked]:bg-[#F97316]"
                                />
                            </div>
                        </Card>
                    </div>

                    {/* Секция Приоритет аудио - компактный список */}
                    <Card>
                        <CardHeader className="py-4">
                            <CardTitle className="text-lg font-medium flex items-center gap-2">
                                <Settings className="h-5 w-5" />
                                Приоритет аудио
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="pb-4">
                            <div className="flex flex-col md:flex-row items-center gap-4 justify-between">
                                <div className="text-sm text-muted-foreground max-w-lg">
                                    Выберите, как вести себя плееру YouTube во время воспроизведения TTS сообщений.
                                </div>
                                <div className="w-full md:w-64">
                                    <Select value={ttsPreference} onValueChange={(val: any) => setTtsPreference(val)}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Выберите режим" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="pause">Пауза (YouTube)</SelectItem>
                                            <SelectItem value="duck">Приглушение (20%)</SelectItem>
                                            <SelectItem value="none">Без изменений</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* User Info and Danger Zone */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* User Info */}
                        <Card className="flex flex-col gap-2 p-4">
                            <div className="flex items-center gap-2">
                                <span className="text-muted-foreground text-sm">ID пользователя:</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="font-mono font-semibold text-lg text-foreground">{user?.id}</span>
                            </div>
                        </Card>

                        {/* Danger Zone - Delete Account */}
                        <Card className="flex flex-col gap-3 p-4 border-red-500/30 bg-red-500/10">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Trash2 className="h-5 w-5 text-red-500 flex-shrink-0" />
                                    <span className="text-sm font-semibold text-red-500">Опасная зона</span>
                                </div>
                                <Button
                                    variant="destructive"
                                    onClick={() => setShowDeleteModal(true)}
                                    className="bg-red-600 hover:bg-red-700 h-8 text-xs"
                                    size="sm"
                                >
                                    Удалить аккаунт
                                </Button>
                            </div>
                            <div className="flex items-start gap-2">
                                <AlertCircle className="h-4 w-4 text-red-400/80 flex-shrink-0 mt-0.5" />
                                <p className="text-xs text-red-400/80 leading-relaxed">
                                    Необратимые действия. Удаление аккаунта приведет к полной потере всех данных.
                                </p>
                            </div>
                        </Card>
                    </div>

                    {/* Delete Account Modal */}
                    <DeleteAccountModal
                        isOpen={showDeleteModal}
                        onClose={() => setShowDeleteModal(false)}
                    />
                </div>
            )}

            {/* Таб тикетов */}
            {activeTab === 'tickets' && (
                <InboxPage />
            )}
        </PageWrapper>
    );
};

export default SettingsPage;
