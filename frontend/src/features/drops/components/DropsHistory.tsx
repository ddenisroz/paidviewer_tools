import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { useQueryClient } from '@tanstack/react-query';
import { History, RefreshCw, Search } from 'lucide-react';

import { useDropsHistory } from '@/queries/drops/dropsQueries';
import { queryKeys } from '@/queries/queryKeys';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Input } from '@/shared/components/ui/input';



interface DropsHistoryProps {
    user: Record<string, unknown>;
    channelName: string;
}

interface HistoryEntry {
    id: string | number;
    viewer_name: string;
    reward_name?: string;
    drops_type?: string;
    quality?: {
        name?: string;
        color?: string;
    };
    streak_days?: number;
    donation_amount?: number;
    messages_count?: number;
    created_at?: string;
}

const SURFACE_CARD_CLASS = 'card-glass border-border/70 bg-card/75 backdrop-blur-sm shadow-sm shadow-black/10';

const DropsHistory: React.FC<DropsHistoryProps> = React.memo(({ user, channelName }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [offset, setOffset] = useState(0);
  const [allHistory, setAllHistory] = useState<HistoryEntry[]>([]);
  const limit = 50;
  const queryClient = useQueryClient();

  // [OK] НОВЫЙ КОД: �?спользуем централизованный hook для загрузки истории
  const { data: historyData, isLoading: loading, refetch } = useDropsHistory(
    channelName,
    { limit, offset },
    {
      enabled: !!user && !!channelName,
    }
  );

  // Объединяем историю при изменении offset
  useEffect(() => {
    if (historyData) {
      if (offset === 0) {
        setAllHistory(historyData.data || []);
      } else {
        setAllHistory(prev => [...prev, ...(historyData.data || [])]);
      }
    }
  }, [historyData, offset]);

  const hasMore = historyData?.hasMore || false;
  const history = allHistory;

  const handleLoadMore = useCallback(() => {
    if (!loading && hasMore) {
      setOffset(prev => prev + limit);
    }
  }, [loading, hasMore, limit]);

  const handleRefresh = useCallback(() => {
    setOffset(0);
    setAllHistory([]);
    queryClient.invalidateQueries({ queryKey: queryKeys.drops.history(channelName) });
    refetch();
  }, [channelName, queryClient, refetch]);

  // [OK] OPTIMIZATION: Memoize filtered history to avoid recalculation on every render
  const filteredHistory = useMemo(() => 
    history.filter(entry => 
      entry.viewer_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (entry.reward_name?.toLowerCase() ?? '').includes(searchQuery.toLowerCase())
    ),
    [history, searchQuery]
  );

  // [OK] OPTIMIZATION: Memoize utility functions
  const getQualityColor = useCallback((quality?: { name?: string }): string => {
    switch (quality?.name?.toLowerCase()) {
      case 'common':
        return 'from-gray-500 to-gray-600';
      case 'rare':
        return 'from-blue-500 to-blue-600';
      case 'epic':
        return 'from-purple-500 to-purple-600';
      case 'legendary':
        return 'from-yellow-500 to-yellow-600';
      case 'mythical':
      case 'mythyc':
        return 'from-pink-500 to-pink-600';
      default:
        return 'from-gray-500 to-gray-600';
    }
  }, []);

  const formatDate = useCallback((dateString: string | undefined): string => {
    if (!dateString) return 'Не указано';
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('ru-RU', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  }, []);

  const getDropsTypeLabel = useCallback((type: string | undefined): string => {
    if (!type) return 'Неизвестно';
    switch (type) {
      case 'streak':
        return 'Стрик';
      case 'donation':
        return 'Донат';
      case 'mythical':
        return 'Мифический';
      default:
        return type;
    }
  }, []);

  return (
    <Card className={SURFACE_CARD_CLASS}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <History className="w-5 h-5" />
              �?стория наград
            </CardTitle>
            <CardDescription className="mt-1">
              Последние выдачи ({history.length})
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={loading}
            className="gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Обновить
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Поиск */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Поиск по зрителю или награде..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* �?стория */}
        <div className="space-y-2 max-h-[min(600px,70vh)] overflow-y-auto">
          {filteredHistory.length === 0 && !loading ? (
            <div className="text-center py-12 text-muted-foreground">
              <History className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>�?стория пуста</p>
              <p className="text-xs mt-1">Награды появятся здесь после первых выдач</p>
            </div>
          ) : (
            <>
              {filteredHistory.map((entry) => (
                <div 
                  key={entry.id}
                  className="flex items-center gap-4 p-4 border border-border/70 rounded-lg bg-card/60 hover:bg-card/70 transition-colors"
                >
                  {/* Качество */}
                  <div className="flex-shrink-0">
                    <div 
                      className={`w-12 h-12 rounded-lg bg-gradient-to-br ${getQualityColor(entry.quality)} flex items-center justify-center`}
                    >
                      <Badge 
                        className={`text-xs bg-transparent text-white font-bold border-2 border-white/30`}
                      >
                        {entry.quality?.name?.charAt(0) || '?'}
                      </Badge>
                    </div>
                  </div>

                  {/* �?нформация */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-semibold truncate">{entry.viewer_name}</h4>
                      <Badge variant="outline" className="text-xs">
                        {getDropsTypeLabel(entry.drops_type)}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2 break-words">
                      {entry.reward_name ?? 'Неизвестная награда'}
                    </p>
                    <div className="flex items-center gap-4 mt-2">
                      {entry.streak_days && (
                        <span className="text-xs text-muted-foreground">
                          Стрик: {entry.streak_days} дней
                        </span>
                      )}
                      {entry.donation_amount && (
                        <span className="text-xs text-muted-foreground">
                          {entry.donation_amount}в‚Ѕ
                        </span>
                      )}
                      {entry.messages_count && (
                        <span className="text-xs text-muted-foreground">
                          {entry.messages_count} сообщений
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Дата */}
                  <div className="flex-shrink-0 text-right">
                    <p className="text-sm font-medium">{formatDate(entry.created_at)}</p>
                    <Badge
                      variant="secondary"
                      style={{ backgroundColor: entry.quality?.color, opacity: 0.2 }}
                      className="text-xs mt-1"
                    >
                      {entry.quality?.name || 'Unknown'}
                    </Badge>
                  </div>
                </div>
              ))}
            </>
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
});

export default DropsHistory;



