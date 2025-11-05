// src/components/tts/TtsControlPanel.jsx
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { TwitchIcon, VKIcon } from '../PlatformIcons';
import { toast } from 'sonner';

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

            {/* Compact Grid Layout */}
            <Card className="border-gray-700 bg-gray-900/30">
                <CardContent className="pt-4 pb-3">
                    <div className="space-y-2">
                        {/* Row 1: Engine, Mode, Output in one line */}
                        <div className="grid grid-cols-3 gap-2">
                            {/* Engine */}
                            <div className="space-y-1">
                                <div className="text-xs font-semibold text-gray-400">Движок</div>
                                <div className="flex gap-1">
                                    <button
                                        onClick={() => setTtsEngine('cloud')}
                                        className={`flex-1 py-1 px-2 rounded text-xs font-semibold transition-all border ${
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
                                        className={`flex-1 py-1 px-2 rounded text-xs font-semibold transition-all border ${
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

                            {/* Mode */}
                            <div className="space-y-1">
                                <div className="text-xs font-semibold text-gray-400">Режим</div>
                                <div className="flex gap-1">
                                    <button
                                        onClick={() => setBasicTtsEnabled(true)}
                                        className={`flex-1 py-1 px-2 rounded text-xs font-semibold transition-all border ${
                                            basicTtsEnabled && !aiTtsEnabled
                                                ? 'border-green-400 bg-green-500/20 text-green-200'
                                                : 'border-gray-700/50 bg-gray-800/20 text-gray-400'
                                        }`}
                                    >
                                        Google
                                    </button>
                                    <button
                                        onClick={() => {
                                            if (isHealthy && canUseF5TTS) {
                                                setAiTtsEnabled(true);
                                            }
                                        }}
                                        disabled={!isHealthy || !canUseF5TTS}
                                        className={`flex-1 py-1 px-2 rounded text-xs font-semibold transition-all border ${
                                            !isHealthy || !canUseF5TTS
                                                ? 'opacity-40 cursor-not-allowed border-gray-700 bg-gray-800/20 text-gray-500'
                                                : aiTtsEnabled
                                                    ? 'border-purple-400 bg-purple-500/20 text-purple-200'
                                                    : 'border-gray-700/50 bg-gray-800/20 text-gray-400'
                                        }`}
                                    >
                                        F5
                                    </button>
                                </div>
                            </div>

                            {/* Output */}
                            <div className="space-y-1">
                                <div className="text-xs font-semibold text-gray-400">Вывод</div>
                                <div className="flex gap-1">
                                    <button
                                        onClick={() => setListeningMode('website')}
                                        className={`flex-1 py-1 px-2 rounded text-xs font-semibold transition-all border ${
                                            listeningMode === 'website'
                                                ? 'border-purple-400 bg-purple-500/20 text-purple-200'
                                                : 'border-gray-700/50 bg-gray-800/20 text-gray-400'
                                        }`}
                                    >
                                        Web
                                    </button>
                                    <button
                                        onClick={() => setListeningMode('obs')}
                                        className={`flex-1 py-1 px-2 rounded text-xs font-semibold transition-all border ${
                                            listeningMode === 'obs'
                                                ? 'border-green-400 bg-green-500/20 text-green-200'
                                                : 'border-gray-700/50 bg-gray-800/20 text-gray-400'
                                        }`}
                                    >
                                        OBS
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Row 2: OBS URL if needed */}
                        {listeningMode === 'obs' && (
                            <div className="flex gap-1 text-xs">
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

                        {/* Row 3: Platforms */}
                        {isAuthenticated && (isTwitchConnected || isVkConnected) && (
                            <div className="flex gap-2 text-xs">
                                {isTwitchConnected && (
                                    <div className="flex items-center gap-1 flex-1 px-2 py-1 rounded border border-gray-700/50 bg-gray-800/20">
                                        <TwitchIcon className="w-3 h-3 text-purple-300" />
                                        <span className="text-gray-300 font-semibold flex-1">Twitch</span>
                                        <Switch
                                            checked={platformSettings.enabled_platforms?.includes('twitch') || false}
                                            onCheckedChange={() => onPlatformToggle('twitch')}
                                            className="scale-75"
                                        />
                                    </div>
                                )}
                                {isVkConnected && (
                                    <div className="flex items-center gap-1 flex-1 px-2 py-1 rounded border border-gray-700/50 bg-gray-800/20">
                                        <VKIcon className="w-3 h-3 text-green-300" />
                                        <span className="text-gray-300 font-semibold flex-1">VK</span>
                                        <Switch
                                            checked={isVkConnected && (platformSettings.enabled_platforms?.includes('vk') || false)}
                                            onCheckedChange={() => onPlatformToggle('vk')}
                                            className="scale-75"
                                        />
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>
        </>
    );
};

export default TtsControlPanel;
