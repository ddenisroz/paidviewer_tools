// src/components/QuickActionsBar.jsx
import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Settings, Zap, DollarSign } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { botService } from '../services/microservices';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';

const QuickActionsBar = () => {
    const navigate = useNavigate();
    const { isAuthenticated } = useAuth();
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

    return (
        <Card className="border-gray-700 bg-gray-900/30">
            <div className="flex items-center justify-between px-4 py-3 gap-4">
                {/* TTS Status Indicator */}
                <div className="flex items-center gap-2">
                    <div className={`w-2.5 h-2.5 rounded-full ${ttsEnabled ? 'bg-green-500' : 'bg-gray-500'}`} />
                    <span className="text-xs font-semibold text-gray-300">
                        {ttsEnabled ? 'Озвучка активна' : 'Озвучка отключена'}
                    </span>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-1">
                    <Button
                        onClick={() => navigate('/dashboard/tts')}
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2 text-gray-400 hover:text-white"
                    >
                        <Settings className="w-4 h-4" />
                    </Button>
                    <Button
                        onClick={() => navigate('/dashboard/drops?tab=streak')}
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2 text-gray-400 hover:text-purple-400"
                    >
                        <Zap className="w-4 h-4" />
                    </Button>
                    <Button
                        onClick={() => navigate('/dashboard/drops?tab=donation')}
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2 text-gray-400 hover:text-green-400"
                    >
                        <DollarSign className="w-4 h-4" />
                    </Button>
                </div>
            </div>
        </Card>
    );
};

export default QuickActionsBar;
