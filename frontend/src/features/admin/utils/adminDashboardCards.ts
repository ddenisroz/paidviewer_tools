import { Activity, MessageCircle, Mic, Users } from 'lucide-react';

import type { StatsCardProps } from '@/shared/components/StatsCard';

export interface AdminDashboardStats {
  total_users?: number;
  active_users?: number;
  total_messages?: number;
  tts_requests?: number;
  system?: {
    storage_used_gb?: number;
    storage_total_gb?: number;
  };
}

export const createAdminStatsCards = (
  stats: AdminDashboardStats | undefined,
  _navigate: (path: string) => void,
): StatsCardProps[] => {
  if (!stats) {
    return [];
  }

  return [
    {
      title: 'Пользователи',
      value: stats.total_users || 0,
      description: 'Всего аккаунтов в системе',
      icon: Users,
      color: 'text-sky-300',
    },
    {
      title: 'Активные',
      value: stats.active_users || 0,
      description: 'С недавней активностью',
      icon: Activity,
      color: 'text-emerald-300',
    },
    {
      title: 'Сообщения',
      value: stats.total_messages || 0,
      description: 'Обработано чат-сообщений',
      icon: MessageCircle,
      color: 'text-violet-300',
    },
    {
      title: 'TTS запросы',
      value: stats.tts_requests || 0,
      description: 'Сгенерировано за период',
      icon: Mic,
      color: 'text-amber-300',
    },
  ];
};

export const calculateAdminStoragePercent = (stats: AdminDashboardStats | undefined): number => {
  if (!stats?.system?.storage_total_gb) {
    return 0;
  }

  return ((stats.system.storage_used_gb || 0) / stats.system.storage_total_gb) * 100;
};

export const getAdminStorageColorClass = (percent: number): string => {
  if (percent >= 90) return 'bg-red-500';
  if (percent >= 70) return 'bg-yellow-500';
  return 'bg-green-500';
};
