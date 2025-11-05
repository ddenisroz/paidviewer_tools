// src/components/tts/TtsControlPanel.jsx
import React, { useState } from 'react';
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
            {/* 1. Главный переключатель озвучки - компактная строка */}
            <div className="flex items-center justify-between p-2.5 bg-gray-800/40 rounded-lg border border-gray-700 hover:border-gray-600 transition-colors">
                <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-semibold text-white truncate">Озвучка</h3>
                    <p className="text-xs text-gray-400 truncate mt-0.5">
                        {isAnyTtsEnabled ? (
                            aiTtsEnabled ? 'F5-TTS' : 'Google TTS'
                        ) : (
                            'Отключена'
                        )}
                    </p>
                </div>
                <Switch
                    checked={isAnyTtsEnabled}
                    onCheckedChange={handleGlobalTtsToggle}
                    disabled={!isAuthenticated || !isConnected}
                    className="scale-90 ml-2 flex-shrink-0"
                />
            </div>

            {/* 2. Режимы озвучки - если включена */}
            {isAnyTtsEnabled && isAuthenticated && (
                <div className="grid grid-cols-2 gap-2">
                    {/* Базовая озвучка */}
                    <label className={`flex items-center gap-2 px-2.5 py-2 rounded-lg border text-xs cursor-pointer transition-all ${
                        basicTtsEnabled && !aiTtsEnabled
                            ? 'border-blue-500/50 bg-blue-500/10'
                            : 'border-gray-700 hover:border-gray-600'
                    }`}>
                        <input 
                            type="radio"
                            name="tts_mode"
                            value="basic"
                            checked={basicTtsEnabled && !aiTtsEnabled}
                            onChange={() => {
                                setBasicTtsEnabled(true);
                                setAiTtsEnabled(false);
                            }}
                            className="w-3 h-3 pointer-events-none accent-blue-500"
                        />
                        <span className="text-white font-medium">Google TTS</span>
                    </label>

                    {/* F5-TTS */}
                    <label className={`flex items-center gap-2 px-2.5 py-2 rounded-lg border text-xs cursor-pointer transition-all ${
                        !isHealthy || !canUseF5TTS
                            ? 'opacity-40 cursor-not-allowed'
                            : aiTtsEnabled
                                ? 'border-purple-500/50 bg-purple-500/10'
                                : 'border-gray-700 hover:border-gray-600'
                    }`}>
                        <input 
                            type="radio"
                            name="tts_mode"
                            value="ai"
                            checked={aiTtsEnabled}
                            onChange={() => {
                                if (isHealthy && canUseF5TTS) {
                                    setAiTtsEnabled(true);
                                    setBasicTtsEnabled(false);
                                }
                            }}
                            disabled={!isHealthy || !canUseF5TTS || engineToggleLoading}
                            className="w-3 h-3 pointer-events-none accent-purple-500"
                        />
                        <span className="text-white font-medium">F5-TTS</span>
                        <span className={`text-xs ml-auto px-1.5 py-0.5 rounded ${
                            !isHealthy ? 'bg-yellow-500/20 text-yellow-400' :
                            canUseF5TTS ? 'bg-green-500/20 text-green-400' :
                            'bg-gray-500/20 text-gray-400'
                        }`}>
                            {!isHealthy ? '⚠' : canUseF5TTS ? '✓' : '✕'}
                        </span>
                    </label>
                </div>
            )}

            {/* 3. Способ озвучки (На сайте / OBS) - если включена */}
            {isAuthenticated && isConnected && isAnyTtsEnabled && (
                <div className="grid grid-cols-2 gap-2">
                    <button
                        onClick={() => setListeningMode('website')}
                        className={`px-2.5 py-2 rounded-lg border text-xs transition-all font-medium ${
                            listeningMode === 'website'
                                ? 'border-blue-500/50 bg-blue-500/10 text-blue-400'
                                : 'border-gray-700 hover:border-gray-600 text-gray-400 hover:text-gray-300'
                        }`}
                    >
                        🌐 На сайте
                    </button>
                    <button
                        onClick={() => setListeningMode('obs')}
                        className={`px-2.5 py-2 rounded-lg border text-xs transition-all font-medium ${
                            listeningMode === 'obs'
                                ? 'border-blue-500/50 bg-blue-500/10 text-blue-400'
                                : 'border-gray-700 hover:border-gray-600 text-gray-400 hover:text-gray-300'
                        }`}
                    >
                        📡 OBS
                    </button>
                </div>
            )}

            {/* 4. URL для OBS - компактный */}
            {listeningMode === 'obs' && isAnyTtsEnabled && (
                <div className="p-2.5 bg-gray-800/50 rounded-lg border border-gray-700 space-y-1.5 text-xs">
                    <div className="flex gap-1">
                        {obsUrl && typeof obsUrl === 'string' ? (
                            <>
                                <button
                                    onClick={() => {
                                        navigator.clipboard.writeText(obsUrl);
                                        toast.success('URL скопирован');
                                    }}
                                    className="flex-1 px-2 py-1 rounded bg-blue-900/30 hover:bg-blue-900/50 text-blue-400 font-medium transition-colors text-xs"
                                >
                                    Копировать
                                </button>
                                <button
                                    onClick={onRegenerateObsUrl}
                                    className="flex-1 px-2 py-1 rounded bg-gray-800 hover:bg-gray-700 text-gray-400 font-medium transition-colors text-xs"
                                >
                                    Обновить
                                </button>
                            </>
                        ) : (
                            <span className="text-gray-500">Генерируется...</span>
                        )}
                    </div>
                    {obsUrl && (
                        <code className="block bg-gray-900 p-1.5 rounded border border-gray-700 text-green-400 overflow-auto break-all max-h-8 font-mono text-xs">
                            {obsUrl.length > 50 ? `${obsUrl.substring(0, 47)}...` : obsUrl}
                        </code>
                    )}
                </div>
            )}

            {/* 5. Платформы - в две колонки */}
            {isAuthenticated && isConnected && isAnyTtsEnabled && (
                <div className="grid grid-cols-2 gap-2">
                    {/* Twitch */}
                    <div className="flex items-center justify-between p-2 rounded-lg bg-gray-800/40 border border-gray-700">
                        <div className="flex items-center gap-1.5">
                            <TwitchIcon className="w-3 h-3 text-white" />
                            <span className="text-xs font-medium text-white">Twitch</span>
                        </div>
                        <Switch
                            checked={isTwitchConnected && (platformSettings.enabled_platforms?.includes('twitch') || false)}
                            onCheckedChange={() => onPlatformToggle('twitch')}
                            disabled={!isTwitchConnected}
                            className="scale-75"
                        />
                    </div>

                    {/* VK */}
                    <div className="flex items-center justify-between p-2 rounded-lg bg-gray-800/40 border border-gray-700">
                        <div className="flex items-center gap-1.5">
                            <VKIcon className="w-3 h-3 text-white" />
                            <span className="text-xs font-medium text-white">VK</span>
                        </div>
                        <Switch
                            checked={isVkConnected && (platformSettings.enabled_platforms?.includes('vk') || false)}
                            onCheckedChange={() => onPlatformToggle('vk')}
                            disabled={!isVkConnected}
                            className="scale-75"
                        />
                    </div>
                </div>
            )}

            {/* 6. Режим озвучки (все сообщения / за баллы) */}
            {isAuthenticated && isConnected && isAnyTtsEnabled && (
                <TtsChannelPointsMode asSection={true} />
            )}
        </div>
    );
};

export default TtsControlPanel;
