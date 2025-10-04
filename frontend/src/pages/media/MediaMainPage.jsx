// src/pages/media/MediaMainPage.jsx
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Youtube, Coins, Settings, Gift, Dice6 } from 'lucide-react';
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
                <CardTitle className="text-3xl font-bold leading-tight">{title}</CardTitle>
                <p className="text-base text-muted-foreground">{description}</p>
            </div>
        </Card>
    );
};

const MediaMainPage = () => {
    const { integrations } = useIntegrations();
    const navigate = useNavigate();
    
    const isTwitchEnabled = integrations.twitch?.enabled;

    return (
        <div className="flex flex-col items-center justify-center flex-1 p-8">
            <div className="flex justify-center gap-8">
                <MediaFeatureCard 
                    title="Youtube интеграция"
                    icon={<Youtube className="h-16 w-16 text-red-500" />}
                    path="/dashboard/media/youtube"
                    enabled={true} // Всегда доступно
                    description="Управление очередью видео"
                />
                <MediaFeatureCard 
                    title="Баллы канала"
                    icon={<Coins className="h-16 w-16 text-yellow-500" />}
                    path="/dashboard/points"
                    enabled={isTwitchEnabled} // Только для Twitch
                    description="Управление наградами платформ"
                />
                <MediaFeatureCard 
                    title="Гэмблинг"
                    icon={<Dice6 className="h-16 w-16 text-purple-500" />}
                    path="/dashboard/gambling"
                    enabled={isTwitchEnabled} // Только для Twitch/VK
                    description="Мини-игры с донатами"
                />
            </div>
        </div>
    );
};

export default MediaMainPage;
