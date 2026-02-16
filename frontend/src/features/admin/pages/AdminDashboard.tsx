/**
 * Admin Dashboard - Overview страница с метриками и быстрыми действиями
 */

import React from 'react';

import { useQuery } from '@tanstack/react-query';
import {
  Database,
  ExternalLink
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-pink-400">
            Админ панель
          </h1>
          <p className="text-muted-foreground mt-1">
            Обзор системы и управление
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => navigate('/dashboard')}
          className="hover:bg-primary/10 hover:text-primary"
        >
          <ExternalLink className="w-4 h-4 mr-2" />
          Вернуться на сайт
        </Button>
      </div>

      {/* Основные метрики */}
      <StatsGrid stats={statsCards} columns={4} loading={isLoading} />

      {/* Хранилище */}
      <Card className="card-glass border-slate-800/60">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Database className="h-4 w-4" />
            Использование хранилища
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                {stats?.system?.storage_used_gb?.toFixed(1) || '0.0'} GB / {stats?.system?.storage_total_gb || '0'} GB
              </span>
              <span className="font-medium text-muted-foreground">{storagePercent.toFixed(1)}%</span>
            </div>
            <div className="h-2 bg-slate-800/50 rounded-full overflow-hidden border border-slate-700/50">
              <div
                className={cn('h-full transition-all duration-500 shadow-[0_0_10px_rgba(0,0,0,0.5)]', getStorageColorClass(storagePercent))}
                style={{ width: `${storagePercent}%` }}
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminDashboard;
