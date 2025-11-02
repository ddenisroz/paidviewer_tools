import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import api from '../../services/api';
import { logger } from '../../utils/prodLogger';

const YoutubeSettingsPage = () => {
    const [playbackMode, setPlaybackMode] = useState('browser');
    const [youtubeObsUrl, setYoutubeObsUrl] = useState('');
    const [volume, setVolume] = useState(50);

    // Загрузка настроек YouTube
    const loadYoutubeSettings = async () => {
        try {
            const response = await api.get('/api/tts/youtube-settings');
            setPlaybackMode(response.data.playback_mode || 'browser');
            setVolume(response.data.volume_level || 50);
        } catch (error) {
            logger.error('Error loading YouTube settings:', error);
        }
    };

    // Сохранение настроек YouTube
    const saveYoutubeSettings = async (newPlaybackMode, newVolume) => {
        try {
            await api.post('/api/tts/youtube-settings', {
                playback_mode: newPlaybackMode,
                volume_level: newVolume
            });
            toast.success('Настройки YouTube сохранены');
        } catch (error) {
            logger.error('Error saving YouTube settings:', error);
            toast.error('Ошибка сохранения настроек YouTube');
        }
    };

    // Генерация URL для YouTube OBS
    const generateYoutubeObsUrl = async () => {
        try {
            const response = await api.post('/api/youtube/generate-obs-url');
            setYoutubeObsUrl(response.data.youtube_obs_url);
            return response.data.youtube_obs_url;
        } catch (error) {
            logger.error('Error generating YouTube OBS URL:', error);
            toast.error('Ошибка создания YouTube OBS URL');
            return null;
        }
    };

    useEffect(() => {
        loadYoutubeSettings();
    }, []);

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        ⚙️ Настройки воспроизведения YouTube
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                    {/* Выбор режима воспроизведения */}
                    <div className="space-y-3">
                        <h3 className="text-lg font-medium">Режим воспроизведения</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <button
                                onClick={() => {
                                    setPlaybackMode('browser');
                                    saveYoutubeSettings('browser', volume);
                                }}
                                className={`flex items-center justify-center p-4 rounded-lg border-2 transition-colors ${
                                    playbackMode === 'browser' 
                                        ? 'bg-blue-600 border-blue-500 text-white' 
                                        : 'bg-gray-800 border-gray-600 text-gray-300 hover:bg-gray-700'
                                }`}
                            >
                                <div className="text-center">
                                    <div className="text-2xl mb-2">🌐</div>
                                    <div className="text-lg font-medium">Сайт</div>
                                    <div className="text-sm opacity-75">Воспроизведение на сайте</div>
                                </div>
                            </button>
                            <button
                                onClick={async () => {
                                    setPlaybackMode('obs');
                                    saveYoutubeSettings('obs', volume);
                                    // Генерируем URL для OBS если еще нет
                                    if (!youtubeObsUrl) {
                                        await generateYoutubeObsUrl();
                                    }
                                }}
                                className={`flex items-center justify-center p-4 rounded-lg border-2 transition-colors ${
                                    playbackMode === 'obs' 
                                        ? 'bg-purple-600 border-purple-500 text-white' 
                                        : 'bg-gray-800 border-gray-600 text-gray-300 hover:bg-gray-700'
                                }`}
                            >
                                <div className="text-center">
                                    <div className="text-2xl mb-2">📹</div>
                                    <div className="text-lg font-medium">OBS Studio</div>
                                    <div className="text-sm opacity-75">Передача в OBS</div>
                                </div>
                            </button>
                        </div>
                    </div>

                    {/* Описание режимов */}
                    <div className="p-4 bg-gray-800 rounded-lg">
                        {playbackMode === 'browser' ? (
                            <div>
                                <h4 className="font-medium text-blue-300 mb-2">🌐 Режим "Сайт"</h4>
                                <p className="text-sm text-gray-300">
                                    Видео воспроизводятся прямо на сайте в дашборде. 
                                    Управление происходит через интерфейс сайта.
                                </p>
                            </div>
                        ) : (
                            <div>
                                <h4 className="font-medium text-purple-300 mb-2">📹 Режим "OBS Studio"</h4>
                                <p className="text-sm text-gray-300 mb-3">
                                    Видео передаются напрямую в OBS Studio. Управление остается в дашборде, 
                                    но видео и звук выводятся через OBS без лишних элементов интерфейса.
                                </p>
                                
                                {/* URL для OBS */}
                                <div className="mt-4 p-3 bg-gray-700 rounded-lg">
                                    <div className="text-sm font-medium mb-2">URL для OBS Browser Source:</div>
                                    {youtubeObsUrl ? (
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="text"
                                                value={youtubeObsUrl}
                                                readOnly
                                                className="flex-1 p-2 bg-gray-600 border border-gray-500 rounded text-sm font-mono"
                                            />
                                            <Button
                                                size="sm"
                                                onClick={() => {
                                                    navigator.clipboard.writeText(youtubeObsUrl);
                                                    toast.success('URL скопирован в буфер обмена!');
                                                }}
                                            >
                                                Копировать
                                            </Button>
                                        </div>
                                    ) : (
                                        <Button
                                            size="sm"
                                            onClick={generateYoutubeObsUrl}
                                        >
                                            Сгенерировать URL
                                        </Button>
                                    )}
                                    <div className="text-xs text-gray-400 mt-2">
                                        💡 <strong>Инструкция:</strong> Добавьте этот URL как "Browser Source" в OBS Studio. 
                                        Рекомендуемые размеры: 1920x1080.
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Настройки громкости */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-medium">Громкость</h3>
                            <span className="text-lg font-bold text-purple-400 bg-purple-400/10 px-3 py-1 rounded">
                                {volume}%
                            </span>
                        </div>
                        <div className="flex items-center gap-4">
                            <input
                                type="range"
                                min="0"
                                max="100"
                                value={volume}
                                onChange={(e) => {
                                    const newVolume = parseInt(e.target.value);
                                    setVolume(newVolume);
                                    // Debounce сохранение
                                    clearTimeout(window.youtubeVolumeSaveTimeout);
                                    window.youtubeVolumeSaveTimeout = setTimeout(() => {
                                        saveYoutubeSettings(playbackMode, newVolume);
                                    }, 1000);
                                }}
                                className="flex-1 h-3 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
                                style={{
                                    background: `linear-gradient(to right, #8b5cf6 0%, #8b5cf6 ${volume}%, #374151 ${volume}%, #374151 100%)`
                                }}
                            />
                            <style>{`
                                input[type="range"]::-webkit-slider-thumb {
                                    appearance: none;
                                    width: 24px;
                                    height: 24px;
                                    border-radius: 50%;
                                    background: #8b5cf6;
                                    cursor: pointer;
                                    box-shadow: 0 0 8px rgba(139, 92, 246, 0.5);
                                    border: 2px solid #6b21a8;
                                }
                                input[type="range"]::-moz-range-thumb {
                                    width: 24px;
                                    height: 24px;
                                    border-radius: 50%;
                                    background: #8b5cf6;
                                    cursor: pointer;
                                    box-shadow: 0 0 8px rgba(139, 92, 246, 0.5);
                                    border: 2px solid #6b21a8;
                                }
                            `}</style>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

export default YoutubeSettingsPage;
