// src/pages/SettingsPage.tsx
import React, { useState } from 'react';

import { AlertCircle, ArrowUpCircle, ChevronDown, Gift, Inbox, Settings, Shield, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

import { BotManagementCard } from '../components/BotManagementCard';
import DeleteAccountModal from '../components/DeleteAccountModal';
import { API_BASE_URL } from '../constants';
import { useAudioPriority } from '../context/AudioPriorityContext';
import { useAuth } from '../context/AuthContext';
import { useDonationAlerts } from '../context/DonationAlertsContext';
import { useIntegrations } from '../context/IntegrationsContext';
import PageWrapper from '../shared/components/PageWrapper';
import { TwitchIcon, VKIcon } from '../shared/components/PlatformIcons';

import InboxPage from './InboxPage';



type TabType = 'settings' | 'tickets';

interface PlatformIntegrationCardProps {
    platform: 'twitch' | 'vk';
    enabled: boolean;
    onToggle: (enabled: boolean) => void;
    onConnect: () => void;
}

const PlatformIntegrationCard: React.FC<PlatformIntegrationCardProps> = ({
    platform,
    enabled,
    onToggle,
    onConnect
}) => {
    const platformName = platform === 'twitch' ? 'Twitch' : 'VK Live';
    const PlatformIcon = platform === 'twitch' ? TwitchIcon : VKIcon;
    const platformColor = platform === 'twitch' ? '#9146FF' : '#ef4444';

    return (
        <Card className="flex flex-col gap-3 p-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <PlatformIcon width="20" height="20" />
                    <Label className="text-base font-medium">
                        {platformName}
                    </Label>
                </div>
                
                {enabled ? (
                    <Switch
                        checked={enabled}
                        onCheckedChange={onToggle}
                        style={{ backgroundColor: platformColor }}
                    />
                ) : (
                    <Button variant="outline" size="sm" onClick={onConnect}>
                        Подключить
                    </Button>
                )}
            </div>
            
            {/* Индикатор подключения */}
            {enabled && (
                <div className="flex items-center gap-1.5 text-xs px-2 py-1.5 rounded bg-green-500/10 text-green-400">
                    <Shield className="w-3 h-3" />
                    <span>Подключено</span>
                </div>
            )}
        </Card>
    );
};

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
            {/* Bot Management (Admin Only) */}
            {user?.is_admin && (
                <BotManagementCard />
            )}

            {/* Интеграции */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Twitch Integration */}
                <PlatformIntegrationCard
                    platform="twitch"
                    enabled={integrations.twitch?.enabled || false}
                    onToggle={(checked) => updateTwitchIntegration(checked, null)}
                    onConnect={() => handlePlatformConnect('twitch')}
                />

                {/* VK Integration */}
                <PlatformIntegrationCard
                    platform="vk"
                    enabled={integrations.vk?.enabled || false}
                    onToggle={(checked) => updateVkIntegration(checked, null)}
                    onConnect={() => handlePlatformConnect('vk')}
                />

                {/* DonationAlerts Integration */}
                <Card className="flex flex-col items-center justify-between gap-3 p-4">
                    <div className="flex items-center gap-2">
                        <img 
                            src="/images/logos/DA_Alert_Color.svg" 
                            alt="DonationAlerts" 
                            className="h-5 w-5"
                            loading="lazy"
                            decoding="async"
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

            {/* Audio Priority Settings */}
            <Card className="p-4">
                <div className="space-y-4">
                    <div className="flex items-center gap-2">
                        <Settings className="h-5 w-5 text-muted-foreground" />
                        <h3 className="text-base font-semibold">Приоритет аудио</h3>
                    </div>
                    <p className="text-sm text-muted-foreground">
                        Выберите, как YouTube должен вести себя, когда воспроизводится TTS
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <button
                            onClick={() => setTtsPreference('pause')}
                            className={`p-4 rounded-lg border-2 transition-all ${
                                ttsPreference === 'pause'
                                    ? 'border-primary bg-primary/10'
                                    : 'border-gray-700 hover:border-gray-600'
                            }`}
                        >
                            <div className="space-y-2">
                                <div className="font-semibold">Пауза</div>
                                <div className="text-xs text-muted-foreground">
                                    YouTube полностью останавливается во время TTS
                                </div>
                            </div>
                        </button>
                        <button
                            onClick={() => setTtsPreference('duck')}
                            className={`p-4 rounded-lg border-2 transition-all ${
                                ttsPreference === 'duck'
                                    ? 'border-primary bg-primary/10'
                                    : 'border-gray-700 hover:border-gray-600'
                            }`}
                        >
                            <div className="space-y-2">
                                <div className="font-semibold">Приглушение</div>
                                <div className="text-xs text-muted-foreground">
                                    YouTube продолжает играть, но тише (20% громкости)
                                </div>
                            </div>
                        </button>
                        <button
                            onClick={() => setTtsPreference('none')}
                            className={`p-4 rounded-lg border-2 transition-all ${
                                ttsPreference === 'none'
                                    ? 'border-primary bg-primary/10'
                                    : 'border-gray-700 hover:border-gray-600'
                            }`}
                        >
                            <div className="space-y-2">
                                <div className="font-semibold">Без изменений</div>
                                <div className="text-xs text-muted-foreground">
                                    YouTube и TTS играют одновременно
                                </div>
                            </div>
                        </button>
                    </div>
                </div>
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
                    <div className="flex items-center gap-2">
                        <Trash2 className="h-5 w-5 text-red-500 flex-shrink-0" />
                        <span className="text-sm font-semibold text-red-500">Опасная зона</span>
                    </div>
                    <div className="flex items-start gap-2">
                        <AlertCircle className="h-4 w-4 text-red-400/80 flex-shrink-0 mt-0.5" />
                        <p className="text-xs text-red-400/80 leading-relaxed">
                            Необратимые действия. Удаление аккаунта приведет к полной потере всех данных.
                        </p>
                    </div>
                    <Button
                        variant="destructive"
                        onClick={() => setShowDeleteModal(true)}
                        className="w-full bg-red-600 hover:bg-red-700"
                        size="sm"
                    >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Удалить аккаунт
                    </Button>
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
