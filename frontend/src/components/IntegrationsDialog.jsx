// src/components/IntegrationsDialog.jsx
import React from 'react';
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { useIntegrations } from '../context/IntegrationsContext';
import { useDonationAlerts } from '../context/DonationAlertsContext';
import { useAuth } from '../context/AuthContext';
import { TwitchIcon, VKIcon } from './PlatformIcons';
import { Gift, AlertCircle } from 'lucide-react';

const IntegrationsDialog = ({ open, onOpenChange }) => {
    const { integrations, loading, updateTwitchIntegration, updateVkIntegration } = useIntegrations();
    const { isConnected: daConnected, isLoading: daLoading, error: daError, connect: daConnect, disconnect: daDisconnect } = useDonationAlerts();
    const { loginWithTwitch, loginWithVk } = useAuth();

    // Проверяем, есть ли хотя бы одна основная интеграция
    const hasMainIntegration = integrations.twitch?.enabled || integrations.vk?.enabled;

    const handleToggle = (platform, isEnabled) => {
        if (platform === 'twitch') {
            updateTwitchIntegration(!isEnabled);
        } else if (platform === 'vk') {
            updateVkIntegration(!isEnabled);
        }
    };

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

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Интеграции</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                    {/* Twitch Integration */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                            <TwitchIcon />
                            <p className="font-semibold">Twitch</p>
                        </div>
                        <Switch
                            checked={integrations.twitch?.enabled || false}
                            onCheckedChange={() => handleToggle('twitch', integrations.twitch?.enabled)}
                            disabled={loading}
                        />
                    </div>
                    
                    {/* VK Live Integration */}
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                            <VKIcon />
                            <p className="font-semibold">VK Live</p>
                        </div>
                        <Switch
                            checked={integrations.vk?.enabled || false}
                            onCheckedChange={() => handleToggle('vk', integrations.vk?.enabled)}
                            disabled={loading}
                        />
                    </div>

                    {/* Разделитель */}
                    <div className="border-t border-gray-200 dark:border-gray-700 my-4"></div>

                    {/* DonationAlerts Integration */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                                <img 
                                    src="https://donationalerts.com/favicon.ico" 
                                    alt="DonationAlerts" 
                                    className="h-5 w-5"
                                />
                                <div>
                                    <p className="font-semibold">DonationAlerts</p>
                                    <p className="text-xs text-muted-foreground">
                                        {hasMainIntegration ? 'Доступно для подключения' : 'Требует основную интеграцию'}
                                    </p>
                                </div>
                            </div>
                            <Switch
                                checked={daConnected}
                                onCheckedChange={daConnected ? handleDonationAlertsDisconnect : handleDonationAlertsConnect}
                                disabled={daLoading || !hasMainIntegration}
                            />
                        </div>
                        
                        {!hasMainIntegration && (
                            <div className="flex items-center space-x-2 p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded-md">
                                <AlertCircle className="w-4 h-4 text-yellow-600" />
                                <p className="text-sm text-yellow-700 dark:text-yellow-300">
                                    Подключите Twitch или VK Live для доступа к DonationAlerts
                                </p>
                            </div>
                        )}
                        
                        {daError && (
                            <div className="flex items-center space-x-2 p-2 bg-red-50 dark:bg-red-900/20 rounded-md">
                                <AlertCircle className="w-4 h-4 text-red-600" />
                                <p className="text-sm text-red-700 dark:text-red-300">
                                    {daError}
                                </p>
                            </div>
                        )}
                    </div>
                </div>
                <DialogFooter className="mt-4 flex justify-center">
                    <Button 
                        variant="outline" 
                        onClick={() => {
                            onOpenChange(false);
                            window.location.href = '/dashboard/settings';
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
