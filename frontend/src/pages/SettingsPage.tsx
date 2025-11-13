// src/pages/SettingsPage.tsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Inbox, Settings, Gift, AlertCircle, Trash2 } from 'lucide-react';
import { TwitchIcon, VKIcon } from '../components/PlatformIcons';
import { useIntegrations } from '../context/IntegrationsContext';
import { useDonationAlerts } from '../context/DonationAlertsContext';
import { useAuth } from '../context/AuthContext';
import InboxPage from './InboxPage';
import PageWrapper from '../components/PageWrapper';
import DeleteAccountModal from '../components/DeleteAccountModal';

type TabType = 'settings' | 'tickets';

const SettingsPage: React.FC = () => {
    const navigate = useNavigate();
    const { user, isAuthenticated } = useAuth();
    const { integrations, updateTwitchIntegration, updateVkIntegration } = useIntegrations();
    const { isConnected: daConnected, isLoading: daLoading, connect: daConnect, disconnect: daDisconnect } = useDonationAlerts();
    const [activeTab, setActiveTab] = useState<TabType>('settings');
    const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false);

    const hasMainIntegration = integrations.twitch?.enabled || integrations.vk?.enabled;

    const handleDonationAlertsConnect = async (): Promise<void> => {
        if (!hasMainIntegration) {
            alert('Сначала подключите хотя бы одну основную платформу (Twitch или VK Live)');
            return;
        }
        
        await daConnect();
    };

    const handleDonationAlertsDisconnect = async (): Promise<void> => {
        await daDisconnect();
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
            {/* Интеграции */}
            <div className="grid grid-cols-3 gap-4">
                {/* Twitch Integration */}
                <Card className="flex flex-col items-center justify-between gap-3 p-4">
                    <div className="flex items-center gap-2">
                        <TwitchIcon width="20" height="20" />
                        <Label htmlFor="twitch-integration" className="text-base font-medium">
                            Twitch
                        </Label>
                    </div>
                    <Switch
                        id="twitch-integration"
                        checked={integrations.twitch?.enabled || false}
                        onCheckedChange={(checked: boolean) => updateTwitchIntegration(checked, null)}
                    />
                </Card>

                {/* VK Integration */}
                <Card className="flex flex-col items-center justify-between gap-3 p-4">
                    <div className="flex items-center gap-2">
                        <VKIcon width="20" height="20" />
                        <Label htmlFor="vk-integration" className="text-base font-medium">
                            VK Live
                        </Label>
                    </div>
                    <Switch
                        id="vk-integration"
                        checked={integrations.vk?.enabled || false}
                        onCheckedChange={(checked: boolean) => updateVkIntegration(checked, null)}
                        style={integrations.vk?.enabled ? { backgroundColor: '#ef4444' } : {}}
                    />
                </Card>

                {/* DonationAlerts Integration */}
                <Card className="flex flex-col items-center justify-between gap-3 p-4">
                    <div className="flex items-center gap-2">
                        <img 
                            src="/src/images/logos/DA_Alert_Color.svg" 
                            alt="DonationAlerts" 
                            className="h-5 w-5"
                            onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                target.style.display = 'none';
                                const nextSibling = target.nextElementSibling as HTMLElement;
                                if (nextSibling) {
                                    nextSibling.style.display = 'block';
                                }
                            }}
                        />
                        <Gift className="h-5 w-5 text-orange-500" style={{display: 'none'}} />
                        <Label className="text-base font-medium">
                            DonationAlerts
                        </Label>
                    </div>
                    <Switch
                        checked={daConnected}
                        onCheckedChange={daConnected ? handleDonationAlertsDisconnect : handleDonationAlertsConnect}
                        disabled={daLoading || !hasMainIntegration}
                        style={daConnected ? { backgroundColor: '#f97316' } : {}}
                    />
                </Card>
            </div>

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
                    <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                            <Trash2 className="h-5 w-5 text-red-500 flex-shrink-0" />
                            <span className="text-sm font-semibold text-red-500">Опасная зона</span>
                        </div>
                        <Button
                            variant="destructive"
                            onClick={() => setShowDeleteModal(true)}
                            className="bg-red-600 hover:bg-red-700 flex-shrink-0"
                            size="sm"
                        >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Удалить
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

