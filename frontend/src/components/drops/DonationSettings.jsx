import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Sparkles } from 'lucide-react';
import { botService } from '../../services/microservices';
import { toast } from 'sonner';
import { logger } from '../../utils/prodLogger';

import CommonClosed from '../../images/lootboxes/common/common_closed.png';
import RareClosed from '../../images/lootboxes/rare/rare_closed.png';
import EpicClosed from '../../images/lootboxes/epic/epic_closed.png';
import LegendaryClosed from '../../images/lootboxes/legendary/legendary_closed.png';
import MythycClosed from '../../images/lootboxes/mythyc/mythyc_closed.png';

const QUALITIES = [
  { name: 'Common', color: '#6B7280', label: 'Обычный', image: CommonClosed },
  { name: 'Rare', color: '#3B82F6', label: 'Редкий', image: RareClosed },
  { name: 'Epic', color: '#8B5CF6', label: 'Эпический', image: EpicClosed },
  { name: 'Legendary', color: '#F59E0B', label: 'Легендарный', image: LegendaryClosed }
];

const DonationSettings = ({ user, platform, channelName }) => {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    donation_enabled: true,
    donation_amount_common: [50.0],
    donation_amount_rare: [100.0],
    donation_amount_epic: [500.0],
    donation_amount_legendary: [1000.0],
    mythical_enabled: true,
    mythical_min_interval_hours: [2],
    mythical_max_interval_hours: [8],
    mythical_window_duration_minutes: [5],
    mythical_donation_amount: [2000.0]
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
          donation_enabled: response.data.data.donation_enabled ?? true,
          donation_amount_common: [response.data.data.donation_amount_common ?? 50.0],
          donation_amount_rare: [response.data.data.donation_amount_rare ?? 100.0],
          donation_amount_epic: [response.data.data.donation_amount_epic ?? 500.0],
          donation_amount_legendary: [response.data.data.donation_amount_legendary ?? 1000.0],
          mythical_enabled: response.data.data.mythical_enabled ?? true,
          mythical_min_interval_hours: [response.data.data.mythical_min_interval_hours ?? 2],
          mythical_max_interval_hours: [response.data.data.mythical_max_interval_hours ?? 8],
          mythical_window_duration_minutes: [response.data.data.mythical_window_duration_minutes ?? 5],
          mythical_donation_amount: [response.data.data.mythical_donation_amount ?? 2000.0]
        });
      }
    } catch (error) {
      logger.error('Error loading donation config:', error);
      toast.error('Ошибка загрузки настроек донатов');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!user || !platform || !channelName) {
      toast.error('Недостаточно данных для сохранения');
      return;
    }

    // Валидация мифического лутбокса
    if (formData.mythical_enabled) {
      if (formData.mythical_min_interval_hours[0] >= formData.mythical_max_interval_hours[0]) {
        toast.error('Минимальный интервал должен быть меньше максимального');
        return;
      }
    }

    try {
      setSaving(true);
      const payload = {
        donation_enabled: formData.donation_enabled,
        donation_amount_common: formData.donation_amount_common[0],
        donation_amount_rare: formData.donation_amount_rare[0],
        donation_amount_epic: formData.donation_amount_epic[0],
        donation_amount_legendary: formData.donation_amount_legendary[0],
        mythical_enabled: formData.mythical_enabled,
        mythical_min_interval_hours: formData.mythical_min_interval_hours[0],
        mythical_max_interval_hours: formData.mythical_max_interval_hours[0],
        mythical_window_duration_minutes: formData.mythical_window_duration_minutes[0],
        mythical_donation_amount: formData.mythical_donation_amount[0]
      };
      const response = await botService.put(`/api/drops/config/${channelName}`, payload, {
        params: { platform }
      });
      
      if (response.data.success) {
        toast.success('Настройки сохранены');
        await loadConfig();
      }
    } catch (error) {
      logger.error('Error saving donation config:', error);
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
      {/* Общие настройки */}
      <Card>
        <CardHeader>
          <CardTitle>Настройки донат наград</CardTitle>
          <CardDescription>
            Установите минимальную сумму доната для каждого качества сундука
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Включить донаты */}
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div>
              <h3 className="font-medium">Включить донат награды</h3>
              <p className="text-sm text-muted-foreground">
                Зрители получают награды за донаты через DonationAlerts
              </p>
            </div>
            <Switch
              checked={formData.donation_enabled}
              onCheckedChange={(checked) => setFormData({...formData, donation_enabled: checked})}
            />
          </div>
        </CardContent>
      </Card>

        {/* Суммы для каждого качества */}
        <Card>
          <CardHeader>
            <CardTitle>Суммы доната для наград</CardTitle>
            <CardDescription>
              Установите минимальную сумму доната для получения каждого качества сундука
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {QUALITIES.map((quality, index) => {
              const fieldName = `donation_amount_${quality.name.toLowerCase()}`;
              const value = formData[fieldName];
              const isLast = quality.name === QUALITIES[QUALITIES.length - 1].name;
              
              return (
                <div key={quality.name} className="space-y-4">
                  <div className="flex items-center gap-3">
                    <img 
                      src={quality.image} 
                      alt={`${quality.label} chest`}
                      className="w-16 h-16 object-contain flex-shrink-0"
                    />
                    <div className="flex-1">
                      <Label htmlFor={fieldName} className="font-medium">
                        {quality.label}
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        {isLast ? 'Максимальная награда от' : 'Награда от'}
                      </p>
                    </div>
                    <div className="w-32">
                      <div className="text-center">
                        <span className="text-2xl font-bold">{value[0]}₽</span>
                      </div>
                    </div>
                  </div>
                  <div className="px-0">
                    <Slider
                      value={value}
                      onValueChange={(val) => setFormData({
                        ...formData, 
                        [fieldName]: val
                      })}
                      min={0}
                      max={isLast ? 10000 : 5000}
                      step={isLast ? 100 : 50}
                      className="w-full"
                    />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
        
        {/* Мифический лутбокс */}
        <Card className="border-2 border-pink-500/30 bg-gradient-to-br from-pink-500/10 to-purple-600/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-pink-400">
              <img src={MythycClosed} alt="Мифический" className="w-8 h-8" />
              <Sparkles className="w-5 h-5" />
              Мифический лутбокс
            </CardTitle>
            <CardDescription>
              Редкие лутбоксы, которые появляются случайно через определенные интервалы времени
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Включить мифический */}
            <div className="flex items-center justify-between p-4 border border-pink-500/30 rounded-lg bg-pink-500/5">
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

            {/* Интервалы появления */}
            {formData.mythical_enabled && (
              <>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label>Минимальный интервал (часы)</Label>
                    <span className="text-lg font-semibold">{formData.mythical_min_interval_hours[0]}</span>
                  </div>
                  <Slider
                    value={formData.mythical_min_interval_hours}
                    onValueChange={(value) => setFormData({...formData, mythical_min_interval_hours: value})}
                    min={0}
                    max={24}
                    step={1}
                  />
                  <p className="text-xs text-muted-foreground">
                    Лутбокс появится не раньше чем через N часов после последнего
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label>Максимальный интервал (часы)</Label>
                    <span className="text-lg font-semibold">{formData.mythical_max_interval_hours[0]}</span>
                  </div>
                  <Slider
                    value={formData.mythical_max_interval_hours}
                    onValueChange={(value) => setFormData({...formData, mythical_max_interval_hours: value})}
                    min={0}
                    max={24}
                    step={1}
                  />
                  <p className="text-xs text-muted-foreground">
                    Лутбокс появится не позже чем через N часов после последнего
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label>Длительность окна (минуты)</Label>
                    <span className="text-lg font-semibold">{formData.mythical_window_duration_minutes[0]}</span>
                  </div>
                  <Slider
                    value={formData.mythical_window_duration_minutes}
                    onValueChange={(value) => setFormData({...formData, mythical_window_duration_minutes: value})}
                    min={1}
                    max={60}
                    step={1}
                  />
                  <p className="text-xs text-muted-foreground">
                    Сколько минут лутбокс остается доступным после появления
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label>Минимальная сумма доната (₽)</Label>
                    <span className="text-lg font-semibold">{formData.mythical_donation_amount[0]}₽</span>
                  </div>
                  <Slider
                    value={formData.mythical_donation_amount}
                    onValueChange={(value) => setFormData({...formData, mythical_donation_amount: value})}
                    min={500}
                    max={10000}
                    step={100}
                  />
                  <p className="text-xs text-muted-foreground">
                    Донот должен быть не меньше этой суммы для получения мифического лутбокса
                  </p>
                </div>
              </>
            )}
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

export default DonationSettings;

