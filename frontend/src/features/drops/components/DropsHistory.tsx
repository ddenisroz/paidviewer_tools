import React, { useCallback, useEffect, useMemo, useState } from 'react';

import { useQueryClient } from '@tanstack/react-query';
import { History, RefreshCw, Search } from 'lucide-react';

import { useDropsHistory } from '@/queries/drops/dropsQueries';
import { queryKeys } from '@/queries/queryKeys';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Input } from '@/shared/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/components/ui/select';

interface DropsHistoryProps {
  user: Record<string, unknown>;
  channelName: string;
}

interface HistoryEntry {
  id: string | number;
  viewer_name: string;
  platform?: 'twitch' | 'vk' | string;
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
const BLUE_TEXT_BUTTON_CLASS = 'border-border/70 bg-transparent text-sky-300 hover:bg-transparent hover:text-sky-200';

const DropsHistory: React.FC<DropsHistoryProps> = React.memo(({ user, channelName }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'streak' | 'donation' | 'mythical'>('all');
  const [platformFilter, setPlatformFilter] = useState<'all' | 'twitch' | 'vk'>('all');
  const [offset, setOffset] = useState(0);
  const [allHistory, setAllHistory] = useState<HistoryEntry[]>([]);
  const limit = 50;
  const queryClient = useQueryClient();

  const { data: historyData, isLoading: loading, refetch } = useDropsHistory(
    channelName,
    { limit, offset },
    {
      enabled: !!user && !!channelName,
    }
  );

  useEffect(() => {
    if (historyData) {
      if (offset === 0) {
        setAllHistory(historyData.data || []);
      } else {
        setAllHistory((prev) => [...prev, ...(historyData.data || [])]);
      }
    }
  }, [historyData, offset]);

  const hasMore = historyData?.hasMore || false;
  const history = allHistory;

  const handleLoadMore = useCallback(() => {
    if (!loading && hasMore) {
      setOffset((prev) => prev + limit);
    }
  }, [loading, hasMore]);

  const handleRefresh = useCallback(() => {
    setOffset(0);
    setAllHistory([]);
    queryClient.invalidateQueries({ queryKey: queryKeys.drops.history(channelName) });
    refetch();
  }, [channelName, queryClient, refetch]);

  const filteredHistory = useMemo(
    () =>
      history.filter((entry) => {
        const query = searchQuery.toLowerCase();
        const matchesSearch =
          entry.viewer_name.toLowerCase().includes(query) ||
          (entry.reward_name?.toLowerCase() ?? '').includes(query);
        const matchesType = typeFilter === 'all' || (entry.drops_type || '').toLowerCase() === typeFilter;
        const matchesPlatform = platformFilter === 'all' || (entry.platform || '').toLowerCase() === platformFilter;
        return matchesSearch && matchesType && matchesPlatform;
      }),
    [history, searchQuery, typeFilter, platformFilter]
  );

  const formatDate = useCallback((dateString: string | undefined): string => {
    if (!dateString) return 'Не указано';
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('ru-RU', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
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

  const getPlatformLabel = useCallback((platform: string | undefined): string => {
    if (!platform) return 'Unknown';
    return platform.toLowerCase() === 'vk' ? 'VK Live' : 'Twitch';
  }, []);

  return (
    <Card className={SURFACE_CARD_CLASS}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              История наград
            </CardTitle>
            <CardDescription className="mt-1">Записей: {history.length}</CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={loading}
            className={`gap-2 ${BLUE_TEXT_BUTTON_CLASS}`}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Обновить
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-2 md:grid-cols-[minmax(240px,1fr)_190px_170px]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Поиск по зрителю или награде..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="border-border/70 bg-transparent pl-9"
            />
          </div>

          <Select value={typeFilter} onValueChange={(value) => setTypeFilter(value as typeof typeFilter)}>
            <SelectTrigger className="h-9 border-border/70 bg-transparent text-sky-300">
              <SelectValue placeholder="Тип" />
            </SelectTrigger>
            <SelectContent className="border-border/70 bg-popover/95">
              <SelectItem value="all">Все типы</SelectItem>
              <SelectItem value="streak">Стрик</SelectItem>
              <SelectItem value="donation">Донат</SelectItem>
              <SelectItem value="mythical">Мифический</SelectItem>
            </SelectContent>
          </Select>

          <Select value={platformFilter} onValueChange={(value) => setPlatformFilter(value as typeof platformFilter)}>
            <SelectTrigger className="h-9 border-border/70 bg-transparent text-sky-300">
              <SelectValue placeholder="Платформа" />
            </SelectTrigger>
            <SelectContent className="border-border/70 bg-popover/95">
              <SelectItem value="all">Все платформы</SelectItem>
              <SelectItem value="twitch">Twitch</SelectItem>
              <SelectItem value="vk">VK Live</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2.5 max-h-[min(620px,72vh)] overflow-y-auto">
          {filteredHistory.length === 0 && !loading ? (
            <div className="rounded-xl border border-border/70 bg-transparent py-12 text-center text-muted-foreground">
              <History className="mx-auto mb-3 h-10 w-10 opacity-60" />
              <p>История пока пуста</p>
              <p className="mt-1 text-xs">Записи появятся после первых выдач</p>
            </div>
          ) : (
            filteredHistory.map((entry) => (
              <div
                key={entry.id}
                className="grid items-center gap-3 rounded-xl border border-border/70 bg-transparent p-3 md:grid-cols-[minmax(0,1fr)_220px]"
              >
                <div className="min-w-0 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-semibold text-foreground">{entry.viewer_name}</p>
                    <Badge variant="outline" className="border-border/70 bg-transparent text-sky-300">
                      {getDropsTypeLabel(entry.drops_type)}
                    </Badge>
                    <Badge variant="outline" className="border-border/70 bg-transparent text-muted-foreground">
                      {getPlatformLabel(entry.platform)}
                    </Badge>
                  </div>
                  <p className="line-clamp-2 text-sm text-muted-foreground">{entry.reward_name || 'Награда без названия'}</p>
                  <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                    {entry.streak_days ? <span>Стрик: {entry.streak_days}</span> : null}
                    {entry.donation_amount ? <span>Донат: {entry.donation_amount}₽</span> : null}
                    {entry.messages_count ? <span>Сообщений: {entry.messages_count}</span> : null}
                  </div>
                </div>

                <div className="space-y-1 text-right">
                  <p className="text-sm text-foreground">{formatDate(entry.created_at)}</p>
                  <Badge variant="outline" className="border-border/70 bg-transparent text-xs text-muted-foreground">
                    {entry.quality?.name || 'Unknown'}
                  </Badge>
                </div>
              </div>
            ))
          )}
        </div>

        {hasMore ? (
          <div className="flex justify-center pt-2">
            <Button variant="outline" onClick={handleLoadMore} disabled={loading} className={BLUE_TEXT_BUTTON_CLASS}>
              {loading ? 'Загрузка...' : 'Загрузить еще'}
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
});

export default DropsHistory;
