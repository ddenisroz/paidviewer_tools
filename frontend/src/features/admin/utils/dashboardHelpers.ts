// Helper functions for AdminDashboard to reduce complexity

import { Activity, AlertTriangle, Mic, Users } from 'lucide-react';

import type { StatsCardProps } from '@/shared/components';

export interface DashboardStats {
  users?: {
    total?: number;
    active_today?: number;
    active_week?: number;
    new_this_month?: number;
  };
  tts?: {
    requests_today?: number;
    requests_week?: number;
    requests_month?: number;
  };
  bots?: {
    twitch_online?: boolean;
    vk_online?: boolean;
    total_connections?: number;
    twitch_connections?: number;
    vk_connections?: number;
  };
  system?: {
    errors_24h?: number;
    storage_used_gb?: number;
    storage_total_gb?: number;
  };
}

export const createStatsCards = (
  stats: DashboardStats | undefined,
  navigate: (path: string) => void
): StatsCardProps[] => {
  const usersCard = createUsersCard(stats, navigate);
  const ttsCard = createTtsCard(stats);
  const connectionsCard = createConnectionsCard(stats);
  const errorsCard = createErrorsCard(stats, navigate);

  return [usersCard, ttsCard, connectionsCard, errorsCard];
};

const createUsersCard = (
  stats: DashboardStats | undefined,
  navigate: (path: string) => void
): StatsCardProps => ({
  title: 'Всего пользователей',
  value: stats?.users?.total || 0,
  description: `${stats?.users?.active_today || 0} активных сегодня`,
  icon: Users,
  color: 'text-blue-400',
  trend: { value: 12, direction: 'up' as const, label: 'за неделю' },
  onClick: () => navigate('/dashboard/dolbaebadmintts/users'),
});

const createTtsCard = (stats: DashboardStats | undefined): StatsCardProps => ({
  title: 'TTS запросов',
  value: stats?.tts?.requests_today || 0,
  description: `${stats?.tts?.requests_week || 0} за неделю`,
  icon: Mic,
  color: 'text-purple-400',
  trend: { value: 8, direction: 'up' as const, label: 'за неделю' },
});

const createConnectionsCard = (stats: DashboardStats | undefined): StatsCardProps => ({
  title: 'Подключений',
  value: stats?.bots?.total_connections || 0,
  description: 'Активные WebSocket',
  icon: Activity,
  color: 'text-green-400',
});

const createErrorsCard = (
  stats: DashboardStats | undefined,
  navigate: (path: string) => void
): StatsCardProps => ({
  title: 'Ошибки (24ч)',
  value: stats?.system?.errors_24h || 0,
  description: stats?.system?.errors_24h === 0 ? 'Все работает отлично' : 'Требует внимания',
  icon: AlertTriangle,
  color: stats?.system?.errors_24h === 0 ? 'text-green-400' : 'text-red-400',
  onClick: () => navigate('/dashboard/dolbaebadmintts/monitoring'),
});

export const calculateStoragePercent = (stats: DashboardStats | undefined): number => {
  if (!stats?.system?.storage_used_gb || !stats?.system?.storage_total_gb) {
    return 0;
  }
  return (stats.system.storage_used_gb / stats.system.storage_total_gb) * 100;
};

export const getStorageColorClass = (percent: number): string => {
  if (percent > 80) return 'bg-red-400';
  if (percent > 60) return 'bg-yellow-400';
  return 'bg-green-400';
};
