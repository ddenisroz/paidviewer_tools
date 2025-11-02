import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Sparkles } from 'lucide-react';
import { botService } from '../../services/microservices';
import { toast } from 'sonner';
import { logger } from '../../utils/prodLogger';
import DonationGrid from './DonationGrid';
import DonationHistory from './DonationHistory';

const DonationSettings = ({ user, platform, channelName }) => {
  const [config, setConfig] = useState(null);
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
      return;
    }

    try {
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

  return (
    <div className="space-y-4">
      {/* Настройки донатов - компактно */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Настройки донатов</CardTitle>
            <Switch
              checked={formData.donation_enabled}
              onCheckedChange={(checked) => setFormData({...formData, donation_enabled: checked})}
            />
          </div>
        </CardHeader>
        <CardContent>
          <DonationGrid formData={formData} setFormData={setFormData} />
        </CardContent>
      </Card>

      {/* Мифический лутбокс - компактно */}
      <Card className="border-2 border-pink-500/30 bg-gradient-to-br from-pink-500/10 to-purple-600/5">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2 text-pink-400">
              <Sparkles className="w-5 h-5" />
              Мифический лутбокс
            </CardTitle>
            <Switch
              checked={formData.mythical_enabled}
              onCheckedChange={(checked) => setFormData({...formData, mythical_enabled: checked})}
            />
          </div>
        </CardHeader>
        {formData.mythical_enabled && (
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Мин. интервал (ч)</Label>
                  <span className="text-sm font-semibold">{formData.mythical_min_interval_hours[0]}</span>
                </div>
                <Slider
                  value={formData.mythical_min_interval_hours}
                  onValueChange={(value) => setFormData({...formData, mythical_min_interval_hours: value})}
                  min={0}
                  max={24}
                  step={1}
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Макс. интервал (ч)</Label>
                  <span className="text-sm font-semibold">{formData.mythical_max_interval_hours[0]}</span>
                </div>
                <Slider
                  value={formData.mythical_max_interval_hours}
                  onValueChange={(value) => setFormData({...formData, mythical_max_interval_hours: value})}
                  min={0}
                  max={24}
                  step={1}
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Длительность окна (м)</Label>
                  <span className="text-sm font-semibold">{formData.mythical_window_duration_minutes[0]}</span>
                </div>
                <Slider
                  value={formData.mythical_window_duration_minutes}
                  onValueChange={(value) => setFormData({...formData, mythical_window_duration_minutes: value})}
                  min={1}
                  max={60}
                  step={1}
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs">Мин. сумма (₽)</Label>
                  <span className="text-sm font-semibold">{formData.mythical_donation_amount[0]}₽</span>
                </div>
                <Slider
                  value={formData.mythical_donation_amount}
                  onValueChange={(value) => setFormData({...formData, mythical_donation_amount: value})}
                  min={500}
                  max={10000}
                  step={100}
                />
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* История донатов */}
      <DonationHistory user={user} platform={platform} channelName={channelName} />

      {/* Кнопка сохранения */}
      <div className="flex justify-end">
        <Button 
          onClick={handleSave}
          disabled={saving}
          size="sm"
        >
          {saving ? 'Сохранение...' : 'Сохранить'}
        </Button>
      </div>
    </div>
  );
};

export default DonationSettings;
