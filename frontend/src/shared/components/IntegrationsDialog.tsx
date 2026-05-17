// src/components/IntegrationsDialog.tsx
import React from 'react';

import { Gift, WarningCircle, X } from '@phosphor-icons/react';
import { useNavigate } from 'react-router-dom';

import { useDonationAlerts } from '@/context/DonationAlertsContext';
import { useIntegrations } from '@/context/IntegrationsContext';
import { TwitchIcon, VKIcon } from '@/shared/components/PlatformIcons';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/shared/components/ui/dialog';
import { Switch } from '@/shared/components/ui/switch';
import { logger } from '@/shared/utils/prodLogger';
import { toast } from '@/utils/toastManager';

interface IntegrationsDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

const IntegrationsDialog: React.FC<IntegrationsDialogProps> = ({ open, onOpenChange }) => {
    const navigate = useNavigate();
    const { integrations, platformRelease, isLoading, updateTwitchIntegration, updateVkIntegration } =
        useIntegrations();
    const {
        isConnected: daConnected,
        isLoading: daLoading,
        error: daError,
        connect: daConnect,
        disconnect: daDisconnect,
    } = useDonationAlerts();
    // Проверяем, есть ли хотя бы одна основная платформа
    const hasMainIntegration = integrations.twitch?.enabled || integrations.vk?.enabled;

    // ОБРАБОТЧИКИ для Twitch - такие же как в SettingsPage
    const handleTwitchToggle = async (newEnabled: boolean) => {
        try {
            if (newEnabled) {
                // Подключение - закрываем диалог и перенаправляем на OAuth
                onOpenChange(false);
            }
            await updateTwitchIntegration(newEnabled);
        } catch (error) {
            logger.error('Error toggling Twitch integration:', error);
        }
    };

    // ОБРАБОТЧИКИ для VK - такие же как в SettingsPage
    const handleVkToggle = async (newEnabled: boolean) => {
        try {
            if (newEnabled) {
                // Подключение - закрываем диалог и перенаправляем на OAuth
                onOpenChange(false);
            }
            await updateVkIntegration(newEnabled);
        } catch (error) {
            logger.error('Error toggling VK integration:', error);
        }
    };

    const handleDonationAlertsConnect = async () => {
        if (!hasMainIntegration) {
            toast.error('Сначала подключите хотя бы одну основную платформу (Twitch или VK Live)');
            return;
        }

        await daConnect();
    };

    const handleDonationAlertsDisconnect = async () => {
        await daDisconnect();
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                className="z-50"
                onPointerDownOutside={(e) => e.preventDefault()}
                onInteractOutside={(e) => e.preventDefault()}
                onClick={(e) => e.stopPropagation()}
            >
                <DialogHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <DialogTitle>Интеграции</DialogTitle>
                            <DialogDescription>Управление подключениями к платформам</DialogDescription>
                        </div>
                        <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)} className="h-6 w-6">
                            <X className="h-4 w-4" />
                        </Button>
                    </div>
                </DialogHeader>
                <div className="space-y-4">
                    {/* Twitch Integration */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                            <TwitchIcon />
                            <p className="font-semibold">Twitch</p>
                        </div>
                        <Switch
                            variant="twitch"
                            checked={integrations.twitch?.enabled || false}
                            onCheckedChange={handleTwitchToggle}
                            disabled={isLoading || integrations.twitch?.enabled === null}
                        />
                    </div>

                    {/* VK Live Integration */}
                    <div className="space-y-1">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                                <VKIcon className="text-[#FF4444]" />
                                <div className="flex items-center gap-2">
                                    <p className="font-semibold">VK Live</p>
                                    {platformRelease.vk.badgeLabel ? (
                                        <Badge
                                            variant="outline"
                                            className="border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300"
                                        >
                                            {platformRelease.vk.badgeLabel}
                                        </Badge>
                                    ) : null}
                                </div>
                            </div>
                            <Switch
                                variant="vk"
                                checked={integrations.vk?.enabled || false}
                                onCheckedChange={handleVkToggle}
                                disabled={isLoading || integrations.vk?.enabled === null}
                            />
                        </div>
                        {platformRelease.vk.helperText ? (
                            <p className="pl-7 text-xs text-muted-foreground">{platformRelease.vk.helperText}</p>
                        ) : null}
                    </div>

                    {/* Разделитель */}
                    <div className="border-t border-gray-200 dark:border-gray-700 my-4"></div>

                    {/* DonationAlerts Integration */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between py-2">
                            <div className="flex items-center space-x-2">
                                <img
                                    src="/images/logos/DA_Alert_Color.svg"
                                    alt="DonationAlerts"
                                    className="h-5 w-5"
                                    loading="lazy"
                                    decoding="async"
                                    onError={(e) => {
                                        const target = e.target as HTMLImageElement;
                                        target.style.display = 'none';
                                        const nextSibling = target.nextSibling as HTMLElement;
                                        if (nextSibling) {
                                            nextSibling.style.display = 'block';
                                        }
                                    }}
                                />
                                <Gift className="h-5 w-5 text-orange-500" style={{ display: 'none' }} />
                                <p className="font-semibold">DonationAlerts</p>
                            </div>
                            <div className="flex items-center">
                                <Switch
                                    variant="donation"
                                    checked={daConnected}
                                    onCheckedChange={
                                        daConnected ? handleDonationAlertsDisconnect : handleDonationAlertsConnect
                                    }
                                    disabled={daLoading || !hasMainIntegration}
                                />
                            </div>
                        </div>

                        {!hasMainIntegration && (
                            <div className="flex items-center space-x-2 p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded-md">
                                <WarningCircle className="w-4 h-4 text-yellow-600" />
                                <p className="text-sm text-yellow-700 dark:text-yellow-300">
                                    Подключите Twitch или VK Live для доступа к DonationAlerts
                                </p>
                            </div>
                        )}
                        {daError && (
                            <div className="flex items-center space-x-2 p-2 bg-red-50 dark:bg-red-900/20 rounded-md">
                                <WarningCircle className="w-4 h-4 text-red-600" />
                                <p className="text-sm text-red-700 dark:text-red-300">{daError}</p>
                            </div>
                        )}
                    </div>
                </div>
                <DialogFooter className="mt-4 flex justify-center">
                    <Button
                        variant="outline"
                        onClick={() => {
                            onOpenChange(false);
                            navigate('/dashboard/settings');
                        }}
                        className="w-full"
                    >
                        Перейти к полным настройкам
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default IntegrationsDialog;
