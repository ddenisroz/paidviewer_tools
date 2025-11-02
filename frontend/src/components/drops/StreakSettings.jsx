import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Shield, Star, Gem, Crown } from 'lucide-react';
import { botService } from '../../services/microservices';
import { toast } from 'sonner';
import { logger } from '../../utils/prodLogger';

import CommonClosed from '../../images/lootboxes/common/common_closed.png';
import CommonOpened from '../../images/lootboxes/common/common_opened.png';
import RareClosed from '../../images/lootboxes/rare/rare_closed.png';
import RareOpened from '../../images/lootboxes/rare/rare_opened_.png';
import EpicClosed from '../../images/lootboxes/epic/epic_closed.png';
import EpicOpened from '../../images/lootboxes/epic/epic_opened.png';
import LegendaryClosed from '../../images/lootboxes/legendary/legendary_closed.png';
import LegendaryOpened from '../../images/lootboxes/legendary/legendary_opened.png';

const QUALITIES = [
  { name: 'Common', color: '#6B7280', icon: Shield, label: 'Обычный', closed: CommonClosed, opened: CommonOpened },
  { name: 'Rare', color: '#3B82F6', icon: Star, label: 'Редкий', closed: RareClosed, opened: RareOpened },
  { name: 'Epic', color: '#8B5CF6', icon: Gem, label: 'Эпический', closed: EpicClosed, opened: EpicOpened },
  { name: 'Legendary', color: '#F59E0B', icon: Crown, label: 'Легендарный', closed: LegendaryClosed, opened: LegendaryOpened }
];

const StreakSettings = ({ user, platform, channelName }) => {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    streak_enabled: true,
    streak_days_common: 1,
    streak_days_rare: 7,
    streak_days_epic: 30,
    streak_days_legendary: 60,
    streak_messages_required: 10,
    streak_reset_on_skip: true
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
          streak_enabled: response.data.data.streak_enabled ?? true,
          streak_days_common: response.data.data.streak_days_common ?? 1,
          streak_days_rare: response.data.data.streak_days_rare ?? 7,
          streak_days_epic: response.data.data.streak_days_epic ?? 30,
          streak_days_legendary: response.data.data.streak_days_legendary ?? 60,
          streak_messages_required: response.data.data.streak_messages_required ?? 10,
          streak_reset_on_skip: response.data.data.streak_reset_on_skip ?? true
        });
      }
    } catch (error) {
      logger.error('Error loading streak config:', error);
      toast.error('Ошибка загрузки настроек стрика');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!user || !platform || !channelName) {
      toast.error('Недостаточно данных для сохранения');
      return;
    }

    try {
      setSaving(true);
      const response = await botService.put(`/api/drops/config/${channelName}`, formData, {
        params: { platform }
      });
      
      if (response.data.success) {
        toast.success('Настройки стрика сохранены');
        await loadConfig();
      }
    } catch (error) {
      logger.error('Error saving streak config:', error);
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
          <CardTitle>Общие настройки стрика</CardTitle>
          <CardDescription>
            Настройте условия получения наград за присутствие на стримах
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Включить стрик */}
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div>
              <h3 className="font-medium">Включить стрик награды</h3>
              <p className="text-sm text-muted-foreground">
                Зрители получают награды за постоянное присутствие на стримах
              </p>
            </div>
            <Switch
              checked={formData.streak_enabled}
              onCheckedChange={(checked) => setFormData({...formData, streak_enabled: checked})}
            />
          </div>

          {/* Сообщений для засчета дня */}
          <div className="space-y-2">
            <Label htmlFor="messages_required">Сообщений в чате для засчета дня</Label>
            <Input
              id="messages_required"
              type="number"
              min={1}
              max={100}
              value={formData.streak_messages_required}
              onChange={(e) => setFormData({...formData, streak_messages_required: parseInt(e.target.value) || 1})}
            />
            <p className="text-xs text-muted-foreground">
              Зритель должен написать это количество сообщений за стрим, чтобы день засчитался в стрике
            </p>
          </div>

          {/* Сброс стрика */}
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div>
              <h3 className="font-medium">Сбрасывать стрик при пропуске</h3>
              <p className="text-sm text-muted-foreground">
                Если зритель не набрал нужное количество сообщений, его стрик сбрасывается
              </p>
            </div>
            <Switch
              checked={formData.streak_reset_on_skip}
              onCheckedChange={(checked) => setFormData({...formData, streak_reset_on_skip: checked})}
            />
          </div>
        </CardContent>
      </Card>

      {/* Дни для каждого качества */}
      <Card>
        <CardHeader>
          <CardTitle>Дни стрика для получения наград</CardTitle>
          <CardDescription>
            Установите количество дней непрерывного стрика для каждого качества сундука
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {QUALITIES.map((quality) => {
            const Icon = quality.icon;
            const fieldName = `streak_days_${quality.name.toLowerCase()}`;
            const value = formData[fieldName];
            const isLast = quality.name === QUALITIES[QUALITIES.length - 1].name;
            const isFirst = quality.name === QUALITIES[0].name;
            
            return (
              <div key={quality.name} className="space-y-2">
                <div className="flex items-center gap-3">
                  <img 
                    src={quality.closed} 
                    alt={`${quality.label} chest`}
                    className="w-16 h-16 object-contain flex-shrink-0"
                  />
                  <div className="flex-1">
                    <Label htmlFor={fieldName} className="font-medium">
                      {quality.label}
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      {isFirst && 'Первая награда после'}
                      {!isFirst && !isLast && `Следующая награда после ${value} дней`}
                      {isLast && 'Максимальная награда от'}
                    </p>
                  </div>
                  <Input
                    id={fieldName}
                    type="number"
                    min={1}
                    max={365}
                    value={value}
                    onChange={(e) => setFormData({
                      ...formData, 
                      [fieldName]: parseInt(e.target.value) || 1
                    })}
                    className="w-24"
                  />
                  <span className="text-sm text-muted-foreground">дней</span>
                </div>
              </div>
            );
          })}
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

export default StreakSettings;

