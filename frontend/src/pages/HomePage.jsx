// src/pages/HomePage.jsx
import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mic, Clapperboard, Power, PowerOff, MessageSquare, Loader } from 'lucide-react';
import { useIntegrations } from '../context/IntegrationsContext';
import { useTts } from '../context/TtsContext';
import { useTtsCard } from '../context/TtsCardContext';
import { useTtsHealth } from '../context/TtsHealthContext';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import FeatureCard from '../components/FeatureCard';
import StreamStatsCard from '../components/StreamStatsCard';
import StreamTitleCard from '../components/StreamTitleCard';
import StreamCategoryCard from '../components/StreamCategoryCard';
import GuestStubs from '../components/GuestStubs';
import IntegrationsDisabledPlaceholder from '../components/IntegrationsDisabledPlaceholder';



const HomePage = () => {
    const navigate = useNavigate();
    const { isAuthenticated } = useAuth();
    const { integrations } = useIntegrations();
    const { ttsEnabled, toggleTts: onToggleTts, isToggling } = useTts();
    const { ttsCardStatus } = useTtsCard();
    const { isHealthy: ttsHealthy, isChecking: ttsChecking } = useTtsHealth();
    const { streamHistory, loading } = useData();


    // Определяем, какую кнопку показывать для TTS
    const getTtsActionButton = () => {
        if (isToggling) {
            return {
                text: 'Обработка...',
                icon: <Loader className="h-4 w-4 animate-spin" />,
                variant: "secondary",
                disabled: true
            };
        }
        
        if (!ttsHealthy) {
            // Если TTS недоступен, не показываем кнопку
            return null;
        }
        
        return {
            text: ttsEnabled ? 'Выключить озвучку' : 'Включить озвучку',
            icon: ttsEnabled ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />,
            variant: ttsEnabled ? "destructive" : "default",
            disabled: false
        };
    };

    // Обработчик клика для TTS кнопки
    const handleTtsActionClick = () => {
        // Переключаем состояние TTS
        onToggleTts();
    };

    const preparedStreamHistory = useMemo(() => {
        if (!streamHistory || !Array.isArray(streamHistory) || streamHistory.length < 1) {
            return [];
        }
        const sortedHistory = [...streamHistory].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        const startTime = new Date(sortedHistory[0].timestamp).getTime();
        if (isNaN(startTime)) return [];
        return sortedHistory
            .filter(d => d.viewers >= 0)
            .map(d => {
                const currentTime = new Date(d.timestamp).getTime();
                if (isNaN(currentTime)) return null;
                const diffSeconds = Math.round((currentTime - startTime) / 1000);
                const minutes = Math.floor(diffSeconds / 60).toString().padStart(2, '0');
                const seconds = (diffSeconds % 60).toString().padStart(2, '0');
                return { ...d, time: `${minutes}:${seconds}` };
            }).filter(Boolean);
    }, [streamHistory]);

    const preparedVkStreamHistory = useMemo(() => {
        if (!streamHistory?.vk_history || !Array.isArray(streamHistory.vk_history) || streamHistory.vk_history.length < 1) {
            return [];
        }
        const sortedHistory = [...streamHistory.vk_history].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
        const startTime = new Date(sortedHistory[0].timestamp).getTime();
        if (isNaN(startTime)) return [];
        return sortedHistory
            .filter(d => d.viewers >= 0)
            .map(d => {
                const currentTime = new Date(d.timestamp).getTime();
                if (isNaN(currentTime)) return null;
                const diffSeconds = Math.round((currentTime - startTime) / 1000);
                const minutes = Math.floor(diffSeconds / 60).toString().padStart(2, '0');
                const seconds = (diffSeconds % 60).toString().padStart(2, '0');
                return { ...d, time: `${minutes}:${seconds}`};
            }).filter(Boolean);
    }, [streamHistory]);
    
    return (
        <div className="space-y-8 pb-20">
            <div className="flex justify-center">
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    <FeatureCard 
                        title="TTS ИИ озвучка" 
                        icon={<Mic />} 
                        path="/dashboard/tts"
                        enabled={true}
                        ttsStatus={{ isHealthy: ttsHealthy, isChecking: ttsChecking }}
                        actionButton={getTtsActionButton()}
                        onActionClick={handleTtsActionClick}
                    />
                    <FeatureCard 
                        title="Медиа интерактивность" 
                        icon={<Clapperboard />} 
                        path="/dashboard/media"
                        enabled={true}
                        actionButton={{ text: 'Перейти' }}
                        onActionClick={() => navigate('/dashboard/media')}
                    />
                    <FeatureCard 
                        title="Анализ и модерация чата" 
                        icon={<MessageSquare />} 
                        path="/dashboard/chat-analysis"
                        enabled={true}
                        actionButton={{ text: 'Перейти' }}
                        onActionClick={() => navigate('/dashboard/chat-analysis')}
                    />
                </div>
            </div>
            
            <div className="grid gap-6 lg:grid-cols-3">
                {!isAuthenticated ? (
                    <GuestStubs />
                ) : !integrations.twitch.enabled && !integrations.vk.enabled ? (
                    <IntegrationsDisabledPlaceholder />
                ) : (
                    <>
                        <StreamStatsCard 
                            integrations={integrations}
                            currentViewers={streamHistory?.current_viewers || 0}
                            streamHistory={Array.isArray(streamHistory?.history) ? streamHistory.history : []}
                            preparedStreamHistory={preparedStreamHistory}
                            loading={loading}
                            vkViewers={streamHistory?.current_vk_viewers || 0}
                            vkStreamHistory={streamHistory?.vk_history || []}
                            preparedVkStreamHistory={preparedVkStreamHistory}
                            peakInfo={streamHistory?.peak_info}
                            peakViewers={streamHistory?.peak_viewers || 0}
                            avgViewers={streamHistory?.avg_viewers || 0}
                            categories={streamHistory?.categories || []}
                        />
                        
                        <StreamTitleCard />
                        
                        <StreamCategoryCard />
                    </>
                )}
            </div>
        </div>
    );
};

export default HomePage;
