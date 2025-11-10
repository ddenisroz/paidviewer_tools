import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Search, Trophy, TrendingUp, Calendar, AlertCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useDropsConfig } from '../../queries/drops/dropsQueries';
import { dropsService } from '../../services/api/services/dropsService';
import { toast } from 'sonner';
import { logger } from '../../utils/prodLogger';

const StreakTracker = ({ user, channelName }) => {
  const [streaks, setStreaks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const limit = 50;

  // Check if streak is enabled (общий конфиг, без platform)
  const { data: config } = useDropsConfig(channelName);

  // Проверяем, включен ли стрик хотя бы на одной платформе
  const streakEnabled = (config?.streak_enabled_twitch || config?.streak_enabled_vk) ?? false;

  useEffect(() => {
    // Load streaks always if we have required data (общая статистика для всех платформ)
    if (user && channelName) {
      loadStreaks(true);
    } else {
      // Clear streaks if missing required data
      setStreaks([]);
      setHasMore(false);
    }
  }, [user, channelName, streakEnabled]);

  const loadStreaks = async (reset = false) => {
    // Do not load if missing required data
    if (!user || !channelName) {
      setStreaks([]);
      setHasMore(false);
      return;
    }

    const currentOffset = reset ? 0 : offset;

    try {
      setLoading(true);
      // 🚀 FIX: Загружаем общую статистику стриков (без фильтрации по platform)
      const response = await dropsService.getStreaks(channelName, {
        limit, 
        offset: currentOffset 
      });
      
      if (response.data.success) {
        const newStreaks = response.data.data || [];
        if (newStreaks.length === 0) {
          setStreaks([]);
          setHasMore(false);
        } else {
          setStreaks(reset ? newStreaks : [...streaks, ...newStreaks]);
          setHasMore(newStreaks.length === limit);
        }
        if (reset) setOffset(0);
      }
    } catch (error) {
      logger.error('Error loading streaks:', error);
      toast.error('Ошибка загрузки стриков');
      setStreaks([]);
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  };

  const handleLoadMore = () => {
    if (!loading && hasMore) {
      setOffset(prev => prev + limit);
      loadStreaks(false);
    }
  };

  const filteredStreaks = streaks.filter(streak => 
    streak.viewer_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('ru-RU', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  const getStreakColor = (days) => {
    if (days >= 60) return 'from-yellow-500 to-orange-600';
    if (days >= 30) return 'from-purple-500 to-pink-600';
    if (days >= 14) return 'from-blue-500 to-cyan-600';
    if (days >= 7) return 'from-green-500 to-emerald-600';
    return 'from-gray-500 to-gray-600';
  };

  const getStreakBadge = (days) => {
    if (days >= 60) return { text: 'Легенда', emoji: '👑' };
    if (days >= 30) return { text: 'Эпик', emoji: '💎' };
    if (days >= 14) return { text: 'Мастер', emoji: '🏆' };
    if (days >= 7) return { text: 'Активный', emoji: '⭐' };
    return { text: 'Новичок', emoji: '🌱' };
  };


  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5" />
          Стрики зрителей
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Поиск */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Поиск по имени зрителя..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Таблица стриков */}
        <div className="border rounded-lg overflow-hidden">
          {filteredStreaks.length === 0 && !loading ? (
            <div className="text-center py-12 text-muted-foreground">
              <Trophy className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Нет активных стриков</p>
              <p className="text-xs mt-1">Стрики появятся когда зрители начнут активно участвовать</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-muted">
                  <tr>
                    <th className="text-left p-3 font-medium text-sm">#</th>
                    <th className="text-left p-3 font-medium text-sm">Зритель</th>
                    <th className="text-center p-3 font-medium text-sm">Текущий</th>
                    <th className="text-center p-3 font-medium text-sm">Максимум</th>
                    <th className="text-center p-3 font-medium text-sm">Сообщений</th>
                    <th className="text-right p-3 font-medium text-sm">Активность</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredStreaks.map((streak, index) => {
                    const badge = getStreakBadge(streak.current_streak);
                    const colorClass = getStreakColor(streak.current_streak);
                    
                    return (
                      <tr key={`${streak.viewer_name}-${streak.current_streak}`} className="hover:bg-muted/50 transition-colors">
                        <td className="p-3 text-sm text-muted-foreground">
                          {index + 1}
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{streak.viewer_name}</span>
                            <Badge 
                              variant="outline" 
                              className={`text-xs bg-gradient-to-r ${colorClass} border-transparent text-white`}
                            >
                              {badge.emoji} {badge.text}
                            </Badge>
                          </div>
                        </td>
                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <span className="text-base font-semibold">{streak.current_streak}</span>
                            <span className="text-xs text-muted-foreground">стримов</span>
                          </div>
                        </td>
                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <span className="text-base font-semibold">{streak.max_streak}</span>
                            <span className="text-xs text-muted-foreground">стримов</span>
                          </div>
                        </td>
                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <span className="text-base font-semibold">{streak.messages_this_stream}</span>
                            <span className="text-xs text-muted-foreground">сообщ.</span>
                          </div>
                        </td>
                        <td className="p-3 text-right">
                          <div className="flex items-center justify-end gap-1 text-xs text-muted-foreground">
                            <Calendar className="w-3 h-3" />
                            {formatDate(streak.last_activity)}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Загрузить еще */}
        {hasMore && (
          <div className="flex justify-center pt-4">
            <Button
              variant="outline"
              onClick={handleLoadMore}
              disabled={loading}
            >
              {loading ? 'Загрузка...' : 'Загрузить еще'}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default StreakTracker;

