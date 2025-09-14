// src/pages/media/MediaMainPage.jsx
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Youtube, Coins, Settings } from 'lucide-react';
import { useIntegrations } from '../../hooks/useIntegrations';

const MediaFeatureCard = ({ title, icon, path, enabled, description }) => {
    const navigate = useNavigate();
    
    return (
        <Card 
            onClick={() => enabled && navigate(path)}
            className={`w-64 h-48 flex flex-col items-center justify-center text-center p-4 border-2 border-border/40 transition-all duration-300 hover:shadow-lg hover:-translate-y-1 ${enabled ? 'cursor-pointer hover:bg-muted hover:border-primary/60' : 'cursor-not-allowed bg-muted/50 opacity-50'}`}
        >
            <div className="flex flex-col items-center justify-center gap-4">
                {icon}
                <CardTitle className="text-base font-medium leading-tight">{title}</CardTitle>
                <p className="text-sm text-muted-foreground">{description}</p>
            </div>
        </Card>
    );
};

const MediaMainPage = () => {
    const { integrations } = useIntegrations();
    const navigate = useNavigate();
    
    // Проверяем доступность функций на основе интеграций
    const hasTwitchIntegration = integrations.twitch_enabled;
    const hasVkIntegration = integrations.vk_enabled;
    
    // Если ни одна интеграция не включена, показываем сообщение
    if (!hasTwitchIntegration && !hasVkIntegration) {
        return (
            <div className="flex flex-col items-center justify-center h-96 gap-4">
                <div className="text-center">
                    <h2 className="text-2xl font-bold text-foreground mb-2">
                        Интеграции отключены
                    </h2>
                    <p className="text-muted-foreground mb-6">
                        Включите интеграцию с Twitch или VK в настройках, чтобы использовать медиа функции
                    </p>
                    <Button 
                        className="flex items-center gap-2 mx-auto"
                        onClick={() => navigate('/dashboard/settings')}
                    >
                        <Settings className="h-4 w-4" />
                        Открыть настройки интеграций
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col items-center justify-start pt-12 gap-12">
            {/* Feature Cards */}
            <div className="flex justify-center gap-8">
                <MediaFeatureCard 
                    title="Youtube интеграция"
                    icon={<Youtube className="h-12 w-12 text-red-500" />}
                    path="/dashboard/media/youtube"
                    enabled={hasTwitchIntegration || hasVkIntegration}
                    description="Управление очередью видео"
                />
                <MediaFeatureCard 
                    title="Управление баллами канала"
                    icon={<Coins className="h-12 w-12 text-yellow-500" />}
                    path="/dashboard/media/channel-points"
                    enabled={hasTwitchIntegration || hasVkIntegration}
                    description="Настройка звуков для наград"
                />
            </div>
        </div>
    );
};

export default MediaMainPage;
