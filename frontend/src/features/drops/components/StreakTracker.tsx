import React, { useEffect, useState } from 'react';

import { Calendar, Search, TrendingUp, Trophy } from 'lucide-react';

import { useDropsConfig } from '@/queries/drops/dropsQueries';
import { dropsService } from '@/services/api/services/dropsService';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Input } from '@/shared/components/ui/input';
import { formatAppDateTime } from '@/shared/utils/dateTime';
import { logger } from '@/shared/utils/prodLogger';
import { toast } from '@/utils/toastManager';

import type { Streak } from '../../../types';

interface StreakTrackerProps {
    user: Record<string, unknown>;
    channelName: string;
}

const SURFACE_CARD_CLASS = 'border-border/70 bg-card/90 shadow-sm shadow-black/10';
const BLUE_TEXT_BUTTON_CLASS = 'border-border/70 bg-transparent text-sky-300 hover:bg-transparent hover:text-sky-200';

const StreakTracker: React.FC<StreakTrackerProps> = ({ user, channelName }) => {
    const [streaks, setStreaks] = useState<Streak[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [hasMore, setHasMore] = useState(true);
    const limit = 50;

    // Check if streak is enabled (общий конфиг, без platform)
    const { data: config } = useDropsConfig(channelName);

    // Проверяем, включен ли стрик хотя бы на одной платформе
    const streakEnabled = (config?.streak_enabled_twitch || config?.streak_enabled_vk) ?? false;

    const loadStreaks = React.useCallback(
        async (reset = false, targetOffset = 0) => {
            // Do not load if missing required data
            if (!user || !channelName) {
                setStreaks([]);
                setHasMore(false);
                return;
            }

            const currentOffset = reset ? 0 : targetOffset;

            try {
                setLoading(true);
                // [START] FIX: Загружаем общую статистику стриков (без фильтрации по platform)
                const response = await dropsService.getStreaks(channelName, {
                    limit,
                    offset: currentOffset,
                });

                if (response.data.success) {
                    const newStreaks = response.data.data || [];
                    if (newStreaks.length === 0) {
                        setStreaks([]);
                        setHasMore(false);
                    } else {
                        setStreaks((prev) => (reset ? newStreaks : [...prev, ...newStreaks]));
                        setHasMore(newStreaks.length === limit);
                    }
                }
            } catch (error) {
                logger.error('Error loading streaks:', error);
                toast.error('Ошибка загрузки стриков');
                setStreaks([]);
                setHasMore(false);
            } finally {
                setLoading(false);
            }
        },
        [user, channelName, limit]
    );

    useEffect(() => {
        // Load streaks always if we have required data (общая статистика для всех платформ)
        if (user && channelName) {
            void loadStreaks(true, 0);
        } else {
            // Clear streaks if missing required data
            setStreaks([]);
            setHasMore(false);
        }
    }, [user, channelName, streakEnabled, loadStreaks]);

    const handleLoadMore = () => {
        if (!loading && hasMore) {
            void loadStreaks(false, streaks.length);
        }
    };

    const filteredStreaks = streaks.filter((streak) =>
        streak.viewer_name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const formatDate = (dateString: string | undefined) => {
        if (!dateString) return 'Не активно';
        return formatAppDateTime(dateString, {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const getStreakColor = (days: number): string => {
        if (days >= 60) return 'from-yellow-500 to-orange-600';
        if (days >= 30) return 'from-purple-500 to-pink-600';
        if (days >= 14) return 'from-blue-500 to-cyan-600';
        if (days >= 7) return 'from-green-500 to-emerald-600';
        return 'from-gray-500 to-gray-600';
    };

    const getStreakBadge = (days: number): { text: string; emoji: string } => {
        if (days >= 60) return { text: 'Легенда', emoji: '👑' };
        if (days >= 30) return { text: 'Эпик', emoji: '💎' };
        if (days >= 14) return { text: 'Мастер', emoji: '🏆' };
        if (days >= 7) return { text: 'Активный', emoji: '⭐' };
        return { text: 'Новичок', emoji: '🌱' };
    };

    return (
        <Card className={SURFACE_CARD_CLASS}>
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
                        className="border-border/70 bg-transparent pl-9"
                    />
                </div>

                {/* Таблица стриков */}
                <div className="border border-border/70 rounded-xl overflow-hidden bg-transparent">
                    {filteredStreaks.length === 0 && !loading ? (
                        <div className="text-center py-12 text-muted-foreground">
                            <Trophy className="w-12 h-12 mx-auto mb-4 opacity-50" />
                            <p>Нет активных стриков</p>
                            <p className="text-xs mt-1">Появятся после первых активностей в чате</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-transparent">
                                    <tr>
                                        <th className="text-left p-3 font-medium text-sm">#</th>
                                        <th className="text-left p-3 font-medium text-sm">Зритель</th>
                                        <th className="text-center p-3 font-medium text-sm">Текущий</th>
                                        <th className="text-center p-3 font-medium text-sm">Максимум</th>
                                        <th className="text-center p-3 font-medium text-sm">Сообщений</th>
                                        <th className="text-right p-3 font-medium text-sm">Активность</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border/60">
                                    {filteredStreaks.map((streak, index) => {
                                        const badge = getStreakBadge(streak.current_streak);
                                        const colorClass = getStreakColor(streak.current_streak);

                                        return (
                                            <tr
                                                key={`${streak.viewer_name}-${streak.current_streak}`}
                                                className="hover:bg-card/40 transition-colors"
                                            >
                                                <td className="p-3 text-sm text-muted-foreground">{index + 1}</td>
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
                                                        <span className="text-base font-semibold">
                                                            {streak.current_streak}
                                                        </span>
                                                        <span className="text-xs text-muted-foreground">стримов</span>
                                                    </div>
                                                </td>
                                                <td className="p-3 text-center">
                                                    <div className="flex items-center justify-center gap-1">
                                                        <span className="text-base font-semibold">
                                                            {streak.max_streak}
                                                        </span>
                                                        <span className="text-xs text-muted-foreground">стримов</span>
                                                    </div>
                                                </td>
                                                <td className="p-3 text-center">
                                                    <div className="flex items-center justify-center gap-1">
                                                        <span className="text-base font-semibold">
                                                            {streak.messages_this_stream}
                                                        </span>
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
                            className={BLUE_TEXT_BUTTON_CLASS}
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
