import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Sparkles, Loader2, Check, AlertTriangle, Package } from 'lucide-react';
import { botService } from '../../services/microservices';
import { toast } from 'sonner';
import { logger } from '../../utils/prodLogger';
import { useIntegrations } from '../../context/IntegrationsContext';
import DonationGrid from './DonationGrid';
import DonationHistory from './DonationHistory';
import MythycClosed from '../../images/lootboxes/mythyc/mythyc_closed.png';

const DonationSettings = ({ user, platform, channelName, hasRewards = false }) => {
  const { integrations } = useIntegrations();
  const [config, setConfig] = useState(null);
  const [saving, setSaving] = useState(false);
  const [savedSuccessfully, setSavedSuccessfully] = useState(false);
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
  }, [user, platform, channelName, integrations?.donationalerts?.enabled]);

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
        // Проверяем интеграцию DonationAlerts при загрузке
        const donationalertsConnected = integrations?.donationalerts?.enabled || false;
        const donationEnabledFromServer = response.data.data.donation_enabled ?? false;
        // Если интеграция не подключена, принудительно ставим false
        const donationEnabled = donationalertsConnected ? donationEnabledFromServer : false;
        
        setFormData({
          donation_enabled: donationEnabled,
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
        setSavedSuccessfully(true);
        setTimeout(() => setSavedSuccessfully(false), 2000);
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
      {/* Предупреждение если нет наград */}
      {!hasRewards && (
        <Card className="border-2 border-orange-500/50 bg-orange-500/10">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-orange-400 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h4 className="text-sm font-semibold text-orange-400 mb-1">
                  Награды не настроены
                </h4>
                <p className="text-xs text-orange-200/80 mb-2">
                  Для работы donation drops необходимо сначала настроить содержимое сундуков на вкладке "Награды".
                </p>
                <Button 
                  onClick={() => window.location.href = '/dashboard/drops?tab=rewards'}
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs border-orange-500/50 text-orange-400 hover:bg-orange-500/20"
                >
                  <Package className="w-3 h-3 mr-1.5" />
                  Настроить награды
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Настройки донатов - компактно */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Настройки донатов</CardTitle>
            <div className="flex items-center gap-2">
              <Label className="text-sm font-medium">Включить donation drops</Label>
              <Switch
                checked={formData.donation_enabled && hasRewards}
                disabled={!hasRewards}
                onCheckedChange={(checked) => {
                  if (!hasRewards) {
                    toast.error('Сначала настройте содержимое сундуков на вкладке "Награды"');
                    return;
                  }
                  if (checked) {
                    // Проверяем интеграцию с DonationAlerts
                    const donationalertsConnected = integrations?.donationalerts?.enabled || false;
                    if (!donationalertsConnected) {
                      toast.error('Для использования donation drops необходимо подключить интеграцию DonationAlerts');
                      return;
                    }
                  }
                  setFormData({...formData, donation_enabled: checked});
                }}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <DonationGrid formData={formData} setFormData={setFormData} />
        </CardContent>
      </Card>

          {/* Мифический lootbox - компактно */}
          <Card className="border-2 border-pink-500/30 bg-gradient-to-br from-pink-500/10 to-purple-600/5">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2 text-pink-400">
                  <img src={MythycClosed} alt="Мифический" className="w-10 h-10" />
                  <Sparkles className="w-5 h-5" />
                  Мифический lootbox
                </CardTitle>
            <div className="flex items-center gap-2">
              <Label className="text-sm font-medium text-pink-300">Включить mythyc drops</Label>
              <Switch
                checked={formData.mythical_enabled}
                onCheckedChange={(checked) => setFormData({...formData, mythical_enabled: checked})}
              />
            </div>
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

      {/* Кнопка сохранения - компактно справа */}
      <div className="flex justify-end">
        <Button 
          onClick={handleSave}
          disabled={saving}
          size="sm"
          variant="default"
          className={`gap-2 px-6 transition-all duration-300 ${
            savedSuccessfully 
              ? 'bg-green-600 hover:bg-green-500 scale-105' 
              : saving 
                ? 'opacity-75' 
                : ''
          }`}
        >
          {saving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Сохранение...
            </>
          ) : savedSuccessfully ? (
            <>
              <Check className="w-4 h-4" />
              Сохранено!
            </>
          ) : (
            'Сохранить'
          )}
        </Button>
      </div>
    </div>
  );
};

export default DonationSettings;
