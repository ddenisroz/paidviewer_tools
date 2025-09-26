import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { Coins, Users, Gift, Settings, TrendingUp, Plus, Edit, Trash2, Award, Clock, CheckCircle, XCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const PointsManagementPage = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [stats, setStats] = useState({
    total_users: 0,
    total_points: 0,
    active_rewards: 0,
    pending_rewards: 0
  });
  const [rewards, setRewards] = useState([]);
  const [rewardQueue, setRewardQueue] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateReward, setShowCreateReward] = useState(false);

  // Загрузка данных
  const loadData = async () => {
    try {
      setLoading(true);
      
      // Загружаем статистику
      const statsResponse = await fetch('/api/points/stats?channel_name=test_channel', {
        credentials: 'include'
      });
      if (statsResponse.ok) {
        const statsData = await statsResponse.json();
        setStats(statsData.stats);
      }

      // Загружаем награды
      const rewardsResponse = await fetch('/api/points/rewards', {
        credentials: 'include'
      });
      if (rewardsResponse.ok) {
        const rewardsData = await rewardsResponse.json();
        setRewards(rewardsData.rewards);
      }

      // Загружаем очередь наград
      const queueResponse = await fetch('/api/points/rewards/queue', {
        credentials: 'include'
      });
      if (queueResponse.ok) {
        const queueData = await queueResponse.json();
        setRewardQueue(queueData.queue);
      }

      // Загружаем топ
      const leaderboardResponse = await fetch('/api/points/leaderboard?channel_name=test_channel', {
        credentials: 'include'
      });
      if (leaderboardResponse.ok) {
        const leaderboardData = await leaderboardResponse.json();
        setLeaderboard(leaderboardData.leaderboard);
      }

    } catch (err) {
      console.error('Error loading points data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const tabs = [
    { id: 'overview', name: 'Обзор', icon: TrendingUp },
    { id: 'rewards', name: 'Награды', icon: Gift },
    { id: 'queue', name: 'Очередь', icon: Clock },
    { id: 'leaderboard', name: 'Топ', icon: Award },
    { id: 'settings', name: 'Настройки', icon: Settings }
  ];

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* Заголовок */}
        <div className="bg-gradient-to-r from-yellow-400 to-orange-500 rounded-lg p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold flex items-center">
                <Coins className="w-8 h-8 mr-3" />
                Управление Баллами
              </h1>
              <p className="mt-2 text-yellow-100">
                Система баллов канала и кастомные награды
              </p>
            </div>
            
            <div className="text-right">
              <div className="text-3xl font-bold">💰</div>
              <p className="text-sm text-yellow-100">Channel Points</p>
            </div>
          </div>
        </div>

        {/* Статистика */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="flex items-center">
              <div className="p-3 bg-blue-100 rounded-lg">
                <Users className="w-6 h-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-600">Пользователей</p>
                <p className="text-2xl font-bold text-gray-900">{stats.total_users}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="flex items-center">
              <div className="p-3 bg-yellow-100 rounded-lg">
                <Coins className="w-6 h-6 text-yellow-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-600">Всего баллов</p>
                <p className="text-2xl font-bold text-gray-900">{stats.total_points.toLocaleString()}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="flex items-center">
              <div className="p-3 bg-green-100 rounded-lg">
                <Gift className="w-6 h-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-600">Активных наград</p>
                <p className="text-2xl font-bold text-gray-900">{stats.active_rewards}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="flex items-center">
              <div className="p-3 bg-orange-100 rounded-lg">
                <Clock className="w-6 h-6 text-orange-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-600">В очереди</p>
                <p className="text-2xl font-bold text-gray-900">{stats.pending_rewards}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Вкладки */}
        <div className="bg-white rounded-lg shadow-sm border">
          <div className="border-b border-gray-200">
            <nav className="-mb-px flex space-x-8 px-6">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center ${
                      activeTab === tab.id
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <Icon className="w-4 h-4 mr-2" />
                    {tab.name}
                  </button>
                );
              })}
            </nav>
          </div>

          <div className="p-6">
            {/* Содержимое вкладок */}
            {activeTab === 'overview' && (
              <OverviewTab stats={stats} />
            )}
            
            {activeTab === 'rewards' && (
              <RewardsTab 
                rewards={rewards} 
                onRewardCreated={loadData}
                showCreate={showCreateReward}
                setShowCreate={setShowCreateReward}
              />
            )}
            
            {activeTab === 'queue' && (
              <QueueTab 
                queue={rewardQueue} 
                onQueueUpdated={loadData}
              />
            )}
            
            {activeTab === 'leaderboard' && (
              <LeaderboardTab leaderboard={leaderboard} />
            )}
            
            {activeTab === 'settings' && (
              <SettingsTab />
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
};

// Компонент обзора
const OverviewTab = ({ stats }) => (
  <div className="space-y-6">
    <h3 className="text-lg font-semibold">Общая статистика</h3>
    
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div className="space-y-4">
        <h4 className="font-medium text-gray-900">Активность пользователей</h4>
        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-sm text-gray-600">Данные за последние 30 дней будут доступны после интеграции</p>
        </div>
      </div>
      
      <div className="space-y-4">
        <h4 className="font-medium text-gray-900">Популярные награды</h4>
        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-sm text-gray-600">Статистика обменов будет доступна после накопления данных</p>
        </div>
      </div>
    </div>
  </div>
);

// Компонент управления наградами
const RewardsTab = ({ rewards, onRewardCreated, showCreate, setShowCreate }) => {
  const [newReward, setNewReward] = useState({
    title: '',
    description: '',
    cost: 100,
    platform: 'twitch',
    channel_name: 'test_channel',
    background_color: '#3B82F6'
  });

  const createReward = async () => {
    try {
      const response = await fetch('/api/points/rewards/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(newReward)
      });

      if (response.ok) {
        setNewReward({
          title: '',
          description: '',
          cost: 100,
          platform: 'twitch',
          channel_name: 'test_channel',
          background_color: '#3B82F6'
        });
        setShowCreate(false);
        onRewardCreated();
      }
    } catch (err) {
      console.error('Error creating reward:', err);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Кастомные награды</h3>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4 mr-2" />
          Создать награду
        </button>
      </div>

      {/* Форма создания награды */}
      {showCreate && (
        <div className="bg-gray-50 border rounded-lg p-6">
          <h4 className="font-medium mb-4">Новая награда</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Название
              </label>
              <input
                type="text"
                value={newReward.title}
                onChange={(e) => setNewReward({...newReward, title: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Название награды"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Стоимость (баллы)
              </label>
              <input
                type="number"
                value={newReward.cost}
                onChange={(e) => setNewReward({...newReward, cost: parseInt(e.target.value)})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                min="1"
              />
            </div>
            
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Описание
              </label>
              <textarea
                value={newReward.description}
                onChange={(e) => setNewReward({...newReward, description: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                rows="3"
                placeholder="Описание награды"
              />
            </div>
          </div>
          
          <div className="flex justify-end space-x-3 mt-4">
            <button
              onClick={() => setShowCreate(false)}
              className="px-4 py-2 text-gray-600 hover:text-gray-800"
            >
              Отмена
            </button>
            <button
              onClick={createReward}
              disabled={!newReward.title || !newReward.description}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              Создать
            </button>
          </div>
        </div>
      )}

      {/* Список наград */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {rewards.map((reward) => (
          <div key={reward.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <h4 className="font-medium text-gray-900">{reward.title}</h4>
                <p className="text-sm text-gray-600 mt-1">{reward.description}</p>
              </div>
              
              <div className="flex items-center space-x-2">
                <button className="p-1 text-gray-400 hover:text-blue-600">
                  <Edit className="w-4 h-4" />
                </button>
                <button className="p-1 text-gray-400 hover:text-red-600">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
            
            <div className="flex items-center justify-between">
              <span className="flex items-center text-yellow-600 font-medium">
                <Coins className="w-4 h-4 mr-1" />
                {reward.cost}
              </span>
              
              <span className={`px-2 py-1 rounded-full text-xs ${
                reward.is_enabled 
                  ? 'bg-green-100 text-green-700' 
                  : 'bg-gray-100 text-gray-600'
              }`}>
                {reward.is_enabled ? 'Активна' : 'Отключена'}
              </span>
            </div>
          </div>
        ))}
      </div>

      {rewards.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <Gift className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p className="text-lg font-medium mb-2">Нет наград</p>
          <p className="text-sm">Создайте первую кастомную награду для зрителей</p>
        </div>
      )}
    </div>
  );
};

// Компонент очереди наград
const QueueTab = ({ queue, onQueueUpdated }) => (
  <div className="space-y-6">
    <h3 className="text-lg font-semibold">Очередь наград</h3>
    
    {queue.length === 0 ? (
      <div className="text-center py-12 text-gray-500">
        <Clock className="w-12 h-12 mx-auto mb-3 text-gray-300" />
        <p className="text-lg font-medium mb-2">Очередь пуста</p>
        <p className="text-sm">Обмены наград будут отображаться здесь</p>
      </div>
    ) : (
      <div className="space-y-4">
        {queue.map((item) => (
          <div key={item.id} className="border rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h4 className="font-medium">{item.reward_title}</h4>
                <p className="text-sm text-gray-600">
                  {item.viewer_name} • {item.platform} • {item.points_cost} баллов
                </p>
              </div>
              
              <span className={`px-3 py-1 rounded-full text-sm ${
                item.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                item.status === 'approved' ? 'bg-green-100 text-green-700' :
                item.status === 'rejected' ? 'bg-red-100 text-red-700' :
                'bg-blue-100 text-blue-700'
              }`}>
                {item.status === 'pending' ? 'Ожидает' :
                 item.status === 'approved' ? 'Одобрено' :
                 item.status === 'rejected' ? 'Отклонено' : 'Выполнено'}
              </span>
            </div>
            
            {item.user_input && (
              <div className="mb-3 p-3 bg-gray-50 rounded">
                <p className="text-sm"><strong>Сообщение:</strong> {item.user_input}</p>
              </div>
            )}
            
            {item.status === 'pending' && (
              <div className="flex space-x-2">
                <button className="flex items-center px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700">
                  <CheckCircle className="w-4 h-4 mr-1" />
                  Одобрить
                </button>
                <button className="flex items-center px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700">
                  <XCircle className="w-4 h-4 mr-1" />
                  Отклонить
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    )}
  </div>
);

// Компонент топа пользователей
const LeaderboardTab = ({ leaderboard }) => (
  <div className="space-y-6">
    <h3 className="text-lg font-semibold">Топ пользователей</h3>
    
    {leaderboard.length === 0 ? (
      <div className="text-center py-12 text-gray-500">
        <Award className="w-12 h-12 mx-auto mb-3 text-gray-300" />
        <p className="text-lg font-medium mb-2">Нет данных</p>
        <p className="text-sm">Топ пользователей появится после начисления баллов</p>
      </div>
    ) : (
      <div className="bg-white rounded-lg border">
        {leaderboard.map((user, index) => (
          <div key={index} className={`flex items-center justify-between p-4 ${
            index < leaderboard.length - 1 ? 'border-b' : ''
          }`}>
            <div className="flex items-center space-x-3">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                index === 0 ? 'bg-yellow-100 text-yellow-700' :
                index === 1 ? 'bg-gray-100 text-gray-700' :
                index === 2 ? 'bg-orange-100 text-orange-700' :
                'bg-blue-100 text-blue-700'
              }`}>
                #{user.rank}
              </div>
              
              <div>
                <p className="font-medium">{user.viewer_name}</p>
                <p className="text-sm text-gray-600">{user.platform}</p>
              </div>
            </div>
            
            <div className="text-right">
              <p className="font-bold text-yellow-600">{user.points.toLocaleString()}</p>
              <p className="text-xs text-gray-500">
                Заработано: {user.total_earned.toLocaleString()}
              </p>
            </div>
          </div>
        ))}
      </div>
    )}
  </div>
);

// Компонент настроек
const SettingsTab = () => (
  <div className="space-y-6">
    <h3 className="text-lg font-semibold">Настройки баллов</h3>
    
    <div className="space-y-4">
      <div className="border rounded-lg p-4">
        <h4 className="font-medium mb-2">Автоматическое начисление</h4>
        <p className="text-sm text-gray-600 mb-3">Настройки будут доступны после интеграции с чат-ботами</p>
        
        <div className="space-y-3">
          <label className="flex items-center">
            <input type="checkbox" className="rounded" />
            <span className="ml-2 text-sm">За просмотр стрима (1 балл/минуту)</span>
          </label>
          
          <label className="flex items-center">
            <input type="checkbox" className="rounded" />
            <span className="ml-2 text-sm">За сообщения в чате (5 баллов)</span>
          </label>
          
          <label className="flex items-center">
            <input type="checkbox" className="rounded" />
            <span className="ml-2 text-sm">За подписку (500 баллов)</span>
          </label>
        </div>
      </div>
      
      <div className="border rounded-lg p-4">
        <h4 className="font-medium mb-2">Лимиты</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Максимум баллов на пользователя
            </label>
            <input
              type="number"
              defaultValue="10000"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Максимум баллов за день
            </label>
            <input
              type="number"
              defaultValue="1000"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
);

export default PointsManagementPage;
