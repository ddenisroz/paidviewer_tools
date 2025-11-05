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
        <div className="space-y-3">
            {/* On/Off switch - prominent button */}
            <button
                onClick={() => handleGlobalTtsToggle(!isAnyTtsEnabled)}
                disabled={!isAuthenticated || !isConnected}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-lg border-2 font-semibold transition-all ${
                    isAnyTtsEnabled
                        ? 'border-green-500/50 bg-green-500/10 text-green-400 hover:border-green-500/70 hover:bg-green-500/15'
                        : 'border-gray-700 bg-gray-800/50 text-gray-400 hover:border-gray-600 hover:bg-gray-800/60'
                }`}
            >
                <span className="text-base">Text to Speech</span>
                <span className="text-sm px-3 py-1 rounded bg-black/40">
                    {isAnyTtsEnabled ? 'ON' : 'OFF'}
                </span>
            </button>

            {/* Mode selection - if enabled */}
            {isAnyTtsEnabled && isAuthenticated && (
                <div className="space-y-2">
                    <div className="px-1">
                        <label className="text-xs font-semibold text-gray-300 uppercase tracking-wide">
                            TTS Mode:
                        </label>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        <button
                            onClick={() => {
                                setBasicTtsEnabled(true);
                                setAiTtsEnabled(false);
                            }}
                            className={`px-3 py-2 rounded-lg border text-sm font-medium transition-all ${
                                basicTtsEnabled && !aiTtsEnabled
                                    ? 'border-blue-500/50 bg-blue-500/10 text-blue-400'
                                    : 'border-gray-700 hover:border-gray-600 text-gray-400'
                            }`}
                        >
                            Google
                        </button>

                        <button
                            onClick={() => {
                                if (isHealthy && canUseF5TTS) {
                                    setAiTtsEnabled(true);
                                    setBasicTtsEnabled(false);
                                }
                            }}
                            disabled={!isHealthy || !canUseF5TTS || engineToggleLoading}
                            className={`px-3 py-2 rounded-lg border text-sm font-medium transition-all ${
                                !isHealthy || !canUseF5TTS
                                    ? 'opacity-40 cursor-not-allowed'
                                    : aiTtsEnabled
                                        ? 'border-purple-500/50 bg-purple-500/10 text-purple-400'
                                        : 'border-gray-700 hover:border-gray-600 text-gray-400'
                            }`}
                        >
                            F5-TTS
                        </button>
                    </div>
                </div>
            )}

            {/* Listening mode */}
            {isAuthenticated && isConnected && isAnyTtsEnabled && (
                <div className="space-y-2 border-t border-gray-700/50 pt-3">
                    <div className="px-1">
                        <label className="text-xs font-semibold text-gray-300 uppercase tracking-wide">
                            Output:
                        </label>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        <button
                            onClick={() => setListeningMode('website')}
                            className={`px-3 py-2 rounded-lg border text-sm font-medium transition-all ${
                                listeningMode === 'website'
                                    ? 'border-green-500/50 bg-green-500/10 text-green-400'
                                    : 'border-gray-700 hover:border-gray-600 text-gray-400'
                            }`}
                        >
                            Website
                        </button>
                        <button
                            onClick={() => setListeningMode('obs')}
                            className={`px-3 py-2 rounded-lg border text-sm font-medium transition-all ${
                                listeningMode === 'obs'
                                    ? 'border-green-500/50 bg-green-500/10 text-green-400'
                                    : 'border-gray-700 hover:border-gray-600 text-gray-400'
                            }`}
                        >
                            OBS
                        </button>
                    </div>
                </div>
            )}

            {/* OBS URL */}
            {listeningMode === 'obs' && isAnyTtsEnabled && (
                <div className="p-2.5 bg-gray-900/50 rounded-lg border border-gray-700 space-y-1.5">
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
                <div className="space-y-2 border-t border-gray-700/50 pt-3">
                    <div className="px-1">
                        <label className="text-xs font-semibold text-gray-300 uppercase tracking-wide">
                            Platforms:
                        </label>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                        <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-gray-800/30 border border-gray-700">
                            <div className="flex items-center gap-2 min-w-0">
                                <TwitchIcon className="w-4 h-4 text-white flex-shrink-0" />
                                <span className="text-sm font-medium text-gray-300 truncate">Twitch</span>
                            </div>
                            <Switch
                                checked={isTwitchConnected && (platformSettings.enabled_platforms?.includes('twitch') || false)}
                                onCheckedChange={() => onPlatformToggle('twitch')}
                                disabled={!isTwitchConnected}
                                className="scale-75 ml-2 flex-shrink-0"
                            />
                        </div>

                        <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-gray-800/30 border border-gray-700">
                            <div className="flex items-center gap-2 min-w-0">
                                <VKIcon className="w-4 h-4 text-white flex-shrink-0" />
                                <span className="text-sm font-medium text-gray-300 truncate">VK</span>
                            </div>
                            <Switch
                                checked={isVkConnected && (platformSettings.enabled_platforms?.includes('vk') || false)}
                                onCheckedChange={() => onPlatformToggle('vk')}
                                disabled={!isVkConnected}
                                className="scale-75 ml-2 flex-shrink-0"
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* Channel points mode */}
            {isAuthenticated && isConnected && isAnyTtsEnabled && (
                <div className="border-t border-gray-700/50 pt-3">
                    <TtsChannelPointsMode asSection={true} />
                </div>
            )}
        </div>
    );
};

export default TtsControlPanel;
