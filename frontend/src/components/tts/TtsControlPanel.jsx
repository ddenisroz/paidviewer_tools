// src/components/tts/TtsControlPanel.jsx
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { TwitchIcon, VKIcon } from '../PlatformIcons';
import { Button } from '@/components/ui/button';
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
        <Card className="border-gray-700 bg-gray-900/30">
            <CardHeader>
                <CardTitle className="text-base font-semibold text-white">Озвучка</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
                {/* Main Enable Button */}
                <div className="flex items-center justify-center mb-2">
                    <button
                        onClick={handleGlobalTtsToggle}
                        className={`px-8 py-3 rounded-xl font-semibold text-sm transition-all duration-300 border-2 ${
                            isAnyTtsEnabled
                                ? 'border-purple-500 bg-purple-500/20 text-purple-300 hover:bg-purple-500/30 hover:border-purple-400'
                                : 'border-gray-600 bg-gray-800/50 text-gray-400 hover:bg-gray-800/70 hover:border-gray-500'
                        }`}
                    >
                        {isAnyTtsEnabled ? 'Озвучка ВКЛ' : 'Озвучка ВЫКЛ'}
                    </button>
                </div>

                {isAnyTtsEnabled && (
                    <>
                        {/* Engine - 2 columns */}
                        <div className="pt-2">
                            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Движок</label>
                            <div className="grid grid-cols-2 gap-3">
                                <button
                                    onClick={() => setTtsEngine('cloud')}
                                    className={`py-2.5 px-4 rounded-lg text-sm font-semibold transition-all border ${
                                        ttsEngine === 'cloud'
                                            ? 'border-purple-400 bg-purple-500/20 text-purple-200'
                                            : 'border-gray-700/50 bg-gray-800/30 text-gray-400 hover:border-purple-400/40 hover:bg-gray-800/50'
                                    }`}
                                >
                                    Облако
                                </button>
                                <button
                                    onClick={() => setTtsEngine('local')}
                                    disabled={!localTtsConfig?.configured || !isWhitelisted}
                                    className={`py-2.5 px-4 rounded-lg text-sm font-semibold transition-all border ${
                                        !localTtsConfig?.configured || !isWhitelisted
                                            ? 'opacity-40 cursor-not-allowed border-gray-700 bg-gray-800/20 text-gray-500'
                                            : ttsEngine === 'local'
                                                ? 'border-green-400 bg-green-500/20 text-green-200'
                                                : 'border-gray-700/50 bg-gray-800/30 text-gray-400 hover:border-green-400/40 hover:bg-gray-800/50'
                                    }`}
                                >
                                    Локально
                                </button>
                            </div>
                        </div>

                        {/* Mode - 2 columns */}
                        <div>
                            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Режим</label>
                            <div className="grid grid-cols-2 gap-3">
                                <button
                                    onClick={() => setBasicTtsEnabled(true)}
                                    className={`py-2.5 px-4 rounded-lg text-sm font-semibold transition-all border ${
                                        basicTtsEnabled && !aiTtsEnabled
                                            ? 'border-green-400 bg-green-500/20 text-green-200'
                                            : 'border-gray-700/50 bg-gray-800/30 text-gray-400 hover:border-green-400/40 hover:bg-gray-800/50'
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
                                    className={`py-2.5 px-4 rounded-lg text-sm font-semibold transition-all border ${
                                        !isHealthy || !canUseF5TTS
                                            ? 'opacity-40 cursor-not-allowed border-gray-700 bg-gray-800/20 text-gray-500'
                                            : aiTtsEnabled
                                                ? 'border-purple-400 bg-purple-500/20 text-purple-200'
                                                : 'border-gray-700/50 bg-gray-800/30 text-gray-400 hover:border-purple-400/40 hover:bg-gray-800/50'
                                    }`}
                                >
                                    F5-TTS
                                </button>
                            </div>
                        </div>

                        {/* Output - 2 columns */}
                        <div>
                            <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Вывод</label>
                            <div className="grid grid-cols-2 gap-3">
                                <button
                                    onClick={() => setListeningMode('website')}
                                    className={`py-2.5 px-4 rounded-lg text-sm font-semibold transition-all border ${
                                        listeningMode === 'website'
                                            ? 'border-purple-400 bg-purple-500/20 text-purple-200'
                                            : 'border-gray-700/50 bg-gray-800/30 text-gray-400 hover:border-purple-400/40 hover:bg-gray-800/50'
                                    }`}
                                >
                                    Сайт
                                </button>
                                <button
                                    onClick={() => setListeningMode('obs')}
                                    className={`py-2.5 px-4 rounded-lg text-sm font-semibold transition-all border ${
                                        listeningMode === 'obs'
                                            ? 'border-green-400 bg-green-500/20 text-green-200'
                                            : 'border-gray-700/50 bg-gray-800/30 text-gray-400 hover:border-green-400/40 hover:bg-gray-800/50'
                                    }`}
                                >
                                    OBS
                                </button>
                            </div>
                        </div>

                        {/* OBS URL */}
                        {listeningMode === 'obs' && (
                            <div className="bg-green-900/20 border border-green-500/40 rounded-lg p-3">
                                <label className="block text-xs font-bold text-green-300 uppercase tracking-wider mb-2">URL для OBS</label>
                                <div className="flex gap-2">
                                    {obsUrl ? (
                                        <>
                                            <button
                                                onClick={() => {
                                                    navigator.clipboard.writeText(obsUrl);
                                                    toast.success('Скопировано');
                                                }}
                                                className="flex-1 py-2 px-3 rounded text-xs font-semibold text-green-200 bg-green-500/20 hover:bg-green-500/30 border border-green-500/40 transition-all"
                                            >
                                                Копировать
                                            </button>
                                            <button
                                                onClick={onRegenerateObsUrl}
                                                className="flex-1 py-2 px-3 rounded text-xs font-semibold text-green-200 bg-green-500/20 hover:bg-green-500/30 border border-green-500/40 transition-all"
                                            >
                                                Обновить
                                            </button>
                                        </>
                                    ) : (
                                        <span className="text-green-400/60 text-xs py-2">Генерируется...</span>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Platforms - 2 columns */}
                        {isAuthenticated && (isTwitchConnected || isVkConnected) && (
                            <div>
                                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Платформы</label>
                                <div className="grid grid-cols-2 gap-3">
                                    {isTwitchConnected && (
                                        <div className="flex items-center justify-between px-3 py-2.5 rounded-lg border border-gray-700/50 bg-gray-800/30 hover:bg-gray-800/50 transition-all">
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
                                        <div className="flex items-center justify-between px-3 py-2.5 rounded-lg border border-gray-700/50 bg-gray-800/30 hover:bg-gray-800/50 transition-all">
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
                        <TtsChannelPointsMode asSection={true} />
                    </>
                )}
            </CardContent>
        </Card>
    );
};

export default TtsControlPanel;
