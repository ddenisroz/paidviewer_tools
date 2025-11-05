// src/components/tts/TtsControlPanel.jsx
import React from 'react';
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
    isGuest
}) => {
    const isTwitchConnected = integrations.twitch?.enabled || (isGuest && user?.platform === 'twitch');
    const isVkConnected = integrations.vk?.enabled || (isGuest && user?.platform === 'vk');
    const hasLocalSetup = localStorage.getItem('tts_has_local_setup') === 'true';
    const canUseF5TTS = hasLocalSetup || isWhitelisted === true;
    const isAnyTtsEnabled = basicTtsEnabled || aiTtsEnabled;
    
    const handleGlobalTtsToggle = (enabled) => {
        if (enabled) {
            if (!basicTtsEnabled && !aiTtsEnabled) {
                setBasicTtsEnabled(true);
            }
        } else {
            setBasicTtsEnabled(false);
            setAiTtsEnabled(false);
        }
    };
    
    return (
        <div className="space-y-3 bg-gray-800/20 p-3 rounded-lg border border-gray-700/50">
            {/* On/Off switch */}
            <div className="flex items-center justify-between">
                <div className="flex-1">
                    <h3 className="text-sm font-semibold text-white">Text to Speech</h3>
                    <p className="text-xs text-gray-400 mt-0.5">
                        {isAnyTtsEnabled ? (aiTtsEnabled ? '🤖 AI TTS' : '🔊 Google TTS') : '⏸️ Off'}
                    </p>
                </div>
                <Switch
                    checked={isAnyTtsEnabled}
                    onCheckedChange={handleGlobalTtsToggle}
                    disabled={!isAuthenticated || !isConnected}
                    className="scale-90"
                />
            </div>

            {/* Mode selection - if enabled */}
            {isAnyTtsEnabled && isAuthenticated && (
                <div className="grid grid-cols-2 gap-2">
                    {/* Google TTS */}
                    <button
                        onClick={() => {
                            setBasicTtsEnabled(true);
                            setAiTtsEnabled(false);
                        }}
                        className={`px-2.5 py-2 rounded-lg border text-xs font-medium transition-all ${
                            basicTtsEnabled && !aiTtsEnabled
                                ? 'border-blue-500/50 bg-blue-500/10 text-blue-400'
                                : 'border-gray-700 hover:border-gray-600 text-gray-400'
                        }`}
                    >
                        🔊 Google
                    </button>

                    {/* F5-TTS */}
                    <button
                        onClick={() => {
                            if (isHealthy && canUseF5TTS) {
                                setAiTtsEnabled(true);
                                setBasicTtsEnabled(false);
                            }
                        }}
                        disabled={!isHealthy || !canUseF5TTS || engineToggleLoading}
                        className={`px-2.5 py-2 rounded-lg border text-xs font-medium transition-all ${
                            !isHealthy || !canUseF5TTS
                                ? 'opacity-40 cursor-not-allowed'
                                : aiTtsEnabled
                                    ? 'border-purple-500/50 bg-purple-500/10 text-purple-400'
                                    : 'border-gray-700 hover:border-gray-600 text-gray-400'
                        }`}
                    >
                        🤖 F5-TTS
                    </button>
                </div>
            )}

            {/* Listening mode */}
            {isAuthenticated && isConnected && isAnyTtsEnabled && (
                <div className="grid grid-cols-2 gap-2">
                    <button
                        onClick={() => setListeningMode('website')}
                        className={`px-2.5 py-2 rounded-lg border text-xs font-medium transition-all ${
                            listeningMode === 'website'
                                ? 'border-green-500/50 bg-green-500/10 text-green-400'
                                : 'border-gray-700 hover:border-gray-600 text-gray-400'
                        }`}
                    >
                        🌐 Website
                    </button>
                    <button
                        onClick={() => setListeningMode('obs')}
                        className={`px-2.5 py-2 rounded-lg border text-xs font-medium transition-all ${
                            listeningMode === 'obs'
                                ? 'border-green-500/50 bg-green-500/10 text-green-400'
                                : 'border-gray-700 hover:border-gray-600 text-gray-400'
                        }`}
                    >
                        📡 OBS
                    </button>
                </div>
            )}

            {/* OBS URL */}
            {listeningMode === 'obs' && isAnyTtsEnabled && (
                <div className="p-2 bg-gray-900/50 rounded-lg border border-gray-700 space-y-1">
                    <div className="flex gap-1">
                        {obsUrl && typeof obsUrl === 'string' ? (
                            <>
                                <button
                                    onClick={() => {
                                        navigator.clipboard.writeText(obsUrl);
                                        toast.success('Copied');
                                    }}
                                    className="flex-1 px-2 py-1 rounded bg-blue-900/30 hover:bg-blue-900/50 text-blue-400 text-xs font-medium transition"
                                >
                                    Copy
                                </button>
                                <button
                                    onClick={onRegenerateObsUrl}
                                    className="flex-1 px-2 py-1 rounded bg-gray-800 hover:bg-gray-700 text-gray-400 text-xs font-medium transition"
                                >
                                    Refresh
                                </button>
                            </>
                        ) : (
                            <span className="text-gray-500 text-xs">Generating...</span>
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
            {isAuthenticated && isConnected && isAnyTtsEnabled && (
                <div className="grid grid-cols-2 gap-2">
                    <div className="flex items-center justify-between p-2 rounded-lg bg-gray-800/50 border border-gray-700">
                        <div className="flex items-center gap-1.5 min-w-0">
                            <TwitchIcon className="w-3 h-3 text-white flex-shrink-0" />
                            <span className="text-xs font-medium text-white truncate">Twitch</span>
                        </div>
                        <Switch
                            checked={isTwitchConnected && (platformSettings.enabled_platforms?.includes('twitch') || false)}
                            onCheckedChange={() => onPlatformToggle('twitch')}
                            disabled={!isTwitchConnected}
                            className="scale-75 ml-1 flex-shrink-0"
                        />
                    </div>

                    <div className="flex items-center justify-between p-2 rounded-lg bg-gray-800/50 border border-gray-700">
                        <div className="flex items-center gap-1.5 min-w-0">
                            <VKIcon className="w-3 h-3 text-white flex-shrink-0" />
                            <span className="text-xs font-medium text-white truncate">VK</span>
                        </div>
                        <Switch
                            checked={isVkConnected && (platformSettings.enabled_platforms?.includes('vk') || false)}
                            onCheckedChange={() => onPlatformToggle('vk')}
                            disabled={!isVkConnected}
                            className="scale-75 ml-1 flex-shrink-0"
                        />
                    </div>
                </div>
            )}

            {/* Channel points mode */}
            {isAuthenticated && isConnected && isAnyTtsEnabled && (
                <TtsChannelPointsMode asSection={true} />
            )}
        </div>
    );
};

export default TtsControlPanel;
