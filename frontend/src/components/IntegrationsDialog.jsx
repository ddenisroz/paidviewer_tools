// src/components/IntegrationsDialog.jsx
import React from 'react';
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { useIntegrations } from '../context/IntegrationsContext';
import { useAuth } from '../context/AuthContext';
import { TwitchIcon, VKIcon } from './PlatformIcons';

const IntegrationsDialog = ({ open, onOpenChange }) => {
    const { integrations, loading, updateTwitchIntegration, updateVkIntegration } = useIntegrations();
    const { loginWithTwitch, loginWithVk } = useAuth();

    const handleToggle = (platform, isEnabled) => {
        if (platform === 'twitch') {
            updateTwitchIntegration(!isEnabled);
        } else if (platform === 'vk') {
            updateVkIntegration(!isEnabled);
        }
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
