// src/components/tts/TtsControlPanel.jsx
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
    
    return (
        <Card>
            <CardHeader>
                <CardTitle>Управление озвучкой</CardTitle>
                <CardDescription>
                    {!isAuthenticated && !isConnected && <span className="text-yellow-500">Сначала подключите бота к каналу.</span>}
                </CardDescription>
            </CardHeader>
            <CardContent>
                <div className="space-y-6">
                    {/* Базовая озвучка - доступна всегда */}
                    <div className="flex items-center justify-between p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                        <div className="flex items-center space-x-3">
                            <Switch
                                checked={basicTtsEnabled}
                                onCheckedChange={(checked) => setBasicTtsEnabled(checked)}
                                disabled={!isAuthenticated || !isConnected}
                            />
                            <div>
                                <h3 className="text-sm font-medium text-white">Базовая озвучка</h3>
                                {(!isAuthenticated || !isConnected) && (
                                    <p className="text-xs text-gray-400">Требуется подключение к каналу</p>
                                )}
                            </div>
                        </div>
                        
                    </div>

                    {/* ИИ озвучка F5-TTS - требует подтверждения */}
                    <div className={`flex items-center justify-between p-4 rounded-lg transition-all ${
                        isHealthy 
                            ? 'bg-purple-500/10 border border-purple-500/30' 
                            : 'bg-gray-500/10 border border-gray-500/30'
                    }`}>
                        <div className="flex items-center space-x-3">
                            <Switch
                                checked={aiTtsEnabled}
                                onCheckedChange={(checked) => setAiTtsEnabled(checked)}
                                disabled={!isHealthy || !isAuthenticated || !isConnected}
                            />
                            <div>
                                <h3 className="text-sm font-medium text-white">ИИ озвучка (F5-TTS)</h3>
                                {(!isAuthenticated || !isConnected) && (
                                    <p className="text-xs text-gray-400">Требуется подключение к каналу</p>
                                )}
                            </div>
                        </div>
                        
                    </div>
                    
                    {/* Способ озвучки */}
                    {isAuthenticated && (
                        <div className="space-y-3">
                            <div className="flex items-center gap-3">
                                <span className="text-sm text-gray-400">Способ озвучки:</span>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setListeningMode('website')}
                                        className={`px-4 py-2 text-sm rounded-lg transition-colors font-medium ${
                                            listeningMode === 'website'
                                                ? 'bg-blue-600 text-white shadow-lg'
                                                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                                        }`}
                                    >
                                        Сайт
                                    </button>
                                    <button
                                        onClick={() => setListeningMode('obs')}
                                        className={`px-4 py-2 text-sm rounded-lg transition-colors font-medium ${
                                            listeningMode === 'obs'
                                                ? 'bg-blue-600 text-white shadow-lg'
                                                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                                        }`}
                                    >
                                        OBS
                                    </button>
                                </div>
                            </div>
                            
                            {/* URL для OBS - под кнопками */}
                            {listeningMode === 'obs' && (
                                <div className="p-4 bg-gray-800/50 rounded-lg border border-gray-700 space-y-3">
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
                                                            toast.success('URL перегенерирован');
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
                    )}
                    
                    {/* Выбор платформ */}
                    {isAuthenticated && (
                        <div className="border-t border-gray-700 pt-4">
                            <h4 className="text-sm font-medium text-gray-300 mb-3">Выбор платформ</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {/* Twitch */}
                                <div className={`flex items-center justify-between p-3 rounded-lg border ${
                                    isTwitchConnected 
                                        ? 'bg-gray-800 border-gray-700' 
                                        : 'bg-gray-900 border-gray-800'
                                }`}>
                                    <div className="flex items-center space-x-3">
                                        <TwitchIcon className={`w-5 h-5 ${
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
                                <div className={`flex items-center justify-between p-3 rounded-lg border ${
                                    isVkConnected 
                                        ? 'bg-gray-800 border-gray-700' 
                                        : 'bg-gray-900 border-gray-800'
                                }`}>
                                    <div className="flex items-center space-x-3">
                                        <VKIcon className={`w-5 h-5 ${
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
                    )}
                </div>
            </CardContent>
        </Card>
    );
};

export default TtsControlPanel;

