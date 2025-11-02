// src/pages/SettingsPage.jsx
import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Inbox, Settings, Gift, AlertCircle, Trash2 } from 'lucide-react';
import { TwitchIcon, VKIcon } from '../components/PlatformIcons';
import { useIntegrations } from '../context/IntegrationsContext';
import { useDonationAlerts } from '../context/DonationAlertsContext';
import { useAuth } from '../context/AuthContext';
import { Loader } from '@/components/ui/loader';
import InboxPage from './InboxPage';
import PageWrapper from '../components/PageWrapper';
import DeleteAccountModal from '../components/DeleteAccountModal';

const SettingsPage = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const { integrations, isLoading, updateTwitchIntegration, updateVkIntegration } = useIntegrations();
    const { isConnected: daConnected, isLoading: daLoading, error: daError, connect: daConnect, disconnect: daDisconnect } = useDonationAlerts();
    const [activeTab, setActiveTab] = React.useState('settings');
    const [showDeleteModal, setShowDeleteModal] = React.useState(false);

    // ✅ Логика returnUrl теперь только в HomePage.jsx

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
                <CardContent className="pt-6">
                    <div className="grid grid-cols-3 gap-4">
                        {/* Twitch Integration */}
                        <div className="flex flex-col items-center justify-between gap-3 p-4 rounded-lg border border-gray-700 bg-gray-800/50">
                            <div className="flex items-center gap-2">
                                <TwitchIcon width="20" height="20" />
                                <Label htmlFor="twitch-integration" className="text-base font-medium">
                                    Twitch
                                </Label>
                            </div>
                            <Switch
                                id="twitch-integration"
                                checked={integrations.twitch?.enabled || false}
                                onCheckedChange={updateTwitchIntegration}
                            />
                        </div>

                        {/* VK Integration */}
                        <div className="flex flex-col items-center justify-between gap-3 p-4 rounded-lg border border-gray-700 bg-gray-800/50">
                            <div className="flex items-center gap-2">
                                <VKIcon width="20" height="20" />
                                <Label htmlFor="vk-integration" className="text-base font-medium">
                                    VK Live
                                </Label>
                            </div>
                            <Switch
                                id="vk-integration"
                                checked={integrations.vk?.enabled || false}
                                onCheckedChange={updateVkIntegration}
                                style={integrations.vk?.enabled ? { backgroundColor: '#ef4444' } : {}}
                            />
                        </div>

                        {/* DonationAlerts Integration */}
                        <div className="flex flex-col items-center justify-between gap-3 p-4 rounded-lg border border-gray-700 bg-gray-800/50">
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
                            <Switch
                                checked={daConnected}
                                onCheckedChange={daConnected ? handleDonationAlertsDisconnect : handleDonationAlertsConnect}
                                disabled={daLoading || !hasMainIntegration}
                                style={daConnected ? { backgroundColor: '#f97316' } : {}}
                            />
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* User Info and Danger Zone */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* User Info */}
                <div className="flex items-center justify-between px-4 py-3 rounded-lg border bg-card">
                    <span className="text-sm text-muted-foreground">ID:</span>
                    <span className="text-sm font-medium">{user?.id}</span>
                </div>

                {/* Danger Zone - Delete Account */}
                <div className="border border-red-500/20 bg-red-500/5 rounded-lg px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                            <Trash2 className="h-4 w-4 text-red-500 flex-shrink-0" />
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
                    <p className="text-xs text-red-400/70 mt-2">
                        ⚠️ Необратимые действия. Удаление аккаунта приведет к полной потере всех данных.
                    </p>
                </div>
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
