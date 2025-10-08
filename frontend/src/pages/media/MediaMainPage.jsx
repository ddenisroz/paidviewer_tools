// src/pages/media/MediaMainPage.jsx
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Youtube, Coins, Settings, Gift } from 'lucide-react';
import { useIntegrations } from '../../context/IntegrationsContext';

const MediaFeatureCard = ({ title, icon, path, enabled, description }) => {
    const navigate = useNavigate();
    
    return (
        <div 
            onClick={() => enabled && navigate(path)}
            className={`
                w-64 h-72 
                bg-card border-2 border-border/40 
                rounded-xl 
                p-6
                flex flex-col
                cursor-pointer
                transition-all duration-200
                hover:shadow-lg hover:-translate-y-1 hover:border-primary/60
                ${!enabled ? 'opacity-60 cursor-not-allowed' : ''}
            `}
        >
            {/* Иконка */}
            <div className="flex justify-center mb-3">
                <div className="text-primary">
                    {React.cloneElement(icon, { size: 40 })}
                </div>
            </div>

            {/* Заголовок */}
            <div className="text-center mb-3">
                <h3 className="text-lg font-semibold text-foreground leading-tight">
                    {title}
                </h3>
            </div>

            {/* Описание */}
            <div className="text-center mb-4 flex-1 flex items-center justify-center">
                <p className="text-sm text-muted-foreground leading-relaxed">
                    {description}
                </p>
            </div>

            {/* Кнопка */}
            <div className="mt-auto">
                <div className="w-full h-10 bg-primary text-primary-foreground rounded-md flex items-center justify-center text-sm font-medium">
                    Перейти
                </div>
            </div>
        </div>
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
            </div>
        </div>
    );
};

export default MediaMainPage;
