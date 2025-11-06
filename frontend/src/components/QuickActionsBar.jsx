// src/components/QuickActionsBar.jsx
import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Volume2, VolumeX, Zap, DollarSign } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useIntegrations } from '../context/IntegrationsContext';
import { useTts } from '../context/TtsContext';
import { botService } from '../services/microservices';
import { toast } from 'sonner';
import { logger } from '../utils/prodLogger';

const QuickActionsBar = () => {
    const { isAuthenticated, user, isGuest } = useAuth();
    const { integrations } = useIntegrations();
    const { ttsEnabled } = useTts();
    
    const [ttsState, setTtsState] = useState(false);
    const [streakEnabled, setStreakEnabled] = useState(false);
    const [donationEnabled, setDonationEnabled] = useState(false);
    const [isToggling, setIsToggling] = useState(false);

    // Get channel name from integrations
    const channelName = integrations.twitch?.username || integrations.vk?.username || user?.twitch_username || user?.vk_username || user?.username;
    const platform = integrations.twitch?.enabled ? 'twitch' : (integrations.vk?.enabled ? 'vk' : 'twitch');
    const isDropsEnabled = integrations.twitch?.enabled || integrations.vk?.enabled || (isGuest && user?.platform);
    const isDonationAlertsConnected = integrations.donationalerts?.enabled || false;

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
            // Load TTS state
            const ttsRes = await botService.get('/api/tts/status');
            const isEnabled = ttsRes.data?.basic_tts_enabled || ttsRes.data?.ai_tts_enabled || false;
            setTtsState(isEnabled);

            // Load Drops config
            if (isDropsEnabled && channelName) {
                const dropsRes = await botService.get(`/api/drops/config/${channelName}?platform=${platform}`);
                if (dropsRes.data?.success) {
                    setStreakEnabled(dropsRes.data.data?.streak_enabled || false);
                    setDonationEnabled(dropsRes.data.data?.donation_enabled || false);
                }
            }
        } catch (error) {
            logger.error('Error loading states:', error);
        }
    };

    const handleTtsToggle = async () => {
        if (isToggling) return;
        setIsToggling(true);
        try {
            const newState = !ttsState;
            if (newState) {
                await botService.post('/api/tts/enable');
                toast.success('Озвучка включена');
            } else {
                await botService.post('/api/tts/disable');
                toast.success('Озвучка отключена');
            }
            setTtsState(newState);
            window.dispatchEvent(new CustomEvent('tts-status-changed', { 
                detail: { enabled: newState } 
            }));
        } catch (error) {
            logger.error('Error toggling TTS:', error);
            toast.error('Ошибка переключения озвучки');
        } finally {
            setIsToggling(false);
        }
    };

    const handleStreakToggle = async () => {
        if (isToggling || !channelName) return;
        setIsToggling(true);
        try {
            const newState = !streakEnabled;
            await botService.put(`/api/drops/config/${channelName}?platform=${platform}`, {
                streak_enabled: newState
            });
            setStreakEnabled(newState);
            toast.success(newState ? 'Стрик включен' : 'Стрик отключен');
        } catch (error) {
            logger.error('Error toggling streak:', error);
            toast.error('Ошибка переключения стрика');
        } finally {
            setIsToggling(false);
        }
    };

    const handleDonationToggle = async () => {
        if (isToggling || !channelName) return;
        
        // Check DonationAlerts integration
        if (!isDonationAlertsConnected) {
            toast.error('Требуется подключение DonationAlerts');
            return;
        }
        
        setIsToggling(true);
        try {
            const newState = !donationEnabled;
            await botService.put(`/api/drops/config/${channelName}?platform=${platform}`, {
                donation_enabled: newState
            });
            setDonationEnabled(newState);
            toast.success(newState ? 'Донаты включены' : 'Донаты отключены');
        } catch (error) {
            logger.error('Error toggling donation:', error);
            toast.error('Ошибка переключения донатов');
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
                    className={`w-40 h-10 flex items-center justify-center gap-2 px-4 rounded-xl text-sm font-bold transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed ${
                        ttsState
                            ? 'bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-700 hover:to-purple-600 text-white shadow-lg shadow-purple-600/40'
                            : 'bg-gray-800/60 hover:bg-gray-700/60 text-gray-400 hover:text-gray-300 border border-gray-700/50'
                    }`}
                >
                    {ttsState ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                    <span>Озвучка</span>
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                        ttsState 
                            ? 'bg-white/20 text-white' 
                            : 'bg-gray-700/50 text-gray-500'
                    }`}>
                        {ttsState ? 'ВКЛ' : 'ВЫКЛ'}
                    </span>
                </button>

                {/* Streak Button - Fixed Width */}
                {isDropsEnabled && (
                    <button
                        onClick={handleStreakToggle}
                        disabled={isToggling || !channelName}
                        className={`w-40 h-10 flex items-center justify-center gap-2 px-4 rounded-xl text-sm font-bold transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed ${
                            streakEnabled
                                ? 'bg-gradient-to-r from-yellow-600 to-yellow-500 hover:from-yellow-700 hover:to-yellow-600 text-white shadow-lg shadow-yellow-600/40'
                                : 'bg-gray-800/60 hover:bg-gray-700/60 text-gray-400 hover:text-gray-300 border border-gray-700/50'
                        }`}
                    >
                        <Zap className="w-4 h-4" />
                        <span>Стрик</span>
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                            streakEnabled 
                                ? 'bg-white/20 text-white' 
                                : 'bg-gray-700/50 text-gray-500'
                        }`}>
                            {streakEnabled ? 'ВКЛ' : 'ВЫКЛ'}
                        </span>
                    </button>
                )}

                {/* Donation Button - Fixed Width */}
                {isDropsEnabled && (
                    <button
                        onClick={handleDonationToggle}
                        disabled={isToggling || !channelName || !isDonationAlertsConnected}
                        className={`w-40 h-10 flex items-center justify-center gap-2 px-4 rounded-xl text-sm font-bold transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed ${
                            !isDonationAlertsConnected
                                ? 'bg-gray-800/30 text-gray-600 border border-gray-700/30'
                                : donationEnabled
                                    ? 'bg-gradient-to-r from-green-600 to-green-500 hover:from-green-700 hover:to-green-600 text-white shadow-lg shadow-green-600/40'
                                    : 'bg-gray-800/60 hover:bg-gray-700/60 text-gray-400 hover:text-gray-300 border border-gray-700/50'
                        }`}
                    >
                        <DollarSign className="w-4 h-4" />
                        <span>Донаты</span>
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                            donationEnabled 
                                ? 'bg-white/20 text-white' 
                                : 'bg-gray-700/50 text-gray-500'
                        }`}>
                            {donationEnabled ? 'ВКЛ' : 'ВЫКЛ'}
                        </span>
                    </button>
                )}
            </div>
        </Card>
    );
};

export default QuickActionsBar;
