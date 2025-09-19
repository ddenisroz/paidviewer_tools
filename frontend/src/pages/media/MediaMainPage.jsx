// src/pages/media/MediaMainPage.jsx
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Youtube, Coins, Settings } from 'lucide-react';
import { useIntegrations } from '../../context/IntegrationsContext';

const MediaFeatureCard = ({ title, icon, path, enabled, description }) => {
    const navigate = useNavigate();
    
    return (
        <Card 
            onClick={() => enabled && navigate(path)}
            className={`w-80 h-56 flex flex-col items-center justify-center text-center p-6 border-2 transition-all duration-300
                ${enabled 
                    ? 'cursor-pointer hover:shadow-lg hover:-translate-y-1 hover:bg-muted/50 hover:border-primary/60 border-border/40' 
                    : 'cursor-not-allowed bg-muted/40 opacity-60 border-muted/30'
                }`
            }
        >
            <div className="flex flex-col items-center justify-center gap-4">
                {icon}
                <CardTitle className="text-xl font-bold leading-tight">{title}</CardTitle>
                <p className="text-base text-muted-foreground">{description}</p>
            </div>
        </Card>
    );
};

const MediaMainPage = () => {
    const { integrations } = useIntegrations();
    const navigate = useNavigate();
    
    const isFunctionEnabled = integrations.twitch?.enabled;

    if (!isFunctionEnabled) {
        return (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-center p-8">
                 <div className="text-8xl mb-4">😔</div>
                <h2 className="text-3xl font-bold text-foreground mb-2">
                    Интеграции отключены
                </h2>
                <p className="text-xl text-muted-foreground mb-6 max-w-lg">
                    Для доступа к этому разделу необходимо включить интеграцию с Twitch
                </p>
                <Button 
                    size="lg"
                    className="flex items-center gap-2"
                    onClick={() => navigate('/dashboard/settings')}
                >
                    <Settings className="h-5 w-5" />
                    Перейти в настройки
                </Button>
            </div>
        );
    }

    return (
        <div className="flex flex-col items-center justify-center flex-1 p-8">
            <div className="flex justify-center gap-8">
                <MediaFeatureCard 
                    title="Youtube интеграция"
                    icon={<Youtube className="h-16 w-16 text-red-500" />}
                    path="/dashboard/media/youtube"
                    enabled={isFunctionEnabled}
                    description="Управление очередью видео"
                />
                <MediaFeatureCard 
                    title="Управление баллами канала"
                    icon={<Coins className="h-16 w-16 text-yellow-500" />}
                    path="/dashboard/media/channel-points"
                    enabled={isFunctionEnabled}
                    description="Настройка звуков для наград"
                />
            </div>
        </div>
    );
};

export default MediaMainPage;
