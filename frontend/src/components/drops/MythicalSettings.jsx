import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Sparkles } from 'lucide-react';
import { botService } from '../../services/microservices';
import { toast } from 'sonner';
import { logger } from '../../utils/prodLogger';

const MythicalSettings = ({ user, platform, channelName }) => {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    mythical_enabled: true,
    mythical_min_interval_hours: 2,
    mythical_max_interval_hours: 8,
    mythical_window_duration_minutes: 5,
    mythical_donation_amount: 2000.0
  });

  useEffect(() => {
    loadConfig();
  }, [user, platform, channelName]);

  const loadConfig = async () => {
    if (!user || !platform || !channelName) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const response = await botService.get(`/api/drops/config/${channelName}`, {
        params: { platform }
      });
      
      if (response.data.success) {
        setConfig(response.data.data);
        setFormData({
          mythical_enabled: response.data.data.mythical_enabled ?? true,
          mythical_min_interval_hours: response.data.data.mythical_min_interval_hours ?? 2,
          mythical_max_interval_hours: response.data.data.mythical_max_interval_hours ?? 8,
          mythical_window_duration_minutes: response.data.data.mythical_window_duration_minutes ?? 5,
          mythical_donation_amount: response.data.data.mythical_donation_amount ?? 2000.0
        });
      }
    } catch (error) {
      logger.error('Error loading mythical config:', error);
      toast.error('Ошибка загрузки настроек мифического лутбокса');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!user || !platform || !channelName) {
      toast.error('Недостаточно данных для сохранения');
      return;
    }

    // Валидация
    if (formData.mythical_min_interval_hours >= formData.mythical_max_interval_hours) {
      toast.error('Минимальный интервал должен быть меньше максимального');
      return;
    }

    try {
      setSaving(true);
      const response = await botService.put(`/api/drops/config/${channelName}`, formData, {
        params: { platform }
      });
      
      if (response.data.success) {
        toast.success('Настройки мифического лутбокса сохранены');
        await loadConfig();
      }
    } catch (error) {
      logger.error('Error saving mythical config:', error);
      toast.error('Ошибка сохранения настроек');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-16 bg-gray-700 rounded-lg"></div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Общее описание */}
      <Card className="border-2 border-purple-500/30 bg-gradient-to-br from-purple-500/10 to-purple-600/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-purple-400">
            <Sparkles className="w-5 h-5" />
            Мифический лутбокс
          </CardTitle>
          <CardDescription>
            Редкие лутбоксы, которые появляются случайно через определенные интервалы времени
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between p-4 border border-purple-500/30 rounded-lg bg-purple-500/5">
            <div>
              <h3 className="font-medium">Включить мифический лутбокс</h3>
              <p className="text-sm text-muted-foreground">
                Случайно появляющиеся мифические лутбоксы с повышенными наградами
              </p>
            </div>
            <Switch
              checked={formData.mythical_enabled}
              onCheckedChange={(checked) => setFormData({...formData, mythical_enabled: checked})}
            />
          </div>
        </CardContent>
      </Card>

      {/* Интервалы появления */}
      <Card>
        <CardHeader>
          <CardTitle>Интервал появления</CardTitle>
          <CardDescription>
            Установите минимальный и максимальный интервал между появлениями мифического лутбокса
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="flex-1 space-y-2">
              <Label htmlFor="min_interval">Минимальный интервал (часы)</Label>
              <Input
                id="min_interval"
                type="number"
                min={0}
                max={24}
                value={formData.mythical_min_interval_hours}
                onChange={(e) => setFormData({
                  ...formData, 
                  mythical_min_interval_hours: parseInt(e.target.value) || 0
                })}
              />
              <p className="text-xs text-muted-foreground">
                Лутбокс появится не раньше чем через N часов после последнего
              </p>
            </div>
            <div className="flex-1 space-y-2">
              <Label htmlFor="max_interval">Максимальный интервал (часы)</Label>
              <Input
                id="max_interval"
                type="number"
                min={0}
                max={24}
                value={formData.mythical_max_interval_hours}
                onChange={(e) => setFormData({
                  ...formData, 
                  mythical_max_interval_hours: parseInt(e.target.value) || 0
                })}
              />
              <p className="text-xs text-muted-foreground">
                Лутбокс появится не позже чем через N часов после последнего
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Длительность окна */}
      <Card>
        <CardHeader>
          <CardTitle>Длительность окна</CardTitle>
          <CardDescription>
            Сколько времени мифический лутбокс доступен для получения
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="window_duration">Длительность (минуты)</Label>
            <Input
              id="window_duration"
              type="number"
              min={1}
              max={60}
              value={formData.mythical_window_duration_minutes}
              onChange={(e) => setFormData({
                ...formData, 
                mythical_window_duration_minutes: parseInt(e.target.value) || 1
              })}
              className="w-40"
            />
            <p className="text-xs text-muted-foreground">
              Сколько минут лутбокс остается доступным после появления
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Минимальная сумма */}
      <Card>
        <CardHeader>
          <CardTitle>Минимальная сумма доната</CardTitle>
          <CardDescription>
            Минимальная сумма доната для получения мифического лутбокса
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="donation_amount">Сумма доната (₽)</Label>
            <div className="flex items-center gap-2">
              <Input
                id="donation_amount"
                type="number"
                min={0.01}
                max={1000000}
                step={100}
                value={formData.mythical_donation_amount}
                onChange={(e) => setFormData({
                  ...formData, 
                  mythical_donation_amount: parseFloat(e.target.value) || 0.01
                })}
                className="w-40"
              />
              <span className="text-sm text-muted-foreground">₽</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Донот должен быть не меньше этой суммы для получения лутбокса
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Кнопка сохранения */}
      <div className="flex justify-end">
        <Button 
          onClick={handleSave}
          disabled={saving}
          className="w-full sm:w-auto"
        >
          {saving ? 'Сохранение...' : 'Сохранить настройки'}
        </Button>
      </div>
    </div>
  );
};

export default MythicalSettings;

