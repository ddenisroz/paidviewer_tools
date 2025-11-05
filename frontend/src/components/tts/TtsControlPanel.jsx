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
                <CardTitle className="text-base font-semibold">TTS Settings</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="space-y-6">
                    {/* Engine - 2 columns */}
                    <div>
                        <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Engine</label>
                        <div className="grid grid-cols-2 gap-2">
                            <button
                                onClick={() => setTtsEngine('cloud')}
                                className={`py-2 px-3 rounded text-xs font-medium transition-all ${
                                    ttsEngine === 'cloud'
                                        ? 'bg-gray-700 text-white'
                                        : 'bg-gray-800 text-gray-400 hover:bg-gray-750'
                                }`}
                            >
                                Cloud
                            </button>
                            <button
                                onClick={() => setTtsEngine('local')}
                                disabled={!localTtsConfig?.configured || !isWhitelisted}
                                className={`py-2 px-3 rounded text-xs font-medium transition-all ${
                                    !localTtsConfig?.configured || !isWhitelisted
                                        ? 'opacity-40 cursor-not-allowed bg-gray-800 text-gray-400'
                                        : ttsEngine === 'local'
                                            ? 'bg-gray-700 text-white'
                                            : 'bg-gray-800 text-gray-400 hover:bg-gray-750'
                                }`}
                            >
                                Local
                            </button>
                        </div>
                    </div>

                    {/* Mode - 2 columns */}
                    <div>
                        <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">TTS Mode</label>
                        <div className="grid grid-cols-2 gap-2">
                            <button
                                onClick={() => setBasicTtsEnabled(true)}
                                className={`py-2 px-3 rounded text-xs font-medium transition-all ${
                                    basicTtsEnabled && !aiTtsEnabled
                                        ? 'bg-gray-700 text-white'
                                        : 'bg-gray-800 text-gray-400 hover:bg-gray-750'
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
                                className={`py-2 px-3 rounded text-xs font-medium transition-all ${
                                    !isHealthy || !canUseF5TTS
                                        ? 'opacity-40 cursor-not-allowed bg-gray-800 text-gray-400'
                                        : aiTtsEnabled
                                            ? 'bg-gray-700 text-white'
                                            : 'bg-gray-800 text-gray-400 hover:bg-gray-750'
                                }`}
                            >
                                F5-TTS
                            </button>
                        </div>
                    </div>

                    {/* Output - 2 columns */}
                    {isAnyTtsEnabled && isAuthenticated && (
                        <div>
                            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Output</label>
                            <div className="grid grid-cols-2 gap-2">
                                <button
                                    onClick={() => setListeningMode('website')}
                                    className={`py-2 px-3 rounded text-xs font-medium transition-all ${
                                        listeningMode === 'website'
                                            ? 'bg-gray-700 text-white'
                                            : 'bg-gray-800 text-gray-400 hover:bg-gray-750'
                                    }`}
                                >
                                    Website
                                </button>
                                <button
                                    onClick={() => setListeningMode('obs')}
                                    className={`py-2 px-3 rounded text-xs font-medium transition-all ${
                                        listeningMode === 'obs'
                                            ? 'bg-gray-700 text-white'
                                            : 'bg-gray-800 text-gray-400 hover:bg-gray-750'
                                    }`}
                                >
                                    OBS
                                </button>
                            </div>
                        </div>
                    )}

                    {/* OBS URL */}
                    {listeningMode === 'obs' && isAnyTtsEnabled && (
                        <div>
                            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">OBS URL</label>
                            <div className="flex gap-1">
                                {obsUrl ? (
                                    <>
                                        <button
                                            onClick={() => {
                                                navigator.clipboard.writeText(obsUrl);
                                                toast.success('Copied');
                                            }}
                                            className="flex-1 py-2 px-2 rounded bg-gray-800 hover:bg-gray-750 text-gray-400 text-xs font-medium"
                                        >
                                            Copy
                                        </button>
                                        <button
                                            onClick={onRegenerateObsUrl}
                                            className="flex-1 py-2 px-2 rounded bg-gray-800 hover:bg-gray-750 text-gray-400 text-xs font-medium"
                                        >
                                            Refresh
                                        </button>
                                    </>
                                ) : (
                                    <span className="text-gray-500 text-xs py-2">Generating...</span>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Platforms - 2 columns */}
                    {isAnyTtsEnabled && isAuthenticated && (isTwitchConnected || isVkConnected) && (
                        <div>
                            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Platforms</label>
                            <div className="grid grid-cols-2 gap-2">
                                {isTwitchConnected && (
                                    <div className="flex items-center justify-between px-3 py-2 bg-gray-800/50 rounded">
                                        <TwitchIcon className="w-4 h-4 text-gray-400" />
                                        <Switch
                                            checked={platformSettings.enabled_platforms?.includes('twitch') || false}
                                            onCheckedChange={() => onPlatformToggle('twitch')}
                                            className="scale-75"
                                        />
                                    </div>
                                )}
                                {isVkConnected && (
                                    <div className="flex items-center justify-between px-3 py-2 bg-gray-800/50 rounded">
                                        <VKIcon className="w-4 h-4 text-gray-400" />
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
