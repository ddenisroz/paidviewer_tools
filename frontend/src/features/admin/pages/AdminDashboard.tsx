/**
 * Admin Dashboard - Overview страница с метриками и быстрыми действиями
 */

import React from 'react';

import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  ArrowRight,
  CheckCircle,
  Clock,
  Database,
  MessageCircle,
  Mic,
  Settings,
  Users,
  XCircle
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { cn } from '@/lib/utils';
import api from '@/services/api/client';
import { StatsGrid } from '@/shared/components';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import {
  calculateStoragePercent,
  createStatsCards,
  type DashboardStats,
  getStorageColorClass
} from '@/shared/utils/dashboardHelpers';

// Re-export type for local use
type Stats = DashboardStats;



// Компонент быстрого действия
const QuickAction: React.FC<{
  title: string;
  description: string;
  icon: React.ElementType;
  onClick: () => void;
  variant?: 'default' | 'destructive';
}> = ({ title, description, icon: Icon, onClick, variant = 'default' }) => {
  return (
    <Card
      className="hover:shadow-lg transition-all duration-200 cursor-pointer hover:border-primary"
      onClick={onClick}
    >
      <CardContent className="p-4 flex items-center gap-4">
        <div className={cn(
          'p-3 rounded-lg',
          variant === 'destructive' ? 'bg-red-500/10' : 'bg-primary/10'
        )}>
          <Icon className={cn(
            'h-5 w-5',
            variant === 'destructive' ? 'text-red-400' : 'text-primary'
          )} />
        </div>
        <div className="flex-1">
          <h3 className="font-medium">{title}</h3>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        <ArrowRight className="h-4 w-4 text-muted-foreground" />
      </CardContent>
    </Card>
  );
};

// Компонент статуса бота
const BotStatus: React.FC<{
  name: string;
  isOnline: boolean;
  connections: number;
}> = ({ name, isOnline, connections }) => {
  return (
    <div className="flex items-center justify-between p-3 rounded-lg bg-slate-800/50">
      <div className="flex items-center gap-3">
        {isOnline ? (
          <CheckCircle className="h-5 w-5 text-green-400" />
        ) : (
          <XCircle className="h-5 w-5 text-red-400" />
        )}
        <div>
          <p className="font-medium">{name}</p>
          <p className="text-xs text-muted-foreground">
            {connections} подключений
          </p>
        </div>
      </div>
      <div className={cn(
        'px-2 py-1 rounded text-xs font-medium',
        isOnline ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
      )}>
        {isOnline ? 'Online' : 'Offline'}
      </div>
    </div>
  );
};

const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();

  // Загрузка статистики
  const { data: stats, isLoading } = useQuery<Stats>({
    queryKey: ['admin', 'dashboard', 'stats'],
    queryFn: async () => {
      const response = await api.get('/api/admin/dashboard/stats');
      return response.data.stats;
    },
    refetchInterval: 30000 // Обновляем каждые 30 секунд
  });

  // Подготовка данных для StatsGrid
  const statsCards = createStatsCards(stats, navigate);
  const storagePercent = calculateStoragePercent(stats);

  return (
    <div className="space-y-6">
      {/* Заголовок */}
      <div>
        <h1 className="text-3xl font-bold">Админ панель</h1>
        <p className="text-muted-foreground mt-1">
          Обзор системы и быстрые действия
        </p>
      </div>

      {/* Основные метрики - используем новый StatsGrid */}
      <StatsGrid stats={statsCards} columns={4} loading={isLoading} />

      {/* Статус ботов */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Статус ботов
          </CardTitle>
          <CardDescription>
            Состояние подключений к платформам
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <BotStatus
            name="Twitch Bot"
            isOnline={stats?.bots?.twitch_online || false}
            connections={stats?.bots?.twitch_connections || 0}
          />
          <BotStatus
            name="VK Live Bot"
            isOnline={stats?.bots?.vk_online || false}
            connections={stats?.bots?.vk_connections || 0}
          />
          <Button
            variant="outline"
            className="w-full mt-2"
            onClick={() => navigate('/dashboard/dolbaebadmintts/bots')}
          >
            Управление ботами
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </CardContent>
      </Card>

      {/* Хранилище */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Использование хранилища
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                {stats?.system?.storage_used_gb?.toFixed(1) || '0.0'} GB / {stats?.system?.storage_total_gb || '0'} GB
              </span>
              <span className="font-medium">{storagePercent.toFixed(1)}%</span>
            </div>
            <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
              <div
                className={cn('h-full transition-all duration-500', getStorageColorClass(storagePercent))}
                style={{ width: `${storagePercent}%` }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Быстрые действия */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Быстрые действия</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <QuickAction
            title="Управление пользователями"
            description="Просмотр, редактирование и блокировка"
            icon={Users}
            onClick={() => navigate('/dashboard/dolbaebadmintts/users')}
          />

          <QuickAction
            title="Управление голосами"
            description="Глобальные и пользовательские голоса"
            icon={Mic}
            onClick={() => navigate('/dashboard/dolbaebadmintts')}
          />

          <QuickAction
            title="Тикеты поддержки"
            description="Обработка запросов пользователей"
            icon={MessageCircle}
            onClick={() => navigate('/dashboard/dolbaebadmintts/support')}
          />

          <QuickAction
            title="Мониторинг системы"
            description="Логи, ошибки и производительность"
            icon={Activity}
            onClick={() => navigate('/dashboard/dolbaebadmintts/monitoring')}
          />
        </div>
      </div>

      {/* Последние активности (TODO) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Последние события
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-8">
            Функция в разработке
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminDashboard;
