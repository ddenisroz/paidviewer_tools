// src/components/QuickActionsBar.jsx
import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Volume2, Zap, DollarSign } from 'lucide-react';
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

    const handleToggleTts = async () => {
        setLoading(true);
        try {
            const newState = !ttsEnabled;
            if (newState) {
                await botService.post('/api/tts/enable');
            } else {
                await botService.post('/api/tts/disable');
            }
            setTtsEnabled(newState);
            window.dispatchEvent(new CustomEvent('tts-status-changed', { 
                detail: { enabled: newState } 
            }));
        } catch (error) {
            toast.error('Ошибка');
            setTtsEnabled(!ttsEnabled);
        } finally {
            setLoading(false);
        }
    };

    if (!isAuthenticated) {
        return null;
    }

    return (
        <Card className="border-gray-700 bg-gray-900/30">
            <div className="flex items-center justify-between px-4 py-3 gap-4">
                {/* TTS Action Button */}
                <Button
                    onClick={handleToggleTts}
                    disabled={loading}
                    variant="ghost"
                    className={`flex items-center gap-2 h-9 px-3 rounded-lg transition-all border ${
                        ttsEnabled
                            ? 'border-green-500/50 bg-green-500/10 text-green-400 hover:bg-green-500/20'
                            : 'border-gray-600/50 bg-gray-800/30 text-gray-400 hover:bg-gray-800/50'
                    }`}
                >
                    <Volume2 className="w-4 h-4" />
                    <span className="text-xs font-semibold">Озвучка</span>
                </Button>

                {/* Divider */}
                <div className="w-px h-5 bg-gray-700/50" />

                {/* Navigation Buttons */}
                <div className="flex items-center gap-2">
                    <Button
                        onClick={() => navigate('/dashboard/tts')}
                        variant="ghost"
                        className="h-9 px-2.5 text-gray-400 hover:text-white text-xs font-medium"
                    >
                        Настройки
                    </Button>
                    <Button
                        onClick={() => navigate('/dashboard/drops?tab=streak')}
                        variant="ghost"
                        className="h-9 px-2.5 text-gray-400 hover:text-purple-400 flex items-center gap-1 text-xs font-medium"
                    >
                        <Zap className="w-3.5 h-3.5" />
                        Стрик
                    </Button>
                    <Button
                        onClick={() => navigate('/dashboard/drops?tab=donation')}
                        variant="ghost"
                        className="h-9 px-2.5 text-gray-400 hover:text-green-400 flex items-center gap-1 text-xs font-medium"
                    >
                        <DollarSign className="w-3.5 h-3.5" />
                        Донат
                    </Button>
                </div>
            </div>
        </Card>
    );
};

export default QuickActionsBar;
