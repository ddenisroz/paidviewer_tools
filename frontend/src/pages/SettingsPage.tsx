/* eslint-disable no-alert */
import React, { useState } from 'react';

import { AlertCircle, Inbox, Settings, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { API_BASE_URL } from '@/constants';
import { useAuth } from '@/context/AuthContext';
import { useDonationAlerts } from '@/context/DonationAlertsContext';
import { useIntegrations } from '@/context/IntegrationsContext';
import DeleteAccountModal from '@/shared/components/DeleteAccountModal';
import PageWrapper from '@/shared/components/PageWrapper';
import { DonationAlertsIcon, TwitchIcon, VKIcon } from '@/shared/components/PlatformIcons';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent } from '@/shared/components/ui/card';
import { Label } from '@/shared/components/ui/label';
import { Switch } from '@/shared/components/ui/switch';

import InboxPage from './InboxPage';

type TabType = 'settings' | 'tickets';

const TAB_BUTTON_BASE =
  'inline-flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors border-b-2 border-transparent -mb-px';

const SettingsPage: React.FC = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const { integrations, updateTwitchIntegration, updateVkIntegration } = useIntegrations();
  const { isConnected: daConnected, isLoading: daLoading, connect: daConnect, disconnect: daDisconnect } = useDonationAlerts();

  const [activeTab, setActiveTab] = useState<TabType>('settings');
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const hasMainIntegration = integrations.twitch?.enabled || integrations.vk?.enabled;
  const twitchLabel = integrations.twitch?.username || user?.twitch_username;
  const vkLabel = integrations.vk?.username || user?.vk_channel_name || user?.vk_username;

  const handlePlatformConnect = (platform: 'twitch' | 'vk'): void => {
    window.location.href = `${API_BASE_URL}/auth/${platform}/login`;
  };

  const handleTwitchToggle = (checked: boolean): void => {
    if (checked && !integrations.twitch?.enabled) {
      handlePlatformConnect('twitch');
      return;
    }
    updateTwitchIntegration(checked, null);
  };

  const handleVkToggle = (checked: boolean): void => {
    if (checked && !integrations.vk?.enabled) {
      handlePlatformConnect('vk');
      return;
    }
    updateVkIntegration(checked, null);
  };

  const handleDonationAlertsToggle = async (checked: boolean): Promise<void> => {
    if (!hasMainIntegration) {
      alert('Сначала подключите хотя бы одну основную платформу (Twitch или VK Live).');
      return;
    }

    if (checked) {
      await daConnect();
      return;
    }

    await daDisconnect();
  };

  if (!isAuthenticated) {
    return (
      <PageWrapper title="Настройки">
        <Card className="card-glass border-border/70 bg-card/70">
          <CardContent className="pt-16 pb-16 flex flex-col items-center justify-center text-center space-y-6">
            <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center">
              <AlertCircle className="w-10 h-10 text-muted-foreground" />
            </div>
            <div className="space-y-2 max-w-md">
              <h3 className="text-xl font-semibold text-foreground">Требуется авторизация</h3>
              <p className="text-muted-foreground text-sm">Для доступа к настройкам необходимо войти в систему.</p>
            </div>
            <Button onClick={() => navigate('/login')} className="gap-2">
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
      <div className="mb-4 border-b border-border">
        <div className="flex flex-wrap">
          <button
            type="button"
            onClick={() => setActiveTab('settings')}
            className={`${TAB_BUTTON_BASE} ${
              activeTab === 'settings' ? 'border-primary text-primary' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Settings className="w-4 h-4" />
            Настройки
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('tickets')}
            className={`${TAB_BUTTON_BASE} ${
              activeTab === 'tickets' ? 'border-primary text-primary' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Inbox className="w-4 h-4" />
            Мои тикеты
          </button>
        </div>
      </div>

      {activeTab === 'settings' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="card-glass p-4 flex flex-col justify-between h-full">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <TwitchIcon width="32" height="32" className="text-[#9146FF]" />
                  <div className="flex flex-col">
                    <Label className="text-base font-medium text-foreground">Twitch</Label>
                    <span className="text-xs text-muted-foreground">{twitchLabel || 'Не подключено'}</span>
                  </div>
                </div>
                <Switch
                  checked={integrations.twitch?.enabled || false}
                  onCheckedChange={handleTwitchToggle}
                  className="data-[state=checked]:bg-[#9146FF]"
                />
              </div>
            </Card>

            <Card className="card-glass p-4 flex flex-col justify-between h-full">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <VKIcon width="32" height="32" className="text-[#FF4444]" />
                  <div className="flex flex-col">
                    <Label className="text-base font-medium text-foreground">VK Live</Label>
                    <span className="text-xs text-muted-foreground">{vkLabel || 'Не подключено'}</span>
                  </div>
                </div>
                <Switch
                  checked={integrations.vk?.enabled || false}
                  onCheckedChange={handleVkToggle}
                  className="data-[state=checked]:bg-[#FF4444]"
                />
              </div>
            </Card>

            <Card className="card-glass p-4 flex flex-col justify-between h-full">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <DonationAlertsIcon width="32" height="32" />
                  <div className="flex flex-col">
                    <Label className="text-base font-medium text-foreground">DonationAlerts</Label>
                    <span className="text-xs text-muted-foreground">{daConnected ? 'Подключено' : 'Не подключено'}</span>
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="card-glass flex flex-col gap-2 p-4">
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground text-sm">ID пользователя:</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono font-semibold text-lg text-foreground">{user?.id}</span>
              </div>
            </Card>

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
                  Необратимое действие. Удаление аккаунта приведет к полной потере данных.
                </p>
              </div>
            </Card>
          </div>

          <DeleteAccountModal isOpen={showDeleteModal} onClose={() => setShowDeleteModal(false)} />
        </div>
      )}

      {activeTab === 'tickets' && <InboxPage />}
    </PageWrapper>
  );
};

export default SettingsPage;
