// src/components/tts/TtsControlPanel.jsx
import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
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
    const [ttsGlobalEnabled, setTtsGlobalEnabled] = useState(basicTtsEnabled || aiTtsEnabled);
    
    const isTwitchConnected = integrations.twitch?.enabled || (isGuest && user?.platform === 'twitch');
    const isVkConnected = integrations.vk?.enabled || (isGuest && user?.platform === 'vk');
    const hasLocalSetup = localStorage.getItem('tts_has_local_setup') === 'true';
    const canUseF5TTS = hasLocalSetup || isWhitelisted === true;
    const isAnyTtsEnabled = basicTtsEnabled || aiTtsEnabled;
    
    const handleGlobalTtsToggle = (enabled) => {
        setTtsGlobalEnabled(enabled);
        if (enabled) {
            // Включаем TTS (по умолчанию базовую)
            if (!basicTtsEnabled && !aiTtsEnabled) {
                setBasicTtsEnabled(true);
            }
        } else {
            // Отключаем обе
            setBasicTtsEnabled(false);
            setAiTtsEnabled(false);
        }
    };
    
    return (
        <div className="space-y-4">
            {/* Главный переключатель озвучки */}
            <Card>
                <CardContent className="pt-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <h3 className="font-semibold text-white">Озвучка</h3>
                            <p className="text-sm text-gray-400 mt-1">
                                {isAnyTtsEnabled ? (
                                    aiTtsEnabled ? 'F5-TTS с fallback на Google' : 'Google TTS'
                                ) : (
                                    'Отключена'
                                )}
                            </p>
                        </div>
                        <Switch
                            checked={isAnyTtsEnabled}
                            onCheckedChange={handleGlobalTtsToggle}
                            disabled={!isAuthenticated || !isConnected}
                            className="scale-110"
                        />
                    </div>
                </CardContent>
            </Card>

            {/* Режимы озвучки (видны только если включена) */}
            {isAnyTtsEnabled && isAuthenticated && (
                <Card>
                    <CardContent className="pt-6">
                        <div className="space-y-3">
                            <p className="text-xs font-semibold text-gray-400 uppercase">Выбрать режим</p>
                            
                            {/* Режим: Базовая озвучка */}
                            <label className={`flex items-center p-3 rounded-lg border cursor-pointer transition-all ${
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
                                    className="w-4 h-4 pointer-events-none accent-blue-500"
                                />
                                <div className="ml-3 flex-1">
                                    <p className="text-sm font-medium text-white">Google TTS</p>
                                    <p className="text-xs text-gray-400">Всегда работает</p>
                                </div>
                            </label>

                            {/* Режим: F5-TTS */}
                            <label className={`flex items-center p-3 rounded-lg border cursor-pointer transition-all ${
                                !isHealthy || !canUseF5TTS
                                    ? 'opacity-50 cursor-not-allowed'
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
                                    className="w-4 h-4 pointer-events-none accent-purple-500"
                                />
                                <div className="ml-3 flex-1">
                                    <p className="text-sm font-medium text-white">F5-TTS</p>
                                    <p className="text-xs text-gray-400">Натуральная речь</p>
                                </div>
                                <span className={`text-xs px-2 py-1 rounded ${
                                    !isHealthy ? 'bg-yellow-500/20 text-yellow-400' :
                                    canUseF5TTS ? 'bg-purple-500/20 text-purple-400' :
                                    'bg-gray-500/20 text-gray-400'
                                }`}>
                                    {!isHealthy ? 'Недоступен' : canUseF5TTS ? 'Доступен' : 'Нет доступа'}
                                </span>
                            </label>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Способ озвучки */}
            {isAuthenticated && isConnected && isAnyTtsEnabled && (
                <Card>
                    <CardContent className="pt-6">
                        <div className="space-y-3">
                            <p className="text-xs font-semibold text-gray-400 uppercase">Способ воспроизведения</p>
                            
                            <div className="grid grid-cols-2 gap-2">
                                <button
                                    onClick={() => setListeningMode('website')}
                                    className={`p-2.5 rounded-lg border transition-all text-sm ${
                                        listeningMode === 'website'
                                            ? 'border-blue-500/50 bg-blue-500/10 text-white font-medium'
                                            : 'border-gray-700 hover:border-gray-600 text-gray-400'
                                    }`}
                                >
                                    На сайте
                                </button>
                                <button
                                    onClick={() => setListeningMode('obs')}
                                    className={`p-2.5 rounded-lg border transition-all text-sm ${
                                        listeningMode === 'obs'
                                            ? 'border-blue-500/50 bg-blue-500/10 text-white font-medium'
                                            : 'border-gray-700 hover:border-gray-600 text-gray-400'
                                    }`}
                                >
                                    В OBS
                                </button>
                            </div>

                            {/* URL для OBS */}
                            {listeningMode === 'obs' && (
                                <div className="p-3 bg-gray-800/50 rounded-lg border border-gray-700 space-y-2 text-sm">
                                    <div className="flex items-center gap-2">
                                        {obsUrl && typeof obsUrl === 'string' ? (
                                            <>
                                                <button
                                                    onClick={() => {
                                                        navigator.clipboard.writeText(obsUrl);
                                                        toast.success('URL скопирован');
                                                    }}
                                                    className="px-2 py-1 rounded bg-blue-900/30 hover:bg-blue-900/50 text-blue-400 text-xs font-medium transition-colors"
                                                >
                                                    Копировать
                                                </button>
                                                <button
                                                    onClick={onRegenerateObsUrl}
                                                    className="px-2 py-1 rounded bg-gray-800 hover:bg-gray-700 text-gray-400 text-xs font-medium transition-colors"
                                                >
                                                    Обновить
                                                </button>
                                            </>
                                        ) : (
                                            <span className="text-gray-500 text-xs">Генерируется...</span>
                                        )}
                                    </div>
                                    {obsUrl && (
                                        <code className="block bg-gray-900 p-2 rounded border border-gray-700 text-green-400 text-xs overflow-auto break-all max-h-16">
                                            {obsUrl}
                                        </code>
                                    )}
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Выбор платформ */}
            {isAuthenticated && isConnected && isAnyTtsEnabled && (
                <Card>
                    <CardContent className="pt-6">
                        <div className="space-y-3">
                            <p className="text-xs font-semibold text-gray-400 uppercase">Платформы</p>
                            
                            <div className="space-y-2">
                                {/* Twitch */}
                                <div className="flex items-center justify-between p-2.5 rounded-lg bg-gray-800/30 border border-gray-700">
                                    <div className="flex items-center gap-2">
                                        <TwitchIcon className="w-4 h-4 text-white" />
                                        <div>
                                            <p className="text-sm font-medium text-white">Twitch</p>
                                            <p className="text-xs text-gray-400">
                                                {isTwitchConnected ? `@${integrations.twitch?.username || user?.twitch_username || 'загрузка...'}` : 'Не подключен'}
                                            </p>
                                        </div>
                                    </div>
                                    <Switch
                                        checked={isTwitchConnected && (platformSettings.enabled_platforms?.includes('twitch') || false)}
                                        onCheckedChange={() => onPlatformToggle('twitch')}
                                        disabled={!isTwitchConnected}
                                        className="scale-90"
                                    />
                                </div>

                                {/* VK */}
                                <div className="flex items-center justify-between p-2.5 rounded-lg bg-gray-800/30 border border-gray-700">
                                    <div className="flex items-center gap-2">
                                        <VKIcon className="w-4 h-4 text-white" />
                                        <div>
                                            <p className="text-sm font-medium text-white">VK</p>
                                            <p className="text-xs text-gray-400">
                                                {isVkConnected ? `@${integrations.vk?.username || user?.vk_username || 'загрузка...'}` : 'Не подключен'}
                                            </p>
                                        </div>
                                    </div>
                                    <Switch
                                        checked={isVkConnected && (platformSettings.enabled_platforms?.includes('vk') || false)}
                                        onCheckedChange={() => onPlatformToggle('vk')}
                                        disabled={!isVkConnected}
                                        className="scale-90"
                                    />
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Режим озвучки (все сообщения / за баллы) */}
            {isAuthenticated && isConnected && isAnyTtsEnabled && (
                <div className="border-t border-gray-700/50 pt-4">
                    <TtsChannelPointsMode asSection={true} />
                </div>
            )}
        </div>
    );
};

export default TtsControlPanel;
