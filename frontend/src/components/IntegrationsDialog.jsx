// src/components/IntegrationsDialog.jsx
import React from 'react';
import { Twitch, Video } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';
import { useIntegrations } from '../context/IntegrationsContext';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const IntegrationsDialog = ({ open, onOpenChange }) => {
    const { user, userMode } = useAuth();
    const { integrations, isLoading, updateTwitchIntegration, updateVkIntegration } = useIntegrations();
    const navigate = useNavigate();

    const isGuestMode = userMode === 'guest';

    const goToSettings = () => {
        onOpenChange(false); // Закрываем диалог
        navigate('/dashboard/settings');
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <span>Интеграции</span>
                    </DialogTitle>
                    <DialogDescription className="sr-only">
                        Быстрое включение и выключение интеграций
                    </DialogDescription>
                </DialogHeader>
                
                <div className="space-y-6 py-4">
                    {/* Twitch Integration */}
                    <div className="flex items-center justify-between">
                        <div className="space-y-1">
                            <Label htmlFor="twitch-integration" className="flex items-center gap-2 text-base font-medium cursor-pointer">
                                <Twitch className="h-5 w-5 text-purple-500" />
                                <span>Twitch</span>
                            </Label>
                            <p className="text-sm text-muted-foreground pl-7">
                                Управление стримом и чатом
                            </p>
                        </div>
                        <Switch
                            id="twitch-integration"
                            checked={!isGuestMode && integrations?.twitch?.enabled}
                            onCheckedChange={updateTwitchIntegration}
                            disabled={isLoading || !user}
                        />
                    </div>

                    {/* VK Integration */}
                    <div className="flex items-center justify-between">
                        <div className="space-y-1">
                            <Label htmlFor="vk-integration" className="flex items-center gap-2 text-base font-medium cursor-pointer">
                                <Video className="h-5 w-5 text-blue-500" />
                                <span>VK Live</span>
                            </Label>
                             <p className="text-sm text-muted-foreground pl-7">
                                Интеграция с VK Live
                            </p>
                        </div>
                        <Switch
                            id="vk-integration"
                            checked={!isGuestMode && integrations?.vk?.enabled}
                            onCheckedChange={updateVkIntegration}
                            disabled={isLoading}
                        />
                    </div>

                </div>

                <DialogFooter className="!mt-6 sm:justify-center items-center">
                    <Button 
                        variant="outline" 
                        className="w-full"
                        onClick={() => {
                            onOpenChange(false); // Закрываем диалог
                            navigate('/dashboard/settings'); // Переходим на страницу настроек
                        }}
                    >
                        Перейти к полным настройкам
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default IntegrationsDialog;
