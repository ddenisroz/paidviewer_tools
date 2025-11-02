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

const DonationSettings = ({ user, platform, channelName }) => {
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    donation_enabled: true,
    donation_amount_common: 50.0,
    donation_amount_rare: 100.0,
    donation_amount_epic: 500.0,
    donation_amount_legendary: 1000.0
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
          donation_amount_common: response.data.data.donation_amount_common ?? 50.0,
          donation_amount_rare: response.data.data.donation_amount_rare ?? 100.0,
          donation_amount_epic: response.data.data.donation_amount_epic ?? 500.0,
          donation_amount_legendary: response.data.data.donation_amount_legendary ?? 1000.0
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

    try {
      setSaving(true);
      const response = await botService.put(`/api/drops/config/${channelName}`, formData, {
        params: { platform }
      });
      
      if (response.data.success) {
        toast.success('Настройки донатов сохранены');
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
        <CardContent className="space-y-4">
          {QUALITIES.map((quality, index) => {
            const Icon = quality.icon;
            const fieldName = `donation_amount_${quality.name.toLowerCase()}`;
            const value = formData[fieldName];
            const isLast = quality.name === QUALITIES[QUALITIES.length - 1].name;
            
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
                      {isLast ? 'Максимальная награда от' : 'Награда от'} {value}₽
                    </p>
                  </div>
                  <Input
                    id={fieldName}
                    type="number"
                    min={0.01}
                    max={1000000}
                    step={10}
                    value={value}
                    onChange={(e) => setFormData({
                      ...formData, 
                      [fieldName]: parseFloat(e.target.value) || 0.01
                    })}
                    className="w-32"
                  />
                  <span className="text-sm text-muted-foreground">₽</span>
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

export default DonationSettings;

