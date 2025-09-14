import React, { useState, useEffect } from 'react';
import { Play, SkipForward, Volume2, Plus, X, ExternalLink, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useIntegrations } from '../../hooks/useIntegrations';
import { useNavigate } from 'react-router-dom';

const YoutubeIntegrationPage = () => {
    const { integrations } = useIntegrations();
    const navigate = useNavigate();
    const [queue, setQueue] = useState([]);
    const [currentVideo, setCurrentVideo] = useState(null);
    const [newVideoUrl, setNewVideoUrl] = useState('');
    const [isPlaying, setIsPlaying] = useState(false);

    // Проверяем доступность функции на основе интеграций
    const hasTwitchIntegration = integrations.twitch_enabled;
    const hasVkIntegration = integrations.vk_enabled;
    const isFunctionEnabled = hasTwitchIntegration || hasVkIntegration;

    // Загружаем реальные данные из API
    useEffect(() => {
        if (isFunctionEnabled) {
            loadQueue();
        } else {
            setQueue([]);
            setCurrentVideo(null);
        }
    }, [isFunctionEnabled]);

    const loadQueue = async () => {
        try {
            // Здесь будет реальный API вызов для загрузки очереди
            // const response = await api.get('/api/youtube/queue');
            // setQueue(response.data);
            // setCurrentVideo(response.data[0] || null);
            
            // Пока что показываем пустую очередь
            setQueue([]);
            setCurrentVideo(null);
        } catch (error) {
            console.error('Error loading YouTube queue:', error);
            setQueue([]);
            setCurrentVideo(null);
        }
    };

    const handleAddVideo = () => {
        if (!newVideoUrl.trim()) return;
        
        // В реальной реализации здесь будет API вызов для получения информации о видео
        const newVideo = {
            id: Date.now().toString(),
            title: 'Новое видео',
            thumbnail: 'https://img.youtube.com/vi/dQw4w9WgXcQ/maxresdefault.jpg',
            duration: '2:30',
            requestedBy: 'admin'
        };
        
        setQueue([...queue, newVideo]);
        setNewVideoUrl('');
    };

    const handleNextVideo = () => {
        const currentIndex = queue.findIndex(v => v.id === currentVideo?.id);
        if (currentIndex < queue.length - 1) {
            setCurrentVideo(queue[currentIndex + 1]);
        }
    };

    const handleRemoveFromQueue = (videoId) => {
        setQueue(queue.filter(v => v.id !== videoId));
    };

    // Если функция недоступна, показываем сообщение
    if (!isFunctionEnabled) {
        return (
            <div className="flex flex-col items-center justify-center h-96 gap-4">
                <div className="text-center">
                    <h2 className="text-2xl font-bold text-foreground mb-2">
                        Интеграция с Twitch/VK отключена
                    </h2>
                    <p className="text-muted-foreground mb-6">
                        Включите интеграцию с Twitch или VK в настройках, чтобы использовать YouTube функции
                    </p>
                    <Button 
                        className="flex items-center gap-2 mx-auto"
                        onClick={() => navigate('/dashboard/settings')}
                    >
                        <Settings className="h-4 w-4" />
                        Открыть настройки интеграций
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="container mx-auto p-6 space-y-6">
            <div className="mb-6">
                <h1 className="text-3xl font-bold text-foreground mb-2">Youtube Интеграция</h1>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Плеер */}
                <Card className="lg:col-span-2">
                    <CardHeader>
                        <CardTitle>Текущее видео</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {currentVideo ? (
                            <div className="space-y-4">
                                {/* Видео плеер (заглушка) */}
                                <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
                                    <img 
                                        src={currentVideo.thumbnail} 
                                        alt={currentVideo.title}
                                        className="w-full h-full object-cover"
                                    />
                                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                                        <Button
                                            size="lg"
                                            onClick={() => setIsPlaying(!isPlaying)}
                                            className="rounded-full w-16 h-16"
                                        >
                                            <Play className="h-6 w-6" />
                                        </Button>
                                    </div>
                                </div>
                                
                                {/* Информация о видео */}
                                <div>
                                    <h3 className="font-semibold text-lg">{currentVideo.title}</h3>
                                    <p className="text-sm text-muted-foreground">
                                        Заказано: {currentVideo.requestedBy} • {currentVideo.duration}
                                    </p>
                                </div>

                                {/* Управление */}
                                <div className="flex gap-2 flex-wrap">
                                    <Button onClick={handleNextVideo}>
                                        <SkipForward className="h-4 w-4 mr-2" />
                                        Следующее
                                    </Button>
                                    <Button variant="outline">
                                        <Volume2 className="h-4 w-4 mr-2" />
                                        Громкость
                                    </Button>
                                </div>

                                {/* Добавление видео */}
                                <div className="pt-4 border-t">
                                    <h4 className="font-medium mb-3">Добавить видео</h4>
                                    <div className="flex gap-2">
                                        <Input
                                            placeholder="YouTube URL"
                                            value={newVideoUrl}
                                            onChange={(e) => setNewVideoUrl(e.target.value)}
                                        />
                                        <Button onClick={handleAddVideo}>
                                            <Plus className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>

                                {/* Команды для чата */}
                                <div className="p-4 bg-muted rounded-lg">
                                    <h4 className="font-medium mb-2">Команды для чата:</h4>
                                    <div className="space-y-1 text-sm font-mono">
                                        <div><code>!sr [youtube_url]</code> - заказать видео</div>
                                        <div><code>!skip</code> - пропустить текущее видео</div>
                                        <div><code>!pause</code> - поставить на паузу/возобновить</div>
                                        <div><code>!volume [0-100]</code> - изменить громкость</div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="text-center py-8 text-muted-foreground">
                                <p>Нет видео в очереди</p>
                                <p className="text-sm">Добавьте видео или попросите зрителей использовать команду !sr</p>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Вертикальная очередь видео */}
                <Card className="lg:col-span-1">
                    <CardHeader>
                        <CardTitle>Очередь видео ({queue.length})</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        {queue.length > 0 ? (
                            <div className="h-[600px] overflow-y-auto">
                                <div className="p-4 space-y-3">
                                    {queue.map((video, index) => (
                                        <div key={video.id} className="relative group">
                                            <div className={`border rounded-lg overflow-hidden transition-colors ${
                                                currentVideo?.id === video.id 
                                                    ? 'border-primary bg-primary/5' 
                                                    : 'border-border hover:border-primary/50'
                                            }`}>
                                                <div className="flex gap-3 p-3">
                                                    {/* Thumbnail */}
                                                    <div className="relative w-20 h-16 flex-shrink-0">
                                                        <img 
                                                            src={video.thumbnail} 
                                                            alt={video.title}
                                                            className="w-full h-full object-cover rounded"
                                                        />
                                                        <div className="absolute top-1 left-1 bg-black/70 text-white text-xs px-1 py-0.5 rounded">
                                                            #{index + 1}
                                                        </div>
                                                        <div className="absolute bottom-1 right-1 bg-black/70 text-white text-xs px-1 py-0.5 rounded">
                                                            {video.duration}
                                                        </div>
                                                    </div>
                                                    
                                                    {/* Info */}
                                                    <div className="flex-1 min-w-0">
                                                        <h4 className="font-medium text-sm line-clamp-2 mb-1">{video.title}</h4>
                                                        <p className="text-xs text-muted-foreground">от {video.requestedBy}</p>
                                                        
                                                        {/* Кнопка удаления */}
                                                        <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            className="mt-2 h-6 text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                                                            onClick={() => handleRemoveFromQueue(video.id)}
                                                        >
                                                            <X className="h-3 w-3 mr-1" />
                                                            Удалить
                                                        </Button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <div className="text-center py-8 text-muted-foreground p-4">
                                <p>Очередь пуста</p>
                                <p className="text-sm">Используйте команду !sr в чате</p>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

export default YoutubeIntegrationPage;
