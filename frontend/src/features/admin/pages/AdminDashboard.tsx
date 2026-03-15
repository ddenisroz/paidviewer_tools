/**
 * Admin Dashboard - Overview страница с метриками и быстрыми действиями
 */

import React from 'react';

import { useQuery } from '@tanstack/react-query';
import {
  Database,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { ADMIN_CARD_CLASS } from '@/features/admin/components/admin-ui';
import { cn } from '@/lib/utils';
import api from '@/services/api/client';
import { StatsGrid } from '@/shared/components';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import {
  calculateAdminStoragePercent,
  createAdminStatsCards,
  type AdminDashboardStats,
  getAdminStorageColorClass,
} from '@/features/admin/utils/adminDashboardCards';

// Re-export type for local use
type Stats = AdminDashboardStats;





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
  const statsCards = createAdminStatsCards(stats, navigate);
  const storagePercent = calculateAdminStoragePercent(stats);

  return (
    <div className="space-y-4">
      <StatsGrid stats={statsCards} columns={4} loading={isLoading} />

      <Card className={ADMIN_CARD_CLASS}>
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
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className={cn('h-full transition-all duration-500', getAdminStorageColorClass(storagePercent))}
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
