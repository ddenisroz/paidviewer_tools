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
        <Card className="border-purple-500/30 bg-gradient-to-br from-purple-950/40 to-gray-900/40 shadow-lg shadow-purple-500/10">
            <CardHeader className="border-b border-purple-500/20 pb-4">
                <CardTitle className="text-lg font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-green-400">
                    Text to Speech
                </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
                <div className="space-y-6">
                    {/* Engine - 2 columns */}
                    <div>
                        <label className="block text-xs font-bold text-purple-300 uppercase tracking-wider mb-3">Engine</label>
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                onClick={() => setTtsEngine('cloud')}
                                className={`py-2.5 px-4 rounded-lg text-sm font-semibold transition-all duration-200 border ${
                                    ttsEngine === 'cloud'
                                        ? 'border-purple-400 bg-purple-500/20 text-purple-200 shadow-lg shadow-purple-500/30'
                                        : 'border-purple-500/30 bg-purple-900/20 text-gray-300 hover:border-purple-400/60 hover:bg-purple-900/40'
                                }`}
                            >
                                Cloud
                            </button>
                            <button
                                onClick={() => setTtsEngine('local')}
                                disabled={!localTtsConfig?.configured || !isWhitelisted}
                                className={`py-2.5 px-4 rounded-lg text-sm font-semibold transition-all duration-200 border ${
                                    !localTtsConfig?.configured || !isWhitelisted
                                        ? 'opacity-40 cursor-not-allowed border-gray-600 bg-gray-800/20 text-gray-500'
                                        : ttsEngine === 'local'
                                            ? 'border-green-400 bg-green-500/20 text-green-200 shadow-lg shadow-green-500/30'
                                            : 'border-green-500/30 bg-green-900/20 text-gray-300 hover:border-green-400/60 hover:bg-green-900/40'
                                }`}
                            >
                                Local
                            </button>
                        </div>
                    </div>

                    {/* Mode - 2 columns */}
                    <div>
                        <label className="block text-xs font-bold text-purple-300 uppercase tracking-wider mb-3">TTS Mode</label>
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                onClick={() => setBasicTtsEnabled(true)}
                                className={`py-2.5 px-4 rounded-lg text-sm font-semibold transition-all duration-200 border ${
                                    basicTtsEnabled && !aiTtsEnabled
                                        ? 'border-green-400 bg-green-500/20 text-green-200 shadow-lg shadow-green-500/30'
                                        : 'border-gray-600/50 bg-gray-800/30 text-gray-300 hover:border-green-400/40 hover:bg-gray-800/50'
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
                                className={`py-2.5 px-4 rounded-lg text-sm font-semibold transition-all duration-200 border ${
                                    !isHealthy || !canUseF5TTS
                                        ? 'opacity-40 cursor-not-allowed border-gray-600 bg-gray-800/20 text-gray-500'
                                        : aiTtsEnabled
                                            ? 'border-purple-400 bg-purple-500/20 text-purple-200 shadow-lg shadow-purple-500/30'
                                            : 'border-gray-600/50 bg-gray-800/30 text-gray-300 hover:border-purple-400/40 hover:bg-gray-800/50'
                                }`}
                            >
                                F5-TTS
                            </button>
                        </div>
                    </div>

                    {/* Output - 2 columns */}
                    {isAnyTtsEnabled && isAuthenticated && (
                        <div>
                            <label className="block text-xs font-bold text-purple-300 uppercase tracking-wider mb-3">Output</label>
                            <div className="grid grid-cols-2 gap-3">
                                <button
                                    onClick={() => setListeningMode('website')}
                                    className={`py-2.5 px-4 rounded-lg text-sm font-semibold transition-all duration-200 border ${
                                        listeningMode === 'website'
                                            ? 'border-purple-400 bg-purple-500/20 text-purple-200 shadow-lg shadow-purple-500/30'
                                            : 'border-gray-600/50 bg-gray-800/30 text-gray-300 hover:border-purple-400/40 hover:bg-gray-800/50'
                                    }`}
                                >
                                    Website
                                </button>
                                <button
                                    onClick={() => setListeningMode('obs')}
                                    className={`py-2.5 px-4 rounded-lg text-sm font-semibold transition-all duration-200 border ${
                                        listeningMode === 'obs'
                                            ? 'border-green-400 bg-green-500/20 text-green-200 shadow-lg shadow-green-500/30'
                                            : 'border-gray-600/50 bg-gray-800/30 text-gray-300 hover:border-green-400/40 hover:bg-gray-800/50'
                                    }`}
                                >
                                    OBS
                                </button>
                            </div>
                        </div>
                    )}

                    {/* OBS URL */}
                    {listeningMode === 'obs' && isAnyTtsEnabled && (
                        <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-3">
                            <label className="block text-xs font-bold text-green-300 uppercase tracking-wider mb-2">OBS URL</label>
                            <div className="flex gap-2">
                                {obsUrl ? (
                                    <>
                                        <button
                                            onClick={() => {
                                                navigator.clipboard.writeText(obsUrl);
                                                toast.success('Copied');
                                            }}
                                            className="flex-1 py-2 px-3 rounded bg-green-500/30 hover:bg-green-500/50 text-green-200 text-xs font-semibold transition-all border border-green-500/50"
                                        >
                                            Copy
                                        </button>
                                        <button
                                            onClick={onRegenerateObsUrl}
                                            className="flex-1 py-2 px-3 rounded bg-green-500/30 hover:bg-green-500/50 text-green-200 text-xs font-semibold transition-all border border-green-500/50"
                                        >
                                            Refresh
                                        </button>
                                    </>
                                ) : (
                                    <span className="text-green-400/70 text-xs py-2">Generating...</span>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Platforms - 2 columns */}
                    {isAnyTtsEnabled && isAuthenticated && (isTwitchConnected || isVkConnected) && (
                        <div>
                            <label className="block text-xs font-bold text-purple-300 uppercase tracking-wider mb-3">Platforms</label>
                            <div className="grid grid-cols-2 gap-3">
                                {isTwitchConnected && (
                                    <div className="flex items-center justify-between px-4 py-2.5 rounded-lg border border-purple-500/30 bg-purple-900/20 hover:bg-purple-900/40 transition-all">
                                        <div className="flex items-center gap-2">
                                            <TwitchIcon className="w-4 h-4 text-purple-300" />
                                            <span className="text-sm text-gray-300 font-semibold">Twitch</span>
                                        </div>
                                        <Switch
                                            checked={platformSettings.enabled_platforms?.includes('twitch') || false}
                                            onCheckedChange={() => onPlatformToggle('twitch')}
                                            className="scale-90"
                                        />
                                    </div>
                                )}
                                {isVkConnected && (
                                    <div className="flex items-center justify-between px-4 py-2.5 rounded-lg border border-green-500/30 bg-green-900/20 hover:bg-green-900/40 transition-all">
                                        <div className="flex items-center gap-2">
                                            <VKIcon className="w-4 h-4 text-green-300" />
                                            <span className="text-sm text-gray-300 font-semibold">VK</span>
                                        </div>
                                        <Switch
                                            checked={isVkConnected && (platformSettings.enabled_platforms?.includes('vk') || false)}
                                            onCheckedChange={() => onPlatformToggle('vk')}
                                            className="scale-90"
                                        />
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Channel Points Mode */}
                    {isAnyTtsEnabled && isAuthenticated && (
                        <TtsChannelPointsMode asSection={true} />
                    )}
                </div>
            </CardContent>
        </Card>
    );
};

export default TtsControlPanel;
