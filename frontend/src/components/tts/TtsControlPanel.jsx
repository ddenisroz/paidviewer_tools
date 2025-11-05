// src/components/tts/TtsControlPanel.jsx
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
    // Проверяем, подключена ли платформа (через OAuth или как гость)
    const isTwitchConnected = integrations.twitch?.enabled || (isGuest && user?.platform === 'twitch');
    const isVkConnected = integrations.vk?.enabled || (isGuest && user?.platform === 'vk');
    
    // Проверяем есть ли локальный TTS setup
    const hasLocalSetup = localStorage.getItem('tts_has_local_setup') === 'true';
    // Обрабатываем случай когда isWhitelisted еще не проверен (null)
    // Если isWhitelisted === null, считаем что проверка еще не выполнена, но не блокируем доступ
    // (проверка будет выполнена на бэкенде)
    const canUseF5TTS = hasLocalSetup || isWhitelisted === true;
    
    return (
        <Card>
            <CardHeader>
                <CardTitle>Управление озвучкой</CardTitle>
                <CardDescription>
                    {!isAuthenticated && !isConnected && <span className="text-yellow-500">Сначала подключите бота к каналу.</span>}
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="space-y-5">
                    {/* ✅ НОВЫЙ UX: Единый выбор режима озвучки с radio buttons */}
                    <div>
                        <h3 className="text-sm font-semibold text-gray-300 mb-3">Выбрать режим озвучки</h3>
                        <div className="grid grid-cols-1 gap-3">
                            {/* Режим 1: Базовая озвучка */}
                            <label className={`flex items-center space-x-4 p-4 rounded-2xl border-2 transition-all duration-200 cursor-pointer ${
                                basicTtsEnabled && !aiTtsEnabled
                                    ? 'bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/50 hover:border-blue-500/70'
                                    : 'bg-gray-500/10 border-gray-500/30 hover:border-gray-500/50'
                            } ${!isAuthenticated || !isConnected ? 'opacity-50 cursor-not-allowed' : ''}`}>
                                <input 
                                    type="radio"
                                    name="tts_mode"
                                    value="basic"
                                    checked={basicTtsEnabled && !aiTtsEnabled}
                                    onChange={() => {
                                        if (isAuthenticated && isConnected) {
                                            setBasicTtsEnabled(true);
                                            setAiTtsEnabled(false); // ✅ Отключаем F5 при выборе базовой
                                        }
                                    }}
                                    disabled={!isAuthenticated || !isConnected}
                                    className="w-5 h-5 pointer-events-none accent-blue-500"
                                />
                                <div className="flex-1">
                                    <h4 className="text-base font-bold text-white">🎤 Google TTS (Базовая озвучка)</h4>
                                    <p className="text-sm text-gray-400 mt-1">Всегда работает, но менее натуральна. Хороша как fallback.</p>
                                </div>
                                <span className="text-xs bg-green-500/20 text-green-400 px-2 py-1 rounded font-semibold">✓ Всегда работает</span>
                            </label>

                            {/* Режим 2: ИИ озвучка F5-TTS */}
                            <label className={`flex items-center space-x-4 p-4 rounded-2xl border-2 transition-all duration-200 cursor-pointer ${
                                aiTtsEnabled
                                    ? 'bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-500/50 hover:border-purple-500/70'
                                    : 'bg-gray-500/10 border-gray-500/30 hover:border-gray-500/50'
                            } ${!isHealthy || !canUseF5TTS ? 'opacity-50 cursor-not-allowed' : ''}`}>
                                <input 
                                    type="radio"
                                    name="tts_mode"
                                    value="ai"
                                    checked={aiTtsEnabled}
                                    onChange={() => {
                                        if (isHealthy && canUseF5TTS && isAuthenticated && isConnected) {
                                            setAiTtsEnabled(true);
                                            setBasicTtsEnabled(false); // ✅ Отключаем базовую при выборе F5
                                        }
                                    }}
                                    disabled={!isHealthy || !isAuthenticated || !isConnected || (isWhitelisted === false && !hasLocalSetup) || engineToggleLoading}
                                    className="w-5 h-5 pointer-events-none accent-purple-500"
                                />
                                <div className="flex-1">
                                    <h4 className="text-base font-bold text-white">⚡ F5-TTS (ИИ озвучка)</h4>
                                    <p className="text-sm text-gray-400 mt-1">Натуральная речь, автоматический fallback на Google TTS.</p>
                                </div>
                                <div className="text-xs font-semibold">
                                    {!isHealthy && <span className="bg-yellow-500/20 text-yellow-400 px-2 py-1 rounded">⚠ Недоступен</span>}
                                    {isHealthy && canUseF5TTS && <span className="bg-purple-500/20 text-purple-400 px-2 py-1 rounded">⚡ Доступен</span>}
                                    {isHealthy && !canUseF5TTS && <span className="bg-orange-500/20 text-orange-400 px-2 py-1 rounded">🔒 Whitelist</span>}
                                </div>
                            </label>

                            {/* Информация о fallback */}
                            <div className="p-3 bg-blue-900/20 border border-blue-700/50 rounded-lg text-xs text-blue-300">
                                <strong>ℹ️ Совет:</strong> При ошибке F5-TTS система автоматически переключится на Google TTS без потери озвучки.
                            </div>
                        </div>
                    </div>
                    
                    {/* Способ озвучки */}
                    {isAuthenticated && (
                        <div className="border-t border-gray-700/50 pt-5">
                            <div className="space-y-3">
                            <div className="grid grid-cols-2 gap-2">
                                <button
                                    onClick={() => setListeningMode('website')}
                                    className={`p-3 rounded-xl border-2 transition-all duration-200 text-left ${
                                        listeningMode === 'website'
                                            ? 'border-primary bg-primary/10'
                                            : 'border-border hover:border-primary/50 hover:bg-primary/5'
                                    }`}
                                >
                                    <div className="font-semibold text-sm mb-0.5">Сайт</div>
                                    <div className="text-xs text-muted-foreground">Источник воспроизведения веб-страница</div>
                                </button>
                                <button
                                    onClick={() => setListeningMode('obs')}
                                    className={`p-3 rounded-xl border-2 transition-all duration-200 text-left ${
                                        listeningMode === 'obs'
                                            ? 'border-primary bg-primary/10'
                                            : 'border-border hover:border-primary/50 hover:bg-primary/5'
                                    }`}
                                >
                                    <div className="font-semibold text-sm mb-0.5">OBS</div>
                                    <div className="text-xs text-muted-foreground">Browser Source</div>
                                </button>
                            </div>
                            
                            {/* URL для OBS - под кнопками */}
                            {listeningMode === 'obs' && (
                                <div className="p-3 bg-gray-800/50 rounded-lg border border-gray-700 space-y-2">
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm text-gray-400">URL для OBS:</span>
                                        {obsUrl && typeof obsUrl === 'string' ? (
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => {
                                                        navigator.clipboard.writeText(obsUrl);
                                                        toast.success('URL скопирован в буфер обмена');
                                                    }}
                                                    className="text-blue-400 hover:text-blue-300 px-3 py-1.5 rounded bg-blue-900/20 text-xs font-medium transition-colors"
                                                    title="Копировать URL"
                                                >
                                                    📋 Копировать
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        if (onRegenerateObsUrl) {
                                                            onRegenerateObsUrl();
                                                            // handleRegenerateObsUrl в TtsMainPage.jsx уже показывает toast
                                                        }
                                                    }}
                                                    className="text-yellow-400 hover:text-yellow-300 px-3 py-1.5 rounded bg-yellow-900/20 text-xs font-medium transition-colors"
                                                    title="Перегенерировать URL"
                                                >
                                                    🔄 Перегенерировать
                                                </button>
                                            </div>
                                        ) : (
                                            <span className="text-gray-500 text-xs">Генерируется...</span>
                                        )}
                                    </div>
                                    {obsUrl && typeof obsUrl === 'string' && (
                                        <div className="bg-gray-900 p-3 rounded border border-gray-700">
                                            <code className="text-green-400 font-mono text-xs break-all">
                                                {obsUrl.length > 80 ? `${obsUrl.substring(0, 77)}...` : obsUrl}
                                            </code>
                                        </div>
                                    )}
                                </div>
                            )}
                            </div>
                        </div>
                    )}
                    
                    {/* Выбор платформ */}
                    {isAuthenticated && (
                        <div className="border-t border-gray-700/50 pt-5">
                            <div className="space-y-3">
                            <div className="grid grid-cols-2 gap-2">
                                {/* Twitch */}
                                <div className={`flex items-center justify-between p-2.5 rounded-lg border ${
                                    isTwitchConnected 
                                        ? 'bg-gray-800 border-gray-700' 
                                        : 'bg-gray-900 border-gray-800'
                                }`}>
                                    <div className="flex items-center space-x-2">
                                        <TwitchIcon className={`w-4 h-4 ${
                                            isTwitchConnected ? 'text-white' : 'text-gray-500'
                                        }`} />
                                        <div>
                                            <p className="text-sm font-medium text-white">Twitch</p>
                                            <p className="text-xs text-gray-400">
                                                {isTwitchConnected 
                                                    ? `@${integrations.twitch?.username || user?.twitch_username || user?.username || 'загрузка...'}` 
                                                    : 'Не подключен'
                                                }
                                            </p>
                                        </div>
                                    </div>
                                    <Switch
                                        checked={isTwitchConnected && (platformSettings.enabled_platforms?.includes('twitch') || false)}
                                        onCheckedChange={() => onPlatformToggle('twitch')}
                                        disabled={!isTwitchConnected}
                                    />
                                </div>
                                
                                {/* VK Live */}
                                <div className={`flex items-center justify-between p-2.5 rounded-lg border ${
                                    isVkConnected 
                                        ? 'bg-gray-800 border-gray-700' 
                                        : 'bg-gray-900 border-gray-800'
                                }`}>
                                    <div className="flex items-center space-x-2">
                                        <VKIcon className={`w-4 h-4 ${
                                            isVkConnected ? 'text-white' : 'text-gray-500'
                                        }`} />
                                        <div>
                                            <p className="text-sm font-medium text-white">VK Live</p>
                                            <p className="text-xs text-gray-400">
                                                {isVkConnected 
                                                    ? `@${integrations.vk?.username || user?.vk_username || user?.username || 'загрузка...'}` 
                                                    : 'Не подключен'
                                                }
                                            </p>
                                        </div>
                                    </div>
                                    <Switch
                                        checked={isVkConnected && (platformSettings.enabled_platforms?.includes('vk') || false)}
                                        onCheckedChange={() => onPlatformToggle('vk')}
                                        disabled={!isVkConnected}
                                    />
                                </div>
                            </div>
                            </div>
                        </div>
                    )}
                    
                    {/* Режим озвучки (все сообщения / за баллы) */}
                    {isAuthenticated && (
                        <div className="border-t border-gray-700/50 pt-5">
                            <TtsChannelPointsMode asSection={true} />
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
};

export default TtsControlPanel;

