// src/shared/utils/dashboardHelpers.ts
/**
 * Вспомогательные функции для карточек и индикаторов dashboard.
 */

import { Activity, MessageCircle, Mic, Users } from 'lucide-react';

import type { StatsCardProps } from '@/shared/components/StatsCard';

export interface DashboardStats {
    total_users?: number;
    active_users?: number;
    total_messages?: number;
    tts_requests?: number;
    bots?: {
        twitch_online?: boolean;
        twitch_connections?: number;
        vk_online?: boolean;
        vk_connections?: number;
    };
    system?: {
        storage_used_gb?: number;
        storage_total_gb?: number;
    };
}

export { StatsCardProps as StatCard };

export function createStatsCards(
    stats: DashboardStats | undefined,
    _navigate: (path: string) => void
): StatsCardProps[] {
    if (!stats) return [];

    return [
        {
            title: 'Пользователи',
            value: stats.total_users || 0,
            icon: Users,
            color: 'text-blue-400',
        },
        {
            title: 'Активные',
            value: stats.active_users || 0,
            icon: Activity,
            color: 'text-green-400',
        },
        {
            title: 'Сообщения',
            value: stats.total_messages || 0,
            icon: MessageCircle,
            color: 'text-purple-400',
        },
        {
            title: 'TTS запросы',
            value: stats.tts_requests || 0,
            icon: Mic,
            color: 'text-orange-400',
        },
    ];
}

export function calculateStoragePercent(stats: DashboardStats | undefined): number {
    if (!stats?.system?.storage_total_gb) return 0;
    return ((stats.system.storage_used_gb || 0) / stats.system.storage_total_gb) * 100;
}

export function getStorageColorClass(percent: number): string {
    if (percent >= 90) return 'bg-red-500';
    if (percent >= 70) return 'bg-yellow-500';
    return 'bg-green-500';
}
