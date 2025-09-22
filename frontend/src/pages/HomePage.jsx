// src/pages/HomePage.jsx
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mic, Clapperboard, Power, PowerOff, MessageSquare, Loader } from 'lucide-react';
import { useIntegrations } from '../context/IntegrationsContext';
import { useTts } from '../context/TtsContext';
import { useTtsHealth } from '../context/TtsHealthContext';
import { useTtsCard } from '../context/TtsCardContext';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { ToastProvider } from '../components/ui/toast';
import FeatureCard from '../components/FeatureCard';
import StreamStatsCard from '../components/StreamStatsCard';
import StreamTitleCard from '../components/StreamTitleCard';
import StreamCategoryCard from '../components/StreamCategoryCard';
import GuestStubs from '../components/GuestStubs';


const HomePageContent = () => {
    const navigate = useNavigate();
    const { user, isAuthenticated } = useAuth();
    const { integrations } = useIntegrations();
    const { ttsEnabled, toggleTts: onToggleTts, isToggling, syncWithHealthContext } = useTts();
    const { isHealthy, isChecking } = useTtsHealth();
    const { ttsCardStatus } = useTtsCard();
    const {
        streamTitle, setStreamTitle,
        streamCategory, setStreamCategory,
        categorySearch, setCategorySearch,
        categories, loadCategories,
        streamHistory,
        currentViewers,
        loading,
        status,
        updateStreamTitle,
        updateStreamCategory,
        loadStreamData
    } = useData();

    const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
    const prevIsHealthy = useRef(isHealthy);
    
    // Синхронизируем с TtsHealthContext
    useEffect(() => {
        if (prevIsHealthy.current !== isHealthy) {
            syncWithHealthContext(isHealthy);
            prevIsHealthy.current = isHealthy;
        }
    }, [isHealthy, syncWithHealthContext]);
    
    const handleCategorySearch = async (value) => {
        setCategorySearch(value);
        setShowCategoryDropdown(true);

        if (value.length === 0) {
            setStreamCategory('');
            await loadCategories();
        } else if (value.length > 2) {
            await loadCategories(value);
        }
    };
    
    const preparedStreamHistory = useMemo(() => {
        if (!streamHistory || streamHistory.length < 1) return [];

        // Сортируем на случай, если данные приходят не по порядку
        const sortedHistory = [...streamHistory].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

        const startTime = new Date(sortedHistory[0].timestamp).getTime();
        if (isNaN(startTime)) return []; // Защита от невалидной даты

        return sortedHistory
            .filter(d => d.viewers >= 0)
            .map(d => {
                const currentTime = new Date(d.timestamp).getTime();
                if (isNaN(currentTime)) return null; // Пропускаем невалидные точки

                const diffSeconds = Math.round((currentTime - startTime) / 1000);
                const minutes = Math.floor(diffSeconds / 60).toString().padStart(2, '0');
                const seconds = (diffSeconds % 60).toString().padStart(2, '0');
                
                return {
                    ...d,
                    time: `${minutes}:${seconds}`,
                };
            }).filter(Boolean); // Убираем null значения
    }, [streamHistory]);

    const handleUpdateTitle = async () => {
        await updateStreamTitle(streamTitle);
    };

    const handleUpdateCategory = async () => {
        await updateStreamCategory(streamCategory);
    };
    
    return (
        <div className="space-y-8">
            <div className="flex justify-center">
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    <FeatureCard 
                        title="TTS ИИ озвучка" 
                        icon={<Mic />} 
                        path="/dashboard/tts"
                        enabled={true}
                        ttsStatus={ttsCardStatus}
                        actionButton={{
                            text: isToggling ? 'Обработка...' : (ttsEnabled ? 'Выключить озвучку' : 'Включить озвучку'),
                            icon: isToggling ? <Loader className="h-4 w-4 animate-spin" /> : (ttsEnabled ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />),
                            variant: ttsEnabled ? "destructive" : "default",
                            disabled: isToggling
                        }}
                        onActionClick={onToggleTts}
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
                {/* Заглушка для гостей */}
                {!isAuthenticated ? (
                    <GuestStubs />
                ) : (
                    <>
                        <StreamStatsCard 
                            integrations={integrations}
                            currentViewers={currentViewers}
                            streamHistory={streamHistory}
                            preparedStreamHistory={preparedStreamHistory}
                            loading={loading}
                        />
                        
                        <StreamTitleCard 
                            integrations={integrations}
                            streamTitle={streamTitle}
                            setStreamTitle={setStreamTitle}
                            status={status}
                            updateStreamTitle={handleUpdateTitle}
                        />
                        
                        <StreamCategoryCard 
                            integrations={integrations}
                            streamCategory={streamCategory}
                            setStreamCategory={setStreamCategory}
                            categorySearch={categorySearch}
                            setCategorySearch={setCategorySearch}
                            categories={categories}
                            loadCategories={loadCategories}
                            status={status}
                            updateStreamCategory={handleUpdateCategory}
                            showCategoryDropdown={showCategoryDropdown}
                            setShowCategoryDropdown={setShowCategoryDropdown}
                        />
                    </>
                )}
            </div>
        </div>
    );
};

const HomePage = () => {
    return (
        <ToastProvider>
            <HomePageContent />
        </ToastProvider>
    );
};

export default HomePage;
