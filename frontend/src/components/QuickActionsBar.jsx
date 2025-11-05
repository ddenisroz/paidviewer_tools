// src/components/QuickActionsBar.jsx
import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Volume2, VolumeX, Zap, DollarSign } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useIntegrations } from '../context/IntegrationsContext';
import { botService } from '../services/microservices';
import { toast } from 'sonner';

const QuickActionsBar = () => {
    const { isAuthenticated, user } = useAuth();
    const { integrations } = useIntegrations();
    const [ttsEnabled, setTtsEnabled] = useState(false);
    const [streakEnabled, setStreakEnabled] = useState(false);
    const [donationEnabled, setDonationEnabled] = useState(false);
    const [isTogglingTts, setIsTogglingTts] = useState(false);
    const [isTogglingStreak, setIsTogglingStreak] = useState(false);
    const [isTogglingDonation, setIsTogglingDonation] = useState(false);

    useEffect(() => {
        const handleTtsStatusChange = (event) => {
            setTtsEnabled(event.detail.enabled);
        };

        window.addEventListener('tts-status-changed', handleTtsStatusChange);
        return () => window.removeEventListener('tts-status-changed', handleTtsStatusChange);
    }, []);

    // Load initial states
    useEffect(() => {
        if (isAuthenticated) {
            loadStates();
        }
    }, [isAuthenticated]);

    const loadStates = async () => {
        try {
            // Load TTS status
            const ttsRes = await botService.get('/api/tts/status');
            setTtsEnabled(ttsRes.data?.basic_tts_enabled || ttsRes.data?.ai_tts_enabled || false);

            // Load Drops settings
            const dropsRes = await botService.get('/api/drops/settings');
            if (dropsRes.data) {
                setStreakEnabled(dropsRes.data.streak_enabled || false);
                setDonationEnabled(dropsRes.data.donation_enabled || false);
            }
        } catch (error) {
            console.error('Error loading states:', error);
        }
    };

    const handleTtsToggle = async () => {
        if (isTogglingTts) return;
        setIsTogglingTts(true);
        try {
            const newState = !ttsEnabled;
            if (newState) {
                await botService.post('/api/tts/enable');
                toast.success('Озвучка включена');
            } else {
                await botService.post('/api/tts/disable');
                toast.success('Озвучка отключена');
            }
            setTtsEnabled(newState);
            window.dispatchEvent(new CustomEvent('tts-status-changed', { 
                detail: { enabled: newState } 
            }));
        } catch (error) {
            toast.error('Ошибка переключения озвучки');
        } finally {
            setIsTogglingTts(false);
        }
    };

    const handleStreakToggle = async () => {
        if (isTogglingStreak) return;
        setIsTogglingStreak(true);
        try {
            const newState = !streakEnabled;
            await botService.post('/api/drops/settings', {
                streak_enabled: newState,
                donation_enabled: donationEnabled
            });
            setStreakEnabled(newState);
            toast.success(newState ? 'Стрик включён' : 'Стрик отключён');
        } catch (error) {
            toast.error('Ошибка переключения стрика');
        } finally {
            setIsTogglingStreak(false);
        }
    };

    const handleDonationToggle = async () => {
        if (isTogglingDonation) return;
        setIsTogglingDonation(true);
        try {
            const newState = !donationEnabled;
            await botService.post('/api/drops/settings', {
                streak_enabled: streakEnabled,
                donation_enabled: newState
            });
            setDonationEnabled(newState);
            toast.success(newState ? 'Донаты включены' : 'Донаты отключены');
        } catch (error) {
            toast.error('Ошибка переключения донатов');
        } finally {
            setIsTogglingDonation(false);
        }
    };

    if (!isAuthenticated) {
        return null;
    }

    const isDropsEnabled = integrations.twitch?.enabled || integrations.vk?.enabled;

    return (
        <Card className="border-gray-700/50 bg-gradient-to-br from-gray-900/90 to-gray-800/60 backdrop-blur-sm shadow-xl">
            <div className="flex items-center justify-center gap-3 px-6 py-3.5">
                {/* TTS Toggle */}
                <button
                    onClick={handleTtsToggle}
                    disabled={isTogglingTts}
                    className={`group relative flex items-center gap-2.5 px-6 py-3 rounded-xl text-sm font-bold transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed ${
                        ttsEnabled
                            ? 'bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-700 hover:to-purple-600 text-white shadow-lg shadow-purple-600/40 scale-100 hover:scale-105'
                            : 'bg-gray-800/60 hover:bg-gray-700/60 text-gray-400 hover:text-gray-300 border border-gray-700/50 hover:border-gray-600/50'
                    }`}
                >
                    <div className="relative">
                        {ttsEnabled ? (
                            <Volume2 className="w-5 h-5" />
                        ) : (
                            <VolumeX className="w-5 h-5" />
                        )}
                        {ttsEnabled && (
                            <div className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-green-400 animate-pulse shadow-lg shadow-green-400/50" />
                        )}
                    </div>
                    <span>Озвучка</span>
                    <div className={`text-xs font-semibold px-2 py-0.5 rounded-full transition-all ${
                        ttsEnabled 
                            ? 'bg-white/20 text-white' 
                            : 'bg-gray-700/50 text-gray-500'
                    }`}>
                        {ttsEnabled ? 'ВКЛ' : 'ВЫКЛ'}
                    </div>
                </button>

                {/* Drops Buttons */}
                {isDropsEnabled && (
                    <>
                        {/* Streak Toggle */}
                        <button
                            onClick={handleStreakToggle}
                            disabled={isTogglingStreak}
                            className={`group relative flex items-center gap-2.5 px-6 py-3 rounded-xl text-sm font-bold transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed ${
                                streakEnabled
                                    ? 'bg-gradient-to-r from-yellow-600 to-yellow-500 hover:from-yellow-700 hover:to-yellow-600 text-white shadow-lg shadow-yellow-600/40 scale-100 hover:scale-105'
                                    : 'bg-gray-800/60 hover:bg-gray-700/60 text-gray-400 hover:text-gray-300 border border-gray-700/50 hover:border-gray-600/50'
                            }`}
                        >
                            <div className="relative">
                                <Zap className={`w-5 h-5 ${streakEnabled ? '' : 'opacity-60'}`} />
                                {streakEnabled && (
                                    <div className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-orange-400 animate-pulse shadow-lg shadow-orange-400/50" />
                                )}
                            </div>
                            <span>Стрик</span>
                            <div className={`text-xs font-semibold px-2 py-0.5 rounded-full transition-all ${
                                streakEnabled 
                                    ? 'bg-white/20 text-white' 
                                    : 'bg-gray-700/50 text-gray-500'
                            }`}>
                                {streakEnabled ? 'ВКЛ' : 'ВЫКЛ'}
                            </div>
                        </button>

                        {/* Donation Toggle */}
                        <button
                            onClick={handleDonationToggle}
                            disabled={isTogglingDonation}
                            className={`group relative flex items-center gap-2.5 px-6 py-3 rounded-xl text-sm font-bold transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed ${
                                donationEnabled
                                    ? 'bg-gradient-to-r from-green-600 to-green-500 hover:from-green-700 hover:to-green-600 text-white shadow-lg shadow-green-600/40 scale-100 hover:scale-105'
                                    : 'bg-gray-800/60 hover:bg-gray-700/60 text-gray-400 hover:text-gray-300 border border-gray-700/50 hover:border-gray-600/50'
                            }`}
                        >
                            <div className="relative">
                                <DollarSign className={`w-5 h-5 ${donationEnabled ? '' : 'opacity-60'}`} />
                                {donationEnabled && (
                                    <div className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shadow-lg shadow-emerald-400/50" />
                                )}
                            </div>
                            <span>Донаты</span>
                            <div className={`text-xs font-semibold px-2 py-0.5 rounded-full transition-all ${
                                donationEnabled 
                                    ? 'bg-white/20 text-white' 
                                    : 'bg-gray-700/50 text-gray-500'
                            }`}>
                                {donationEnabled ? 'ВКЛ' : 'ВЫКЛ'}
                            </div>
                        </button>
                    </>
                )}
            </div>
        </Card>
    );
};

export default QuickActionsBar;
