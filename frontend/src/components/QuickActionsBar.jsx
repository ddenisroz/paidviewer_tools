// src/components/QuickActionsBar.jsx
import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Volume2, VolumeX, Settings, Zap, DollarSign } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { botService } from '../services/microservices';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';

const QuickActionsBar = () => {
    const navigate = useNavigate();
    const { isAuthenticated } = useAuth();
    const [ttsEnabled, setTtsEnabled] = useState(false);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const handleTtsStatusChange = (event) => {
            setTtsEnabled(event.detail.enabled);
        };

        window.addEventListener('tts-status-changed', handleTtsStatusChange);
        return () => window.removeEventListener('tts-status-changed', handleTtsStatusChange);
    }, []);

    const handleToggleTts = async (checked) => {
        setLoading(true);
        try {
            if (checked) {
                await botService.post('/api/tts/enable');
            } else {
                await botService.post('/api/tts/disable');
            }
            setTtsEnabled(checked);
            window.dispatchEvent(new CustomEvent('tts-status-changed', { 
                detail: { enabled: checked } 
            }));
        } catch (error) {
            toast.error('Ошибка');
            setTtsEnabled(!checked);
        } finally {
            setLoading(false);
        }
    };

    if (!isAuthenticated) {
        return null;
    }

    return (
        <Card className="border-gray-700 bg-gray-900/30">
            <div className="flex items-center justify-between px-4 py-2.5 gap-4">
                {/* TTS Quick Control */}
                <div className="flex items-center gap-2">
                    {ttsEnabled ? (
                        <Volume2 className="w-4 h-4 text-purple-400" />
                    ) : (
                        <VolumeX className="w-4 h-4 text-gray-500" />
                    )}
                    <Switch
                        id="quick-tts-toggle"
                        checked={ttsEnabled}
                        onCheckedChange={handleToggleTts}
                        disabled={loading}
                        className="scale-90"
                    />
                    <span className="text-xs font-medium text-gray-400">
                        {ttsEnabled ? 'Озвучка' : 'Выкл'}
                    </span>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate('/dashboard/tts')}
                        className="h-6 px-1.5 text-gray-500 hover:text-white ml-0.5"
                    >
                        <Settings className="w-3.5 h-3.5" />
                    </Button>
                </div>

                {/* Divider */}
                <div className="w-px h-4 bg-gray-700/50" />

                {/* Quick Actions */}
                <div className="flex items-center gap-1">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate('/dashboard/drops?tab=streak')}
                        className="h-6 px-2 text-gray-500 hover:text-purple-400 flex items-center gap-1"
                    >
                        <Zap className="w-3.5 h-3.5" />
                        <span className="text-xs">Стрик</span>
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate('/dashboard/drops?tab=donation')}
                        className="h-6 px-2 text-gray-500 hover:text-green-400 flex items-center gap-1"
                    >
                        <DollarSign className="w-3.5 h-3.5" />
                        <span className="text-xs">Донат</span>
                    </Button>
                </div>
            </div>
        </Card>
    );
};

export default QuickActionsBar;

