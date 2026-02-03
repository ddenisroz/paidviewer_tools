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
import { DonationAlertsIcon, TwitchIcon, VKIcon } from '@/shared/components/PlatformIcons';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Label } from '@/shared/components/ui/label';
import { Switch } from '@/shared/components/ui/switch';

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
                <Card className="card-glass border-border">
                    <CardContent className="pt-16 pb-16 flex flex-col items-center justify-center text-center space-y-6">
                        <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center">
                            <AlertCircle className="w-10 h-10 text-muted-foreground" />
                        </div>
                        <div className="space-y-2 max-w-md">
                            <h3 className="text-xl font-semibold text-foreground">
                                Требуется авторизация
                            </h3>
                            <p className="text-muted-foreground text-sm">
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
                        <Card className="card-glass p-4 flex flex-col justify-between h-full">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <TwitchIcon width="32" height="32" />
                                    <div className="flex flex-col">
                                        <Label className="text-base font-medium text-foreground">Twitch</Label>
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
                        <Card className="card-glass p-4 flex flex-col justify-between h-full">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <VKIcon width="32" height="32" />
                                    <div className="flex flex-col">
                                        <Label className="text-base font-medium text-foreground">VK Live</Label>
                                        <span className="text-xs text-muted-foreground">
                                            {integrations.vk?.username || 'Не подключено'}
                                        </span>
                                    </div>
                                </div>
                                <Switch
                                    checked={integrations.vk?.enabled || false}
                                    onCheckedChange={handleVkToggle}
                                    className="data-[state=checked]:bg-[#FF4444]"
                                />
                            </div>
                        </Card>

                        {/* DonationAlerts Integration */}
                        <Card className="card-glass p-4 flex flex-col justify-between h-full">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <DonationAlertsIcon width="32" height="32" />
                                    <div className="flex flex-col">
                                        <Label className="text-base font-medium text-foreground">DonationAlerts</Label>
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

                    {/* Секция Приоритет аудио */}
                    <Card className="card-glass">
                        <CardHeader className="py-4">
                            <CardTitle className="text-lg font-medium flex items-center gap-2">
                                <Settings className="h-5 w-5" />
                                Приоритет аудио
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="pb-4">
                            <div className="flex flex-col gap-4">
                                <div className="text-sm text-muted-foreground max-w-2xl">
                                    Выберите, как вести себя плееру YouTube во время воспроизведения TTS сообщений.
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setTtsPreference('pause')}
                                        className={`rounded-xl border px-4 py-3 text-left transition-all ${ttsPreference === 'pause'
                                            ? 'border-purple-500/40 bg-purple-500/10 text-white shadow-[0_0_0_1px_rgba(168,85,247,0.25)]'
                                            : 'border-gray-700/60 bg-gray-900/40 text-gray-300 hover:border-purple-500/40'}`}
                                    >
                                        <div className="text-sm font-semibold">Пауза YouTube</div>
                                        <div className="text-xs text-muted-foreground">Полная остановка во время TTS</div>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setTtsPreference('duck')}
                                        className={`rounded-xl border px-4 py-3 text-left transition-all ${ttsPreference === 'duck'
                                            ? 'border-purple-500/40 bg-purple-500/10 text-white shadow-[0_0_0_1px_rgba(168,85,247,0.25)]'
                                            : 'border-gray-700/60 bg-gray-900/40 text-gray-300 hover:border-purple-500/40'}`}
                                    >
                                        <div className="text-sm font-semibold">Приглушение</div>
                                        <div className="text-xs text-muted-foreground">Снижение громкости до 20%</div>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setTtsPreference('none')}
                                        className={`rounded-xl border px-4 py-3 text-left transition-all ${ttsPreference === 'none'
                                            ? 'border-purple-500/40 bg-purple-500/10 text-white shadow-[0_0_0_1px_rgba(168,85,247,0.25)]'
                                            : 'border-gray-700/60 bg-gray-900/40 text-gray-300 hover:border-purple-500/40'}`}
                                    >
                                        <div className="text-sm font-semibold">Без изменений</div>
                                        <div className="text-xs text-muted-foreground">YouTube продолжает играть</div>
                                    </button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* User Info and Danger Zone */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* User Info */}
                        <Card className="card-glass flex flex-col gap-2 p-4">
                            <div className="flex items-center gap-2">
                                <span className="text-muted-foreground text-sm">ID пользователя:</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="font-mono font-semibold text-lg text-foreground">{user?.id}</span>
                            </div>
                        </Card>

                        {/* Danger Zone - Delete Account */}
                        <Card className="card-glass flex flex-col gap-3 p-4 border-red-500/30 bg-red-500/10">
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
