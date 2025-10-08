import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Settings, 
  Gift, 
  History, 
  TrendingUp, 
  Zap,
  Users,
  DollarSign,
  Clock,
  Star,
  Crown,
  Gem,
  Shield
} from 'lucide-react';
import { useApi } from '@/hooks/useApi';
import LootboxWidgetConfigurator from '../../components/widgets/LootboxConfigurator';
import DropsTriggersConfigurator from '../../components/widgets/DropsTriggersConfigurator';

const DropsMainPage = () => {
  const [activeTab, setActiveTab] = useState('config');
  const [config, setConfig] = useState(null);
  const [rewards, setRewards] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  const { get, post, put, del } = useApi();

  // Загрузка данных
  useEffect(() => {
    loadDropsData();
  }, []);

  const loadDropsData = async () => {
    try {
      setLoading(true);
      const channelName = 'default'; // Получаем из контекста пользователя
      
      // Загружаем конфигурацию
      const configResponse = await get(`/api/drops/config/${channelName}`);
      if (configResponse.success) {
        setConfig(configResponse.data);
      }

      // Загружаем награды
      const rewardsResponse = await get(`/api/drops/rewards/${channelName}`);
      if (rewardsResponse.success) {
        setRewards(rewardsResponse.data);
      }

      // Загружаем историю
      const historyResponse = await get(`/api/drops/history/${channelName}?limit=20`);
      if (historyResponse.success) {
        setHistory(historyResponse.data);
      }

    } catch (error) {
      console.error('Error loading drops data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Статистика
  const getStats = () => {
    const totalRewards = rewards.length;
    const activeRewards = rewards.filter(r => r.is_active).length;
    const totalHistory = history.length;
    const recentDrops = history.filter(h => {
      const date = new Date(h.created_at);
      const now = new Date();
      return (now - date) < 24 * 60 * 60 * 1000; // Последние 24 часа
    }).length;

    return { totalRewards, activeRewards, totalHistory, recentDrops };
  };

  const stats = getStats();

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-24 bg-gray-200 rounded"></div>
            ))}
          </div>
          <div className="h-96 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      {/* Заголовок */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            🎁 Drops System
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Управление системой наград и дропов для стримеров
          </p>
        </div>
        <Button onClick={loadDropsData} variant="outline">
          <Settings className="w-4 h-4 mr-2" />
          Обновить
        </Button>
      </div>

      {/* Статистика */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card className="bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-blue-600 dark:text-blue-400">Всего наград</p>
                <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">{stats.totalRewards}</p>
              </div>
              <Gift className="w-8 h-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-r from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-green-600 dark:text-green-400">Активные</p>
                <p className="text-2xl font-bold text-green-900 dark:text-green-100">{stats.activeRewards}</p>
              </div>
              <Star className="w-8 h-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-r from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-purple-600 dark:text-purple-400">Всего дропов</p>
                <p className="text-2xl font-bold text-purple-900 dark:text-purple-100">{stats.totalHistory}</p>
              </div>
              <TrendingUp className="w-8 h-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-r from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-orange-600 dark:text-orange-400">За 24ч</p>
                <p className="text-2xl font-bold text-orange-900 dark:text-orange-100">{stats.recentDrops}</p>
              </div>
              <Clock className="w-8 h-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Основной контент */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-7">
          <TabsTrigger value="config" className="flex items-center gap-2">
            <Settings className="w-4 h-4" />
            Конфигурация
          </TabsTrigger>
          <TabsTrigger value="streak" className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            Стрик
          </TabsTrigger>
          <TabsTrigger value="donation" className="flex items-center gap-2">
            <DollarSign className="w-4 h-4" />
            Донат
          </TabsTrigger>
          <TabsTrigger value="triggers" className="flex items-center gap-2">
            <Zap className="w-4 h-4" />
            Триггеры
          </TabsTrigger>
          <TabsTrigger value="widget" className="flex items-center gap-2">
            <Gift className="w-4 h-4" />
            Виджет
          </TabsTrigger>
          <TabsTrigger value="mythical" className="flex items-center gap-2">
            <Star className="w-4 h-4" />
            Мифический
          </TabsTrigger>
          <TabsTrigger value="history" className="flex items-center gap-2">
            <History className="w-4 h-4" />
            История
          </TabsTrigger>
        </TabsList>

        {/* Конфигурация */}
        <TabsContent value="config" className="mt-6">
          <ConfigTab config={config} onUpdate={loadDropsData} />
        </TabsContent>

        {/* Стрик Drops */}
        <TabsContent value="streak" className="mt-6">
          <StreakTab config={config} onUpdate={loadDropsData} />
        </TabsContent>

        {/* Донат Drops */}
        <TabsContent value="donation" className="mt-6">
          <DonationTab config={config} onUpdate={loadDropsData} />
        </TabsContent>

        {/* Триггеры дропов */}
        <TabsContent value="triggers" className="mt-6">
          <DropsTriggersConfigurator />
        </TabsContent>

        {/* Виджет лутбокса */}
        <TabsContent value="widget" className="mt-6">
          <LootboxWidgetConfigurator />
        </TabsContent>

        {/* Мифический Drops */}
        <TabsContent value="mythical" className="mt-6">
          <MythicalTab config={config} onUpdate={loadDropsData} />
        </TabsContent>

        {/* История */}
        <TabsContent value="history" className="mt-6">
          <HistoryTab history={history} onUpdate={loadDropsData} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

// Компонент конфигурации
const ConfigTab = ({ config, onUpdate }) => {
  const [formData, setFormData] = useState({});
  const { put } = useApi();

  useEffect(() => {
    if (config) {
      setFormData(config);
    }
  }, [config]);

  const handleSave = async () => {
    try {
      const response = await put(`/api/drops/config/${config.channel_name}`, formData);
      if (response.success) {
        onUpdate();
      }
    } catch (error) {
      console.error('Error saving config:', error);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Общие настройки
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <h3 className="font-medium">Стрик Drops</h3>
                <p className="text-sm text-gray-600">Награды за стрик дней</p>
              </div>
              <input
                type="checkbox"
                checked={formData.streak_enabled}
                onChange={(e) => setFormData({...formData, streak_enabled: e.target.checked})}
                className="w-4 h-4"
              />
            </div>
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <h3 className="font-medium">Донат Drops</h3>
                <p className="text-sm text-gray-600">Награды за донаты</p>
              </div>
              <input
                type="checkbox"
                checked={formData.donation_enabled}
                onChange={(e) => setFormData({...formData, donation_enabled: e.target.checked})}
                className="w-4 h-4"
              />
            </div>
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <h3 className="font-medium">Мифический Drops</h3>
                <p className="text-sm text-gray-600">Случайные события</p>
              </div>
              <input
                type="checkbox"
                checked={formData.mythical_enabled}
                onChange={(e) => setFormData({...formData, mythical_enabled: e.target.checked})}
                className="w-4 h-4"
              />
            </div>
          </div>
          <Button onClick={handleSave} className="w-full">
            Сохранить настройки
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

// Компонент стрик Drops
const StreakTab = ({ config, onUpdate }) => {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Стрик Drops
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 border rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Shield className="w-4 h-4 text-gray-500" />
                <span className="text-sm font-medium">Common</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">{config?.streak_days_common || 1} дней</p>
            </div>
            <div className="p-4 border rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Star className="w-4 h-4 text-blue-500" />
                <span className="text-sm font-medium">Rare</span>
              </div>
              <p className="text-2xl font-bold text-blue-900">{config?.streak_days_rare || 3} дней</p>
            </div>
            <div className="p-4 border rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Gem className="w-4 h-4 text-purple-500" />
                <span className="text-sm font-medium">Epic</span>
              </div>
              <p className="text-2xl font-bold text-purple-900">{config?.streak_days_epic || 7} дней</p>
            </div>
            <div className="p-4 border rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Crown className="w-4 h-4 text-yellow-500" />
                <span className="text-sm font-medium">Legendary</span>
              </div>
              <p className="text-2xl font-bold text-yellow-900">{config?.streak_days_legendary || 14} дней</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

// Компонент донат Drops
const DonationTab = ({ config, onUpdate }) => {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="w-5 h-5" />
            Донат Drops
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 border rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Shield className="w-4 h-4 text-gray-500" />
                <span className="text-sm font-medium">Common</span>
              </div>
              <p className="text-2xl font-bold text-gray-900">{config?.donation_amount_common || 50}₽</p>
            </div>
            <div className="p-4 border rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Star className="w-4 h-4 text-blue-500" />
                <span className="text-sm font-medium">Rare</span>
              </div>
              <p className="text-2xl font-bold text-blue-900">{config?.donation_amount_rare || 100}₽</p>
            </div>
            <div className="p-4 border rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Gem className="w-4 h-4 text-purple-500" />
                <span className="text-sm font-medium">Epic</span>
              </div>
              <p className="text-2xl font-bold text-purple-900">{config?.donation_amount_epic || 500}₽</p>
            </div>
            <div className="p-4 border rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Crown className="w-4 h-4 text-yellow-500" />
                <span className="text-sm font-medium">Legendary</span>
              </div>
              <p className="text-2xl font-bold text-yellow-900">{config?.donation_amount_legendary || 1000}₽</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

// Компонент мифический Drops
const MythicalTab = ({ config, onUpdate }) => {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5" />
            Мифический Drops
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="p-4 border rounded-lg">
                <h3 className="font-medium mb-2">Интервал появления</h3>
                <p className="text-sm text-gray-600">
                  {config?.mythical_min_interval_hours || 2} - {config?.mythical_max_interval_hours || 8} часов
                </p>
              </div>
              <div className="p-4 border rounded-lg">
                <h3 className="font-medium mb-2">Длительность окна</h3>
                <p className="text-sm text-gray-600">
                  {config?.mythical_window_duration_minutes || 5} минут
                </p>
              </div>
            </div>
            <div className="space-y-4">
              <div className="p-4 border rounded-lg">
                <h3 className="font-medium mb-2">Сумма для получения</h3>
                <p className="text-2xl font-bold text-orange-600">
                  {config?.mythical_donation_amount || 2000}₽
                </p>
              </div>
              <div className="p-4 border rounded-lg">
                <h3 className="font-medium mb-2">Последнее появление</h3>
                <p className="text-sm text-gray-600">
                  {config?.mythical_last_appeared ? 
                    new Date(config.mythical_last_appeared).toLocaleString() : 
                    'Никогда'
                  }
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

// Компонент истории
const HistoryTab = ({ history, onUpdate }) => {
  const getQualityIcon = (quality) => {
    switch (quality) {
      case 'Common': return <Shield className="w-4 h-4 text-gray-500" />;
      case 'Rare': return <Star className="w-4 h-4 text-blue-500" />;
      case 'Epic': return <Gem className="w-4 h-4 text-purple-500" />;
      case 'Legendary': return <Crown className="w-4 h-4 text-yellow-500" />;
      default: return <Gift className="w-4 h-4 text-gray-500" />;
    }
  };

  const getTypeIcon = (type) => {
    switch (type) {
      case 'streak': return <Users className="w-4 h-4 text-green-500" />;
      case 'donation': return <DollarSign className="w-4 h-4 text-blue-500" />;
      case 'mythical': return <Zap className="w-4 h-4 text-orange-500" />;
      default: return <Gift className="w-4 h-4 text-gray-500" />;
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="w-5 h-5" />
            История Drops
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {history.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Gift className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>История пуста</p>
              </div>
            ) : (
              history.map((entry, index) => (
                <div key={index} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800">
                  <div className="flex items-center gap-4">
                    {getQualityIcon(entry.quality?.name)}
                    <div>
                      <p className="font-medium">{entry.viewer_name}</p>
                      <p className="text-sm text-gray-600">{entry.reward_name}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    {getTypeIcon(entry.lootbox_type)}
                    <div className="text-right">
                      <p className="text-sm font-medium">{entry.quality?.name}</p>
                      <p className="text-xs text-gray-500">
                        {new Date(entry.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default DropsMainPage;
