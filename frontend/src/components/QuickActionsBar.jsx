// src/components/QuickActionsBar.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Volume2, VolumeX, Zap, DollarSign } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useIntegrations } from '../context/IntegrationsContext';
import { useTts } from '../context/TtsContext';
import { useDonationAlerts } from '../context/DonationAlertsContext';
import { botService } from '../services/microservices';
import { toast } from 'sonner';
import { logger } from '../utils/prodLogger';

const QuickActionsBar = () => {
    const navigate = useNavigate();
    const { isAuthenticated, user, isGuest } = useAuth();
    const { integrations } = useIntegrations();
    const { ttsEnabled } = useTts();
    const { isConnected: daConnected, connect: daConnect } = useDonationAlerts();
    
    const [ttsState, setTtsState] = useState(false);
    const [streakEnabled, setStreakEnabled] = useState(false);
    const [donationEnabled, setDonationEnabled] = useState(false);
    const [mythicalEnabled, setMythicalEnabled] = useState(false);
    const [isToggling, setIsToggling] = useState(false);
    const [hasRewards, setHasRewards] = useState(false); // Track if rewards are configured

    // Get channel name from integrations
    const channelName = integrations.twitch?.username || integrations.vk?.username || user?.twitch_username || user?.vk_username || user?.username;
    const platform = integrations.twitch?.enabled ? 'twitch' : (integrations.vk?.enabled ? 'vk' : 'twitch');
    const isDropsEnabled = integrations.twitch?.enabled || integrations.vk?.enabled || (isGuest && user?.platform);
    const isDonationAlertsConnected = integrations?.donationalerts?.enabled || daConnected || false;

    // Load initial states from backend
    useEffect(() => {
        if (isAuthenticated && channelName) {
            loadStates();
        }
    }, [isAuthenticated, channelName]);

    // Listen to TTS status changes
    useEffect(() => {
        const handleTtsStatusChange = (event) => {
            setTtsState(event.detail.enabled);
        };

        window.addEventListener('tts-status-changed', handleTtsStatusChange);
        return () => window.removeEventListener('tts-status-changed', handleTtsStatusChange);
    }, []);

    const loadStates = async () => {
        try {
            // Load TTS state - SYNC WITH TTS MAIN PAGE LOGIC
            const ttsRes = await botService.get('/api/tts/status');
            // TTS enabled if: enabled=true AND (engine is gtts, cloud, or local)
            const enabled = ttsRes.data?.enabled || false;
            const engineType = ttsRes.data?.engine_type || 'gtts';
            // TTS is ON if enabled and has any valid engine
            const isTtsOn = enabled && ['gtts', 'cloud', 'local'].includes(engineType);
            setTtsState(isTtsOn);

            // Load Drops config
            if (isDropsEnabled && channelName) {
                const dropsRes = await botService.get(`/api/drops/config/${channelName}?platform=${platform}`);
                if (dropsRes.data?.success) {
                    setStreakEnabled(dropsRes.data.data?.streak_enabled || false);
                    setDonationEnabled(dropsRes.data.data?.donation_enabled || false);
                    setMythicalEnabled(dropsRes.data.data?.mythical_enabled || false);
                }

                // Load rewards to check if any exist
                try {
                    const rewardsRes = await botService.get(`/api/drops/rewards/${channelName}?platform=${platform}`);
                    if (rewardsRes.data?.success) {
                        const rewards = rewardsRes.data.data || [];
                        setHasRewards(rewards.length > 0);
                    }
                } catch (error) {
                    logger.error('Error loading rewards:', error);
                    setHasRewards(false);
                }
            }
        } catch (error) {
            logger.error('Error loading states:', error);
        }
    };

    const handleTtsToggle = async () => {
        if (isToggling) return;
        setIsToggling(true);
        // Optimistic update
        const previousState = ttsState;
        setTtsState(!ttsState);
        
        try {
            const newState = !previousState;
            if (newState) {
                await botService.post('/api/tts/enable');
                toast.success('Озвучка включена');
            } else {
                await botService.post('/api/tts/disable');
                toast.success('Озвучка отключена');
            }
            window.dispatchEvent(new CustomEvent('tts-status-changed', { 
                detail: { enabled: newState } 
            }));
        } catch (error) {
            logger.error('Error toggling TTS:', error);
            toast.error('Ошибка переключения озвучки');
            // Rollback on error
            setTtsState(previousState);
        } finally {
            setIsToggling(false);
        }
    };

    const handleStreakToggle = async () => {
        if (isToggling || !channelName) return;
        
        // IMPORTANT: Check if rewards exist before enabling streak
        if (!streakEnabled && !hasRewards) {
            toast.error('Сначала настройте содержимое сундуков на вкладке "Награды"', {
                description: 'Перейдите в Drops → Награды',
                duration: 4000
            });
            return;
        }
        
        setIsToggling(true);
        // Optimistic update
        const previousState = streakEnabled;
        setStreakEnabled(!streakEnabled);
        
        try {
            const newState = !previousState;
            await botService.put(`/api/drops/config/${channelName}?platform=${platform}`, {
                streak_enabled: newState
            });
            toast.success(newState ? 'Стрик включен' : 'Стрик отключен');
            // Dispatch event to sync with DropsMainPage
            window.dispatchEvent(new CustomEvent('drops-config-changed', {
                detail: { streak_enabled: newState, channel: channelName, platform }
            }));
        } catch (error) {
            logger.error('Error toggling streak:', error);
            toast.error('Ошибка переключения стрика');
            // Rollback on error
            setStreakEnabled(previousState);
        } finally {
            setIsToggling(false);
        }
    };

    const handleDonationToggle = async () => {
        if (isToggling || !channelName) return;
        
        // IMPORTANT: Check DonationAlerts integration before enabling
        if (!donationEnabled && !isDonationAlertsConnected) {
            toast.error('Требуется подключение DonationAlerts', {
                description: 'Перенаправление на страницу настроек...',
                duration: 2000
            });
            // Перенаправляем на страницу настроек для подключения DonationAlerts
            setTimeout(() => {
                navigate('/dashboard/settings');
            }, 500);
            return;
        }
        
        // IMPORTANT: Check if rewards exist before enabling
        if (!donationEnabled && !hasRewards) {
            toast.error('Сначала настройте содержимое сундуков на вкладке "Награды"', {
                description: 'Перейдите в Drops → Награды',
                duration: 4000
            });
            return;
        }
        
        setIsToggling(true);
        // Optimistic update
        const previousState = donationEnabled;
        setDonationEnabled(!donationEnabled);
        
        try {
            const newState = !previousState;
            await botService.put(`/api/drops/config/${channelName}?platform=${platform}`, {
                donation_enabled: newState
            });
            toast.success(newState ? 'Донаты включены' : 'Донаты отключены');
            // Dispatch event to sync with DropsMainPage
            window.dispatchEvent(new CustomEvent('drops-config-changed', {
                detail: { donation_enabled: newState, channel: channelName, platform }
            }));
        } catch (error) {
            logger.error('Error toggling donation:', error);
            toast.error('Ошибка переключения донатов');
            // Rollback on error
            setDonationEnabled(previousState);
        } finally {
            setIsToggling(false);
        }
    };

    if (!isAuthenticated) {
        return null;
    }

    return (
        <Card className="border-gray-700/50 bg-gradient-to-br from-gray-900/90 to-gray-800/60 backdrop-blur-sm shadow-xl">
            <div className="flex items-center justify-center gap-2 px-6 py-3.5">
                {/* TTS Button - Fixed Width */}
                <button
                    onClick={handleTtsToggle}
                    disabled={isToggling}
                    className={`w-40 h-10 flex items-center justify-center gap-1.5 px-3 rounded-xl text-sm font-bold transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap ${
                        ttsState
                            ? 'bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-700 hover:to-purple-600 text-white shadow-lg shadow-purple-600/40'
                            : 'bg-gray-800/60 hover:bg-gray-700/60 text-gray-400 hover:text-gray-300 border border-gray-700/50'
                    }`}
                >
                    {ttsState ? <Volume2 className="w-4 h-4 flex-shrink-0" /> : <VolumeX className="w-4 h-4 flex-shrink-0" />}
                    <span className="truncate">TTS чата</span>
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0 ${
                        ttsState 
                            ? 'bg-white/20 text-white' 
                            : 'bg-gray-700/50 text-gray-500'
                    }`}>
                        {ttsState ? 'ON' : 'OFF'}
                    </span>
                </button>

                {/* Streak Button - Fixed Width */}
                {isDropsEnabled && (
                    <button
                        onClick={handleStreakToggle}
                        disabled={isToggling || !channelName}
                        className={`w-40 h-10 flex items-center justify-center gap-1.5 px-3 rounded-xl text-sm font-bold transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap ${
                            streakEnabled
                                ? 'bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-700 hover:to-orange-600 text-white shadow-lg shadow-orange-600/40'
                                : 'bg-gray-800/60 hover:bg-gray-700/60 text-gray-400 hover:text-gray-300 border border-gray-700/50'
                        }`}
                    >
                        <Zap className="w-4 h-4 flex-shrink-0" />
                        <span className="truncate">Стрик drops</span>
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0 ${
                            streakEnabled 
                                ? 'bg-white/20 text-white' 
                                : 'bg-gray-700/50 text-gray-500'
                        }`}>
                            {streakEnabled ? 'ON' : 'OFF'}
                        </span>
                    </button>
                )}

                {/* Donation Button - Fixed Width */}
                {isDropsEnabled && (
                    <button
                        onClick={handleDonationToggle}
                        disabled={isToggling || !channelName || !isDonationAlertsConnected}
                        className={`w-40 h-10 flex items-center justify-center gap-1.5 px-3 rounded-xl text-sm font-bold transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap ${
                            !isDonationAlertsConnected
                                ? 'bg-gray-800/30 text-gray-600 border border-gray-700/30'
                                : donationEnabled
                                    ? 'bg-gradient-to-r from-green-600 to-green-500 hover:from-green-700 hover:to-green-600 text-white shadow-lg shadow-green-600/40'
                                    : 'bg-gray-800/60 hover:bg-gray-700/60 text-gray-400 hover:text-gray-300 border border-gray-700/50'
                        }`}
                    >
                        <DollarSign className="w-4 h-4 flex-shrink-0" />
                        <span className="truncate">Donate drops</span>
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0 ${
                            donationEnabled 
                                ? 'bg-white/20 text-white' 
                                : 'bg-gray-700/50 text-gray-500'
                        }`}>
                            {donationEnabled ? 'ON' : 'OFF'}
                        </span>
                    </button>
                )}
            </div>
        </Card>
    );
};

export default QuickActionsBar;
