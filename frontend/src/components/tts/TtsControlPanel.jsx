// src/components/tts/TtsControlPanel.jsx
import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { TwitchIcon, VKIcon } from '../PlatformIcons';
import { toast } from 'sonner';
import { botService } from '../../services/microservices';

const TtsControlPanel = ({
    basicTtsEnabled,
    setBasicTtsEnabled,
    aiTtsEnabled,
    setAiTtsEnabled,
    isHealthy,
    isAuthenticated,
    isConnected,
    isWhitelisted,
    engineToggleLoading,
    listeningMode,
    setListeningMode,
    obsUrl,
    onRegenerateObsUrl,
    platformSettings,
    integrations,
    onPlatformToggle,
    user,
    isGuest,
    ttsEngine,
    setTtsEngine,
    localTtsConfig
}) => {
    const isTwitchConnected = integrations.twitch?.enabled || (isGuest && user?.platform === 'twitch');
    const isVkConnected = integrations.vk?.enabled || (isGuest && user?.platform === 'vk');
    const hasLocalSetup = localStorage.getItem('tts_has_local_setup') === 'true';
    const canUseF5TTS = hasLocalSetup || isWhitelisted === true;
    const isAnyTtsEnabled = basicTtsEnabled || aiTtsEnabled;

    const [ttsTriggerMode, setTtsTriggerMode] = useState('all_messages'); // 'all_messages' или 'channel_points'
    const [isLoadingMode, setIsLoadingMode] = useState(false);

    // Load TTS trigger mode on mount
    useEffect(() => {
        if (isAuthenticated) {
            loadTtsModeSettings();
        }
    }, [isAuthenticated]);

    const loadTtsModeSettings = async () => {
        try {
            const response = await botService.get('/api/tts/mode');
            if (response.data?.tts_mode) {
                setTtsTriggerMode(response.data.tts_mode);
            }
        } catch (error) {
            console.error('Error loading TTS mode:', error);
        }
    };

    const handleTtsModeChange = async (mode) => {
        setIsLoadingMode(true);
        try {
            const response = await botService.post('/api/tts/mode', { tts_mode: mode });
            setTtsTriggerMode(mode);
            toast.success(response.data?.message || 'Mode updated');
        } catch (error) {
            console.error('Error changing TTS mode:', error);
            toast.error('Failed to change TTS mode');
        } finally {
            setIsLoadingMode(false);
        }
    };

    const handleGlobalTtsToggle = () => {
        const newState = !isAnyTtsEnabled;
        if (newState) {
            setBasicTtsEnabled(true);
            window.dispatchEvent(new CustomEvent('tts-status-changed', { 
                detail: { enabled: true, mode: 'basic' } 
            }));
        } else {
            setBasicTtsEnabled(false);
            setAiTtsEnabled(false);
            window.dispatchEvent(new CustomEvent('tts-status-changed', { 
                detail: { enabled: false } 
            }));
        }
    };

    if (!isAnyTtsEnabled) {
        return (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-700 bg-gray-800/30 w-fit">
                <Switch
                    checked={false}
                    onCheckedChange={handleGlobalTtsToggle}
                    className="scale-90"
                />
                <span className="text-xs font-semibold text-white">Озвучка</span>
            </div>
        );
    }
    
    return (
        <>
            {/* Compact Toggle */}
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-700 bg-gray-800/30 w-fit">
                <Switch
                    checked={true}
                    onCheckedChange={handleGlobalTtsToggle}
                    className="scale-90"
                />
                <span className="text-xs font-semibold text-white">Озвучка</span>
            </div>

            {/* Main Settings Card */}
            <Card className="border-gray-700 bg-gray-900/30">
                <CardContent className="pt-4 pb-3">
                    <div className="space-y-4">
                        {/* Section 1: Trigger Mode */}
                        <div className="space-y-2">
                            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Режим включения</div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => handleTtsModeChange('all_messages')}
                                    disabled={isLoadingMode}
                                    className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold transition-all border ${
                                        ttsTriggerMode === 'all_messages'
                                            ? 'border-purple-400 bg-purple-500/20 text-purple-200'
                                            : 'border-gray-700/50 bg-gray-800/20 text-gray-400 hover:border-purple-400/40'
                                    }`}
                                >
                                    Все сообщения
                                </button>
                                <button
                                    onClick={() => handleTtsModeChange('channel_points')}
                                    disabled={isLoadingMode || !isTwitchConnected}
                                    className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold transition-all border ${
                                        !isTwitchConnected
                                            ? 'opacity-40 cursor-not-allowed border-gray-700 bg-gray-800/20 text-gray-500'
                                            : ttsTriggerMode === 'channel_points'
                                                ? 'border-green-400 bg-green-500/20 text-green-200'
                                                : 'border-gray-700/50 bg-gray-800/20 text-gray-400 hover:border-green-400/40'
                                    }`}
                                >
                                    За баллы канала
                                </button>
                            </div>
                        </div>

                        {/* Section 2: Engine & Mode */}
                        <div className="space-y-2 pt-2 border-t border-gray-700/30">
                            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Звуковой движок</div>
                            <div className="grid grid-cols-2 gap-2">
                                <button
                                    onClick={() => setTtsEngine('cloud')}
                                    className={`py-2 px-3 rounded text-xs font-semibold transition-all border ${
                                        ttsEngine === 'cloud'
                                            ? 'border-purple-400 bg-purple-500/20 text-purple-200'
                                            : 'border-gray-700/50 bg-gray-800/20 text-gray-400'
                                    }`}
                                >
                                    Cloud
                                </button>
                                <button
                                    onClick={() => setTtsEngine('local')}
                                    disabled={!localTtsConfig?.configured || !isWhitelisted}
                                    className={`py-2 px-3 rounded text-xs font-semibold transition-all border ${
                                        !localTtsConfig?.configured || !isWhitelisted
                                            ? 'opacity-40 cursor-not-allowed border-gray-700 bg-gray-800/20 text-gray-500'
                                            : ttsEngine === 'local'
                                                ? 'border-green-400 bg-green-500/20 text-green-200'
                                                : 'border-gray-700/50 bg-gray-800/20 text-gray-400'
                                    }`}
                                >
                                    Local
                                </button>
                            </div>
                        </div>

                        {/* Section 3: Algorithm Selection */}
                        <div className="space-y-2 pt-2 border-t border-gray-700/30">
                            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Алгоритм озвучки</div>
                            <div className="grid grid-cols-2 gap-2">
                                <button
                                    onClick={() => setBasicTtsEnabled(true)}
                                    className={`py-2 px-3 rounded text-xs font-semibold transition-all border ${
                                        basicTtsEnabled && !aiTtsEnabled
                                            ? 'border-green-400 bg-green-500/20 text-green-200'
                                            : 'border-gray-700/50 bg-gray-800/20 text-gray-400'
                                    }`}
                                >
                                    Google TTS
                                </button>
                                <button
                                    onClick={() => setAiTtsEnabled(true)}
                                    disabled={!isHealthy || !canUseF5TTS}
                                    className={`py-2 px-3 rounded text-xs font-semibold transition-all border ${
                                        !isHealthy || !canUseF5TTS
                                            ? 'opacity-40 cursor-not-allowed border-gray-700 bg-gray-800/20 text-gray-500'
                                            : aiTtsEnabled
                                                ? 'border-purple-400 bg-purple-500/20 text-purple-200'
                                                : 'border-gray-700/50 bg-gray-800/20 text-gray-400'
                                    }`}
                                >
                                    F5-TTS (ИИ)
                                </button>
                            </div>
                        </div>

                        {/* Section 4: Output Mode */}
                        <div className="space-y-2 pt-2 border-t border-gray-700/30">
                            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Вывод звука</div>
                            <div className="grid grid-cols-2 gap-2">
                                <button
                                    onClick={() => setListeningMode('website')}
                                    className={`py-2 px-3 rounded text-xs font-semibold transition-all border ${
                                        listeningMode === 'website'
                                            ? 'border-purple-400 bg-purple-500/20 text-purple-200'
                                            : 'border-gray-700/50 bg-gray-800/20 text-gray-400'
                                    }`}
                                >
                                    Сайт
                                </button>
                                <button
                                    onClick={() => setListeningMode('obs')}
                                    className={`py-2 px-3 rounded text-xs font-semibold transition-all border ${
                                        listeningMode === 'obs'
                                            ? 'border-green-400 bg-green-500/20 text-green-200'
                                            : 'border-gray-700/50 bg-gray-800/20 text-gray-400'
                                    }`}
                                >
                                    OBS
                                </button>
                            </div>
                            {listeningMode === 'obs' && (
                                <div className="flex gap-1 text-xs mt-2">
                                    <button
                                        onClick={() => {
                                            navigator.clipboard.writeText(obsUrl);
                                            toast.success('Скопировано');
                                        }}
                                        className="flex-1 py-1 px-2 rounded bg-green-500/20 hover:bg-green-500/30 text-green-300 border border-green-500/40 font-semibold"
                                    >
                                        Copy URL
                                    </button>
                                    <button
                                        onClick={onRegenerateObsUrl}
                                        className="flex-1 py-1 px-2 rounded bg-green-500/20 hover:bg-green-500/30 text-green-300 border border-green-500/40 font-semibold"
                                    >
                                        Refresh
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Section 5: Platforms */}
                        {isAuthenticated && (isTwitchConnected || isVkConnected) && (
                            <div className="space-y-2 pt-2 border-t border-gray-700/30">
                                <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Платформы</div>
                                <div className="space-y-1">
                                    {isTwitchConnected && (
                                        <div className="flex items-center justify-between p-2 rounded border border-gray-700/50 bg-gray-800/20">
                                            <div className="flex items-center gap-2">
                                                <TwitchIcon className="w-3.5 h-3.5 text-purple-300" />
                                                <span className="text-xs text-gray-300 font-semibold">Twitch</span>
                                            </div>
                                            <Switch
                                                checked={platformSettings.enabled_platforms?.includes('twitch') || false}
                                                onCheckedChange={() => onPlatformToggle('twitch')}
                                                className="scale-75"
                                            />
                                        </div>
                                    )}
                                    {isVkConnected && (
                                        <div className="flex items-center justify-between p-2 rounded border border-gray-700/50 bg-gray-800/20">
                                            <div className="flex items-center gap-2">
                                                <VKIcon className="w-3.5 h-3.5 text-green-300" />
                                                <span className="text-xs text-gray-300 font-semibold">VK</span>
                                            </div>
                                            <Switch
                                                checked={isVkConnected && (platformSettings.enabled_platforms?.includes('vk') || false)}
                                                onCheckedChange={() => onPlatformToggle('vk')}
                                                className="scale-75"
                                            />
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>
        </>
    );
};

export default TtsControlPanel;
