// src/components/QuickActionsBar.jsx
import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Volume2, VolumeX, Zap, DollarSign } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useIntegrations } from '../context/IntegrationsContext';

const QuickActionsBar = () => {
    const navigate = useNavigate();
    const { isAuthenticated } = useAuth();
    const { integrations } = useIntegrations();
    const [ttsEnabled, setTtsEnabled] = useState(false);

    useEffect(() => {
        const handleTtsStatusChange = (event) => {
            setTtsEnabled(event.detail.enabled);
        };

        window.addEventListener('tts-status-changed', handleTtsStatusChange);
        return () => window.removeEventListener('tts-status-changed', handleTtsStatusChange);
    }, []);

    if (!isAuthenticated) {
        return null;
    }

    const isDropsEnabled = integrations.twitch?.enabled || integrations.vk?.enabled;

    return (
        <Card className="border-gray-700/50 bg-gradient-to-br from-gray-900/80 to-gray-800/50 backdrop-blur-sm">
            <div className="flex items-center justify-center gap-3 px-4 py-3">
                {/* TTS Button */}
                <Button
                    onClick={() => navigate('/dashboard/tts')}
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 ${
                        ttsEnabled
                            ? 'bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-700 hover:to-purple-600 text-white shadow-lg shadow-purple-600/30'
                            : 'bg-gray-700/50 hover:bg-gray-600/50 text-gray-300 border border-gray-600/50'
                    }`}
                >
                    {ttsEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                    Озвучка
                    {ttsEnabled && (
                        <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                    )}
                </Button>

                {/* Drops Buttons */}
                {isDropsEnabled && (
                    <>
                        <Button
                            onClick={() => navigate('/dashboard/drops?tab=streak')}
                            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-600/40 to-purple-500/40 hover:from-purple-600/60 hover:to-purple-500/60 text-purple-100 text-sm font-bold transition-all duration-300 border border-purple-500/30 shadow-lg shadow-purple-600/20"
                        >
                            <Zap className="w-4 h-4" />
                            Стрик
                        </Button>
                        <Button
                            onClick={() => navigate('/dashboard/drops?tab=donation')}
                            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-green-600/40 to-green-500/40 hover:from-green-600/60 hover:to-green-500/60 text-green-100 text-sm font-bold transition-all duration-300 border border-green-500/30 shadow-lg shadow-green-600/20"
                        >
                            <DollarSign className="w-4 h-4" />
                            Донат
                        </Button>
                    </>
                )}
            </div>
        </Card>
    );
};

export default QuickActionsBar;
