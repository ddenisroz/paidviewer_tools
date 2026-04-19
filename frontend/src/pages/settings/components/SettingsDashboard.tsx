import React from 'react';

import { AlertCircle, Trash2 } from 'lucide-react';

import DeleteAccountModal from '@/shared/components/DeleteAccountModal';
import PageWrapper from '@/shared/components/PageWrapper';
import { DonationAlertsIcon, TwitchIcon, VKIcon } from '@/shared/components/PlatformIcons';
import { Button } from '@/shared/components/ui/button';
import { Card } from '@/shared/components/ui/card';

import SettingsIntegrationCard from './SettingsIntegrationCard';

interface SettingsDashboardProps {
    authErrorMessage: string | null;
    authSuccessMessage: string | null;
    daConnected: boolean;
    daLoading: boolean;
    hasMainIntegration: boolean;
    onCloseDeleteModal: () => void;
    onDonationAlertsToggle: (checked: boolean) => void | Promise<void>;
    onOpenDeleteModal: () => void;
    onTwitchToggle: (checked: boolean) => void;
    onVkToggle: (checked: boolean) => void;
    showDeleteModal: boolean;
    twitchEnabled: boolean;
    twitchLabel: string;
    userId: number | string | undefined;
    vkEnabled: boolean;
    vkLabel: string;
}

const SettingsDashboard: React.FC<SettingsDashboardProps> = ({
    authErrorMessage,
    authSuccessMessage,
    daConnected,
    daLoading,
    hasMainIntegration,
    onCloseDeleteModal,
    onDonationAlertsToggle,
    onOpenDeleteModal,
    onTwitchToggle,
    onVkToggle,
    showDeleteModal,
    twitchEnabled,
    twitchLabel,
    userId,
    vkEnabled,
    vkLabel,
}) => (
    <PageWrapper title="Настройки">
        <div className="space-y-6">
            {authSuccessMessage && (
                <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
                    {authSuccessMessage}
                </div>
            )}
            {authErrorMessage && (
                <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
                    {authErrorMessage}
                </div>
            )}

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <SettingsIntegrationCard
                    checked={twitchEnabled}
                    onCheckedChange={onTwitchToggle}
                    accentClassName="data-[state=checked]:border-[#9146FF] data-[state=checked]:bg-[#9146FF]"
                    iconNode={<TwitchIcon width="32" height="32" className="text-[#9146FF]" />}
                    label="Twitch"
                    sublabel={twitchLabel}
                />
                <SettingsIntegrationCard
                    checked={vkEnabled}
                    onCheckedChange={onVkToggle}
                    accentClassName="data-[state=checked]:border-[#FF4444] data-[state=checked]:bg-[#FF4444]"
                    iconNode={<VKIcon width="32" height="32" className="text-[#FF4444]" />}
                    label="VK Live"
                    sublabel={vkLabel}
                />
                <SettingsIntegrationCard
                    checked={daConnected}
                    disabled={daLoading || !hasMainIntegration}
                    onCheckedChange={onDonationAlertsToggle}
                    accentClassName="data-[state=checked]:border-orange-500 data-[state=checked]:bg-orange-500"
                    iconNode={<DonationAlertsIcon width="32" height="32" />}
                    label="DonationAlerts"
                    sublabel={daConnected ? 'Подключено' : 'Не подключено'}
                />
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Card className="card-glass flex flex-col gap-2 p-4">
                    <span className="text-sm text-muted-foreground">ID пользователя:</span>
                    <span className="text-lg font-mono font-semibold text-foreground">{userId}</span>
                </Card>

                <Card className="card-glass flex flex-col gap-3 border-red-500/30 bg-red-500/10 p-4">
                    <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                            <Trash2 className="h-5 w-5 flex-shrink-0 text-red-500" />
                            <span className="text-sm font-semibold text-red-500">Опасная зона</span>
                        </div>
                        <Button
                            variant="destructive"
                            size="sm"
                            onClick={onOpenDeleteModal}
                            className="h-8 bg-red-600 text-xs hover:bg-red-700"
                        >
                            Удалить аккаунт
                        </Button>
                    </div>
                    <div className="flex items-start gap-2">
                        <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-400/80" />
                        <p className="text-xs leading-relaxed text-red-400/80">
                            Необратимое действие. Удаление аккаунта приведет к полной потере данных.
                        </p>
                    </div>
                </Card>
            </div>

            <DeleteAccountModal isOpen={showDeleteModal} onClose={onCloseDeleteModal} />
        </div>
    </PageWrapper>
);

export default SettingsDashboard;
