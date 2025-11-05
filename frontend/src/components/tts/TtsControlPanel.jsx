// src/components/tts/TtsControlPanel.jsx
import React, { useState } from 'react';
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
        <div className="space-y-4">
            {/* Main TTS Toggle Card */}
            <Card className="border-gray-700 bg-gray-900/50">
                <CardHeader>
                    <CardTitle className="text-lg font-bold">Text to Speech</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    {/* Engine Selection */}
                    <div>
                        <label className="text-sm font-semibold text-gray-200 mb-2 block">Engine</label>
                        <div className="grid grid-cols-2 gap-2">
                            <button
                                onClick={() => setTtsEngine('cloud')}
                                className={`px-3 py-2 rounded-lg border text-sm font-medium transition-all ${
                                    ttsEngine === 'cloud'
                                        ? 'border-blue-500 bg-blue-500/15 text-blue-400'
                                        : 'border-gray-700 text-gray-400 hover:border-gray-600'
                                }`}
                            >
                                Cloud
                            </button>
                            <button
                                onClick={() => setTtsEngine('local')}
                                disabled={!localTtsConfig?.configured || !isWhitelisted}
                                className={`px-3 py-2 rounded-lg border text-sm font-medium transition-all ${
                                    !localTtsConfig?.configured || !isWhitelisted
                                        ? 'opacity-40 cursor-not-allowed border-gray-700 text-gray-500'
                                        : ttsEngine === 'local'
                                            ? 'border-purple-500 bg-purple-500/15 text-purple-400'
                                            : 'border-gray-700 text-gray-400 hover:border-gray-600'
                                }`}
                            >
                                Local
                            </button>
                        </div>
                    </div>

                    {/* TTS Modes */}
                    <div className="border-t border-gray-700 pt-4">
                        <label className="text-sm font-semibold text-gray-200 mb-3 block">Mode</label>
                        <div className="space-y-2">
                            <label className="flex items-center p-3 rounded-lg border border-gray-700 cursor-pointer hover:bg-gray-800/50 transition-colors">
                                <input
                                    type="radio"
                                    name="tts_mode"
                                    checked={basicTtsEnabled && !aiTtsEnabled}
                                    onChange={() => setBasicTtsEnabled(true)}
                                    className="w-4 h-4 accent-blue-500"
                                />
                                <span className="ml-3 text-sm font-medium text-gray-300">Google TTS</span>
                                <span className="ml-auto text-xs text-gray-500">Always works</span>
                            </label>

                            <label className={`flex items-center p-3 rounded-lg border transition-colors ${
                                !isHealthy || !canUseF5TTS
                                    ? 'opacity-40 cursor-not-allowed border-gray-700'
                                    : 'border-gray-700 cursor-pointer hover:bg-gray-800/50'
                            }`}>
                                <input
                                    type="radio"
                                    name="tts_mode"
                                    checked={aiTtsEnabled}
                                    onChange={() => {
                                        if (isHealthy && canUseF5TTS) {
                                            setAiTtsEnabled(true);
                                        }
                                    }}
                                    disabled={!isHealthy || !canUseF5TTS}
                                    className="w-4 h-4 accent-purple-500"
                                />
                                <span className="ml-3 text-sm font-medium text-gray-300">F5-TTS (AI)</span>
                                <span className="ml-auto text-xs text-gray-500">
                                    {!isHealthy ? 'Offline' : canUseF5TTS ? 'Ready' : 'Setup needed'}
                                </span>
                            </label>
                        </div>
                    </div>

                    {/* Output */}
                    {isAnyTtsEnabled && isAuthenticated && (
                        <div className="border-t border-gray-700 pt-4">
                            <label className="text-sm font-semibold text-gray-200 mb-3 block">Output</label>
                            <div className="grid grid-cols-2 gap-2">
                                <button
                                    onClick={() => setListeningMode('website')}
                                    className={`px-3 py-2 rounded-lg border text-sm font-medium transition-all ${
                                        listeningMode === 'website'
                                            ? 'border-green-500 bg-green-500/15 text-green-400'
                                            : 'border-gray-700 text-gray-400 hover:border-gray-600'
                                    }`}
                                >
                                    Website
                                </button>
                                <button
                                    onClick={() => setListeningMode('obs')}
                                    className={`px-3 py-2 rounded-lg border text-sm font-medium transition-all ${
                                        listeningMode === 'obs'
                                            ? 'border-green-500 bg-green-500/15 text-green-400'
                                            : 'border-gray-700 text-gray-400 hover:border-gray-600'
                                    }`}
                                >
                                    OBS
                                </button>
                            </div>
                        </div>
                    )}

                    {/* OBS URL */}
                    {listeningMode === 'obs' && isAnyTtsEnabled && (
                        <div className="bg-gray-800/50 p-2.5 rounded-lg space-y-1.5 border border-gray-700">
                            <div className="flex gap-1">
                                {obsUrl ? (
                                    <>
                                        <button
                                            onClick={() => {
                                                navigator.clipboard.writeText(obsUrl);
                                                toast.success('Copied');
                                            }}
                                            className="flex-1 px-2 py-1 rounded bg-blue-900/30 hover:bg-blue-900/50 text-blue-400 text-xs font-medium"
                                        >
                                            Copy
                                        </button>
                                        <button
                                            onClick={onRegenerateObsUrl}
                                            className="flex-1 px-2 py-1 rounded bg-gray-800 hover:bg-gray-700 text-gray-400 text-xs font-medium"
                                        >
                                            Refresh
                                        </button>
                                    </>
                                ) : (
                                    <span className="text-gray-500 text-xs py-1">Generating...</span>
                                )}
                            </div>
                            {obsUrl && (
                                <code className="block bg-gray-900 p-1 rounded border border-gray-700 text-green-400 overflow-auto break-all max-h-7 font-mono text-xs">
                                    {obsUrl.length > 50 ? `${obsUrl.substring(0, 47)}...` : obsUrl}
                                </code>
                            )}
                        </div>
                    )}

                    {/* Platforms */}
                    {isAnyTtsEnabled && isAuthenticated && (
                        <div className="border-t border-gray-700 pt-4">
                            <label className="text-sm font-semibold text-gray-200 mb-3 block">Platforms</label>
                            <div className="space-y-2">
                                <div className="flex items-center justify-between p-3 rounded-lg bg-gray-800/30 border border-gray-700">
                                    <div className="flex items-center gap-2">
                                        <TwitchIcon className="w-4 h-4" />
                                        <span className="text-sm font-medium text-gray-300">Twitch</span>
                                    </div>
                                    <Switch
                                        checked={isTwitchConnected && (platformSettings.enabled_platforms?.includes('twitch') || false)}
                                        onCheckedChange={() => onPlatformToggle('twitch')}
                                        disabled={!isTwitchConnected}
                                    />
                                </div>

                                <div className="flex items-center justify-between p-3 rounded-lg bg-gray-800/30 border border-gray-700">
                                    <div className="flex items-center gap-2">
                                        <VKIcon className="w-4 h-4" />
                                        <span className="text-sm font-medium text-gray-300">VK</span>
                                    </div>
                                    <Switch
                                        checked={isVkConnected && (platformSettings.enabled_platforms?.includes('vk') || false)}
                                        onCheckedChange={() => onPlatformToggle('vk')}
                                        disabled={!isVkConnected}
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Channel Points Mode */}
                    {isAnyTtsEnabled && isAuthenticated && (
                        <div className="border-t border-gray-700 pt-4">
                            <TtsChannelPointsMode asSection={true} />
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
};

export default TtsControlPanel;
