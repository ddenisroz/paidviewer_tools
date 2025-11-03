import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Play, SkipForward, Trash2, Plus, Search, Clock, User, ExternalLink } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { botService } from '../services/microservices';

const YouTubeQueueCarousel = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [newVideoUrl, setNewVideoUrl] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);

  // React Query: загружаем очередь YouTube
  const { data: queueData = [], isLoading: loading, error: queueError } = useQuery({
    queryKey: ['youtube-queue'],
    queryFn: async () => {
      const response = await botService.get('/api/youtube/queue', {
        withCredentials: true
      });
      const data = response.data;
      // Обрабатываем новый формат ответа
      if (data.current_video && data.queue) {
        return [data.current_video, ...data.queue];
      } else {
        return Array.isArray(data) ? data : [];
      }
    },
    staleTime: 10 * 1000, // 10 секунд
    refetchInterval: 30 * 1000, // Автоматически обновляем каждые 30 секунд
    refetchOnMount: true,
    refetchOnWindowFocus: false,
    onError: (err) => {
      console.error('Error loading queue:', err);
    },
  });

  // React Query мутация: добавление видео
  const addVideoMutation = useMutation({
    mutationFn: async (url) => {
      return await botService.post('/api/youtube/queue', { url }, {
        withCredentials: true
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['youtube-queue'] });
      setNewVideoUrl('');
      setShowAddForm(false);
    },
    onError: (error) => {
      console.error('Error adding video:', error);
    },
  });

  // Добавление видео
  const addVideo = async (url) => {
    if (!url.trim()) return;
    addVideoMutation.mutate(url.trim());
  };

  // React Query мутации для операций с очередью
  const removeVideoMutation = useMutation({
    mutationFn: async (queueId) => {
      return await botService.delete(`/api/youtube/queue/remove/${queueId}`, {
        withCredentials: true
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['youtube-queue'] });
    },
    onError: (error) => {
      console.error('Error removing video:', error);
    },
  });

  const playVideoMutation = useMutation({
    mutationFn: async (video) => {
      return await botService.post('/api/youtube/player/next', {}, {
        withCredentials: true
      });
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['youtube-queue'] });
      // Уведомляем другие вкладки
      window.dispatchEvent(new CustomEvent('youtube_event', {
        detail: {
          event: 'video_played',
          data: { video: variables }
        }
      }));
    },
    onError: (error) => {
      console.error('Error playing video:', error);
    },
  });

  const markAsPlayedMutation = useMutation({
    mutationFn: async (queueId) => {
      return await botService.post(`/api/youtube/queue/mark-played/${queueId}`, {}, {
        withCredentials: true
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['youtube-queue'] });
    },
    onError: (error) => {
      console.error('Error marking as played:', error);
    },
  });

  const clearQueueMutation = useMutation({
    mutationFn: async () => {
      return await botService.post('/api/youtube/clear', {}, {
        withCredentials: true
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['youtube-queue'] });
    },
    onError: (error) => {
      console.error('Error clearing queue:', error);
    },
  });

  // Обертки для функций
  const queue = queueData;
  const error = queueError?.message || null;
  const addingVideo = addVideoMutation.isPending;

  const removeVideo = async (queueId) => {
    removeVideoMutation.mutate(queueId);
  };

  const playVideo = async (video) => {
    playVideoMutation.mutate(video);
  };

  const markAsPlayed = async (queueId) => {
    markAsPlayedMutation.mutate(queueId);
  };

  const clearQueue = async () => {
    if (!confirm('Вы уверены, что хотите очистить всю очередь?')) {
      return;
    }
    clearQueueMutation.mutate();
  };

  // useEffect удален - данные загружаются автоматически через useQuery с refetchInterval

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="flex items-center space-x-3">
                <div className="w-16 h-12 bg-gray-200 rounded"></div>
                <div className="flex-1">
                  <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border">
      {/* Заголовок */}
      <div className="p-4 border-b flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center">
          <Play className="w-5 h-5 mr-2 text-red-500" />
          YouTube Очередь ({queue.length})
        </h3>
        
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            title="Добавить видео"
          >
            <Plus className="w-5 h-5" />
          </button>
          
          {queue.length > 0 && (
            <button
              onClick={clearQueue}
              className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              title="Очистить очередь"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Форма добавления видео */}
      {showAddForm && (
        <div className="p-4 border-b bg-gray-50">
          <div className="flex space-x-2">
            <input
              type="url"
              value={newVideoUrl}
              onChange={(e) => setNewVideoUrl(e.target.value)}
              placeholder="Вставьте YouTube URL..."
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={addingVideo}
            />
            <button
              onClick={() => addVideo(newVideoUrl)}
              disabled={!newVideoUrl.trim() || addingVideo}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {addingVideo ? 'Добавление...' : 'Добавить'}
            </button>
          </div>
        </div>
      )}

      {/* Ошибка */}
      {error && (
        <div className="p-4 border-b bg-red-50 border-red-200">
          <p className="text-sm text-red-600">{error}</p>
          <button
            onClick={() => setError(null)}
            className="text-xs text-red-500 hover:text-red-700 underline"
          >
            Закрыть
          </button>
        </div>
      )}

      {/* Очередь видео */}
      <div className="max-h-96 overflow-y-auto">
        {queue.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <Play className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p className="text-lg font-medium mb-2">Очередь пуста</p>
            <p className="text-sm">Добавьте YouTube видео, чтобы начать</p>
            {!showAddForm && (
              <button
                onClick={() => setShowAddForm(true)}
                className="mt-3 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Добавить видео
              </button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {queue.map((video, index) => (
              <div key={video.id} className="p-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-start space-x-3">
                  {/* Позиция */}
                  <div className="flex-shrink-0 w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-sm font-medium text-gray-600">
                    {index + 1}
                  </div>

                  {/* Превью */}
                  <div className="flex-shrink-0">
                    <div className="w-16 h-12 bg-gray-200 rounded overflow-hidden">
                      {video.thumbnail_url ? (
                        <img
                          src={video.thumbnail_url}
                          alt={video.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Play className="w-6 h-6 text-gray-400" />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Информация о видео */}
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-medium text-gray-900 truncate" title={video.title}>
                      {video.title}
                    </h4>
                    
                    <div className="mt-1 flex items-center space-x-3 text-xs text-gray-500">
                      {video.duration && (
                        <span className="flex items-center">
                          <Clock className="w-3 h-3 mr-1" />
                          {video.duration}
                        </span>
                      )}
                      
                      <span className="flex items-center">
                        <User className="w-3 h-3 mr-1" />
                        {video.requester_name}
                      </span>
                      
                      {video.platform && (
                        <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">
                          {video.platform === 'twitch' ? 'Twitch' : video.platform === 'vk' ? 'VK Live' : video.platform}
                        </span>
                      )}
                      
                      {video.is_paid && video.points_cost && (
                        <span className="px-3 py-1 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded text-xs font-medium shadow-sm">
                          💚 {video.points_cost} баллов
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Действия */}
                  <div className="flex-shrink-0 flex items-center space-x-1">
                    <a
                      href={video.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                      title="Открыть на YouTube"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                    
                    {index === 0 && (
                      <button
                        onClick={() => markAsPlayed(video.id)}
                        className="p-1.5 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded transition-colors"
                        title="Отметить как проигранное"
                      >
                        <SkipForward className="w-4 h-4" />
                      </button>
                    )}
                    
                    <button
                      onClick={() => playVideo(video)}
                      className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                      title="Воспроизвести это видео"
                    >
                      <Play className="w-4 h-4" />
                    </button>
                    
                    <button
                      onClick={() => removeVideo(video.id)}
                      className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                      title="Удалить из очереди"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Подсказка */}
      {queue.length > 0 && (
        <div className="p-3 border-t bg-gray-50 text-xs text-gray-600">
          💡 Используйте команду <code className="bg-gray-200 px-1 rounded">!sr &lt;YouTube URL&gt;</code> в чате для добавления видео
        </div>
      )}
    </div>
  );
};

export default YouTubeQueueCarousel;
