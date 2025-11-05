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
        <Card className="border-gray-700 bg-gray-900/30">
            <div className="flex items-center justify-center px-4 py-3 gap-4">
                {/* TTS Toggle */}
                <Button
                    onClick={() => navigate('/dashboard/tts')}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors duration-200 ${
                        ttsEnabled
                            ? 'bg-purple-600 hover:bg-purple-700 text-white'
                            : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                    }`}
                >
                    {ttsEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                    Озвучка
                </Button>

                {/* Drops Buttons */}
                {isDropsEnabled && (
                    <>
                        <Button
                            onClick={() => navigate('/dashboard/drops?tab=streak')}
                            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-600/40 hover:bg-purple-600/60 text-purple-200 text-sm font-semibold transition-colors"
                        >
                            <Zap className="w-4 h-4" />
                            Стрик
                        </Button>
                        <Button
                            onClick={() => navigate('/dashboard/drops?tab=donation')}
                            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-green-600/40 hover:bg-green-600/60 text-green-200 text-sm font-semibold transition-colors"
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
