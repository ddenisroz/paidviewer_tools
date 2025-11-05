// src/components/tts/TtsControlPanel.jsx
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { TwitchIcon, VKIcon } from '../PlatformIcons';
import { toast } from 'sonner';
import TtsChannelPointsMode from './TtsChannelPointsMode';

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
    
    return (
        <Card className="border-gray-700 bg-gray-900/50">
            <CardHeader>
                <CardTitle className="text-base font-semibold">Text to Speech</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Engine Selection */}
                <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-300">Engine</span>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setTtsEngine('cloud')}
                            className={`px-3 py-1.5 rounded text-xs font-medium transition-all ${
                                ttsEngine === 'cloud'
                                    ? 'bg-gray-700 text-white'
                                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                            }`}
                        >
                            Cloud
                        </button>
                        <button
                            onClick={() => setTtsEngine('local')}
                            disabled={!localTtsConfig?.configured || !isWhitelisted}
                            className={`px-3 py-1.5 rounded text-xs font-medium transition-all ${
                                !localTtsConfig?.configured || !isWhitelisted
                                    ? 'opacity-40 cursor-not-allowed bg-gray-800 text-gray-400'
                                    : ttsEngine === 'local'
                                        ? 'bg-gray-700 text-white'
                                        : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                            }`}
                        >
                            Local
                        </button>
                    </div>
                </div>

                {/* Mode Selection */}
                <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-300">Mode</span>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setBasicTtsEnabled(true)}
                            className={`px-3 py-1.5 rounded text-xs font-medium transition-all ${
                                basicTtsEnabled && !aiTtsEnabled
                                    ? 'bg-gray-700 text-white'
                                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
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
                            className={`px-3 py-1.5 rounded text-xs font-medium transition-all ${
                                !isHealthy || !canUseF5TTS
                                    ? 'opacity-40 cursor-not-allowed bg-gray-800 text-gray-400'
                                    : aiTtsEnabled
                                        ? 'bg-gray-700 text-white'
                                        : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                            }`}
                        >
                            F5-TTS
                        </button>
                    </div>
                </div>

                {/* Output */}
                {isAnyTtsEnabled && isAuthenticated && (
                    <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-300">Output</span>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setListeningMode('website')}
                                className={`px-3 py-1.5 rounded text-xs font-medium transition-all ${
                                    listeningMode === 'website'
                                        ? 'bg-gray-700 text-white'
                                        : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                                }`}
                            >
                                Website
                            </button>
                            <button
                                onClick={() => setListeningMode('obs')}
                                className={`px-3 py-1.5 rounded text-xs font-medium transition-all ${
                                    listeningMode === 'obs'
                                        ? 'bg-gray-700 text-white'
                                        : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                                }`}
                            >
                                OBS
                            </button>
                        </div>
                    </div>
                )}

                {/* OBS URL */}
                {listeningMode === 'obs' && isAnyTtsEnabled && (
                    <div className="flex items-center justify-between gap-2">
                        <span className="text-sm text-gray-300 truncate">URL</span>
                        <div className="flex gap-1">
                            {obsUrl ? (
                                <>
                                    <button
                                        onClick={() => {
                                            navigator.clipboard.writeText(obsUrl);
                                            toast.success('Copied');
                                        }}
                                        className="px-2 py-1 rounded bg-gray-800 hover:bg-gray-700 text-gray-400 text-xs font-medium"
                                    >
                                        Copy
                                    </button>
                                    <button
                                        onClick={onRegenerateObsUrl}
                                        className="px-2 py-1 rounded bg-gray-800 hover:bg-gray-700 text-gray-400 text-xs font-medium"
                                    >
                                        Refresh
                                    </button>
                                </>
                            ) : (
                                <span className="text-gray-500 text-xs">Generating...</span>
                            )}
                        </div>
                    </div>
                )}

                {/* Twitch */}
                {isAnyTtsEnabled && isAuthenticated && (
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <TwitchIcon className="w-4 h-4 text-gray-400" />
                            <span className="text-sm text-gray-300">Twitch</span>
                        </div>
                        <Switch
                            checked={isTwitchConnected && (platformSettings.enabled_platforms?.includes('twitch') || false)}
                            onCheckedChange={() => onPlatformToggle('twitch')}
                            disabled={!isTwitchConnected}
                            className="scale-90"
                        />
                    </div>
                )}

                {/* VK */}
                {isAnyTtsEnabled && isAuthenticated && (
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <VKIcon className="w-4 h-4 text-gray-400" />
                            <span className="text-sm text-gray-300">VK</span>
                        </div>
                        <Switch
                            checked={isVkConnected && (platformSettings.enabled_platforms?.includes('vk') || false)}
                            onCheckedChange={() => onPlatformToggle('vk')}
                            disabled={!isVkConnected}
                            className="scale-90"
                        />
                    </div>
                )}

                {/* Channel Points Mode */}
                {isAnyTtsEnabled && isAuthenticated && (
                    <TtsChannelPointsMode asSection={true} />
                )}
            </CardContent>
        </Card>
    );
};

export default TtsControlPanel;
