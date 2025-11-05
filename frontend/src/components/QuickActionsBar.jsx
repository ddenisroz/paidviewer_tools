// src/components/QuickActionsBar.jsx
import React, { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Settings, Zap, DollarSign, BarChart3 } from 'lucide-react';
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
            <div className="flex items-center justify-between px-4 py-2.5">
                {/* TTS Status - Left Side */}
                <div className="flex items-center gap-2.5 text-sm">
                    <span className="text-gray-500">Озвучка:</span>
                    <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full transition-colors ${ttsEnabled ? 'bg-green-500' : 'bg-gray-600'}`} />
                        <span className={`text-xs font-semibold ${ttsEnabled ? 'text-green-400' : 'text-gray-400'}`}>
                            {ttsEnabled ? 'ВКЛ' : 'ВЫКЛ'}
                        </span>
                    </div>
                </div>

                {/* Quick Action Buttons - Right Side */}
                <div className="flex items-center gap-1">
                    <Button
                        onClick={() => navigate('/dashboard/tts')}
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-gray-500 hover:text-purple-400 hover:bg-purple-500/10 rounded"
                        title="TTS Settings"
                    >
                        <Settings className="w-4 h-4" />
                    </Button>
                    <Button
                        onClick={() => navigate('/dashboard/drops?tab=streak')}
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-gray-500 hover:text-purple-400 hover:bg-purple-500/10 rounded"
                        title="Streak"
                    >
                        <Zap className="w-4 h-4" />
                    </Button>
                    <Button
                        onClick={() => navigate('/dashboard/drops?tab=donation')}
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-gray-500 hover:text-green-400 hover:bg-green-500/10 rounded"
                        title="Donation"
                    >
                        <DollarSign className="w-4 h-4" />
                    </Button>
                    <Button
                        onClick={() => navigate('/dashboard/admin?tab=stats')}
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-gray-500 hover:text-blue-400 hover:bg-blue-500/10 rounded"
                        title="Dashboard"
                    >
                        <BarChart3 className="w-4 h-4" />
                    </Button>
                </div>
            </div>
        </Card>
    );
};

export default QuickActionsBar;
