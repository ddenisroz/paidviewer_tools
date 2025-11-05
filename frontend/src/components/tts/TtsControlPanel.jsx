// src/components/tts/TtsControlPanel.jsx
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
    
    return (
        <>
            {/* Compact Enable/Disable Button */}
            <div className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-700 bg-gray-800/30">
                <Switch
                    checked={isAnyTtsEnabled}
                    onCheckedChange={handleGlobalTtsToggle}
                    className="scale-100"
                />
                <span className="text-sm font-semibold text-white">
                    {isAnyTtsEnabled ? 'Озвучка ВКЛ' : 'Озвучка ВЫКЛ'}
                </span>
            </div>

            {isAnyTtsEnabled && (
                <Card className="border-gray-700 bg-gray-900/30">
                    <CardHeader>
                        <CardTitle className="text-base font-semibold text-white">Управление</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3 pt-4">
                        {/* Engine - 2 columns */}
                        <div>
                            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Движок</label>
                            <div className="grid grid-cols-2 gap-2">
                                <button
                                    onClick={() => setTtsEngine('cloud')}
                                    className={`py-2 px-3 rounded text-xs font-semibold transition-all border ${
                                        ttsEngine === 'cloud'
                                            ? 'border-purple-400 bg-purple-500/20 text-purple-200'
                                            : 'border-gray-700/50 bg-gray-800/20 text-gray-400 hover:border-purple-400/40'
                                    }`}
                                >
                                    Облако
                                </button>
                                <button
                                    onClick={() => setTtsEngine('local')}
                                    disabled={!localTtsConfig?.configured || !isWhitelisted}
                                    className={`py-2 px-3 rounded text-xs font-semibold transition-all border ${
                                        !localTtsConfig?.configured || !isWhitelisted
                                            ? 'opacity-40 cursor-not-allowed border-gray-700 bg-gray-800/20 text-gray-500'
                                            : ttsEngine === 'local'
                                                ? 'border-green-400 bg-green-500/20 text-green-200'
                                                : 'border-gray-700/50 bg-gray-800/20 text-gray-400 hover:border-green-400/40'
                                    }`}
                                >
                                    Локально
                                </button>
                            </div>
                        </div>

                        {/* Mode - 2 columns */}
                        <div>
                            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Режим</label>
                            <div className="grid grid-cols-2 gap-2">
                                <button
                                    onClick={() => setBasicTtsEnabled(true)}
                                    className={`py-2 px-3 rounded text-xs font-semibold transition-all border ${
                                        basicTtsEnabled && !aiTtsEnabled
                                            ? 'border-green-400 bg-green-500/20 text-green-200'
                                            : 'border-gray-700/50 bg-gray-800/20 text-gray-400 hover:border-green-400/40'
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
                                    className={`py-2 px-3 rounded text-xs font-semibold transition-all border ${
                                        !isHealthy || !canUseF5TTS
                                            ? 'opacity-40 cursor-not-allowed border-gray-700 bg-gray-800/20 text-gray-500'
                                            : aiTtsEnabled
                                                ? 'border-purple-400 bg-purple-500/20 text-purple-200'
                                                : 'border-gray-700/50 bg-gray-800/20 text-gray-400 hover:border-purple-400/40'
                                    }`}
                                >
                                    F5-TTS
                                </button>
                            </div>
                        </div>

                        {/* Output - 2 columns */}
                        <div>
                            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Вывод</label>
                            <div className="grid grid-cols-2 gap-2">
                                <button
                                    onClick={() => setListeningMode('website')}
                                    className={`py-2 px-3 rounded text-xs font-semibold transition-all border ${
                                        listeningMode === 'website'
                                            ? 'border-purple-400 bg-purple-500/20 text-purple-200'
                                            : 'border-gray-700/50 bg-gray-800/20 text-gray-400 hover:border-purple-400/40'
                                    }`}
                                >
                                    Сайт
                                </button>
                                <button
                                    onClick={() => setListeningMode('obs')}
                                    className={`py-2 px-3 rounded text-xs font-semibold transition-all border ${
                                        listeningMode === 'obs'
                                            ? 'border-green-400 bg-green-500/20 text-green-200'
                                            : 'border-gray-700/50 bg-gray-800/20 text-gray-400 hover:border-green-400/40'
                                    }`}
                                >
                                    OBS
                                </button>
                            </div>
                        </div>

                        {/* OBS URL */}
                        {listeningMode === 'obs' && (
                            <div className="bg-green-900/20 border border-green-500/40 rounded p-2">
                                <label className="block text-xs font-bold text-green-300 mb-1">URL OBS</label>
                                <div className="flex gap-1">
                                    {obsUrl ? (
                                        <>
                                            <button
                                                onClick={() => {
                                                    navigator.clipboard.writeText(obsUrl);
                                                    toast.success('Скопировано');
                                                }}
                                                className="flex-1 py-1 px-2 rounded text-xs font-semibold text-green-200 bg-green-500/20 hover:bg-green-500/30 border border-green-500/40"
                                            >
                                                Копировать
                                            </button>
                                            <button
                                                onClick={onRegenerateObsUrl}
                                                className="flex-1 py-1 px-2 rounded text-xs font-semibold text-green-200 bg-green-500/20 hover:bg-green-500/30 border border-green-500/40"
                                            >
                                                Обновить
                                            </button>
                                        </>
                                    ) : (
                                        <span className="text-green-400/60 text-xs py-1">Генерируется...</span>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Platforms - 2 columns */}
                        {isAuthenticated && (isTwitchConnected || isVkConnected) && (
                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Платформы</label>
                                <div className="grid grid-cols-2 gap-2">
                                    {isTwitchConnected && (
                                        <div className="flex items-center justify-between px-2 py-1.5 rounded border border-gray-700/50 bg-gray-800/20">
                                            <div className="flex items-center gap-1.5">
                                                <TwitchIcon className="w-3 h-3 text-purple-300" />
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
                                        <div className="flex items-center justify-between px-2 py-1.5 rounded border border-gray-700/50 bg-gray-800/20">
                                            <div className="flex items-center gap-1.5">
                                                <VKIcon className="w-3 h-3 text-green-300" />
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
                    </CardContent>
                </Card>
            )}
        </>
    );
};

export default TtsControlPanel;
