import React, { useState, useEffect } from 'react';
import { Gift, Plus, Edit, Trash2, Upload } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { TwitchIcon, VKIcon } from '../components/PlatformIcons';

const PointsManagementPage = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('rewards');
  const [selectedPlatform, setSelectedPlatform] = useState('twitch'); // twitch или vk
  const [rewards, setRewards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateReward, setShowCreateReward] = useState(false);

  // Загрузка наград с выбранной платформы
  const loadRewards = async () => {
    try {
      setLoading(true);
      
      // Загружаем реальные награды с платформы
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/points/rewards/${selectedPlatform}`, {
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      console.log('Rewards response status:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        setRewards(data.rewards || []);
      } else {
        const errorText = await response.text();
        console.error('Failed to load rewards:', response.status, errorText);
        setRewards([]);
      }

    } catch (err) {
      console.error('Error loading rewards:', err);
      setRewards([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRewards();
  }, [selectedPlatform]);

  const tabs = [
    { id: 'rewards', name: 'Награды', icon: Gift }
  ];

  if (loading && activeTab === 'rewards') {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="space-y-6">
        {/* Заголовок */}
        <div>
            <h1 className="text-3xl font-bold mb-6 text-foreground">
              Управление баллами канала
            </h1>
        </div>

        {/* Переключение платформ */}
        <div className="bg-card rounded-lg shadow-sm border p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Платформа</h3>
            <div className="flex bg-muted rounded-lg p-1">
              <button
                onClick={() => setSelectedPlatform('twitch')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${
                  selectedPlatform === 'twitch'
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <TwitchIcon className="w-4 h-4" />
                Twitch
              </button>
              <button
                onClick={() => setSelectedPlatform('vk')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${
                  selectedPlatform === 'vk'
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <VKIcon className="w-4 h-4" />
                VK Live
              </button>
            </div>
          </div>
        </div>

        {/* Вкладки */}
        <div className="bg-card rounded-lg shadow-sm border">
          <div className="border-b border-border">
            <nav className="-mb-px flex space-x-8 px-6">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center ${
                      activeTab === tab.id
                        ? 'border-primary text-primary'
                        : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground'
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
            {activeTab === 'rewards' && (
              <RewardsTab 
                rewards={rewards} 
                platform={selectedPlatform}
                onRewardCreated={loadRewards}
                showCreate={showCreateReward}
                setShowCreate={setShowCreateReward}
              />
            )}
            
          </div>
        </div>
      </div>
    </div>
  );
};

// Упрощенный компонент управления наградами
const RewardsTab = ({ rewards, platform, onRewardCreated, showCreate, setShowCreate }) => {
  const [newReward, setNewReward] = useState({
    name: '',
    description: '',
    price: 100,
    soundFile: null
  });

  const createReward = async () => {
    try {

      const formData = new FormData();
      formData.append('name', newReward.name);
      formData.append('description', newReward.description);
      formData.append('price', newReward.price);
      formData.append('platform', platform);
      
      if (newReward.soundFile) {
        formData.append('sound', newReward.soundFile);
      }

      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/points/rewards/${platform}/create`, {
        method: 'POST',
        credentials: 'include',
        body: formData
      });

      console.log('Create reward response status:', response.status);

      if (response.ok) {
        setNewReward({
          name: '',
          description: '',
          price: 100,
          soundFile: null
        });
        setShowCreate(false);
        onRewardCreated();
      } else {
        const errorText = await response.text();
        console.error('Failed to create reward:', response.status, errorText);
      }
    } catch (err) {
      console.error('Error creating reward:', err);
    }
  };

  const deleteReward = async (rewardId) => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/points/rewards/${platform}/${rewardId}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      console.log('Delete reward response status:', response.status);

      if (response.ok) {
        onRewardCreated();
      } else {
        const errorText = await response.text();
        console.error('Failed to delete reward:', response.status, errorText);
      }
    } catch (err) {
      console.error('Error deleting reward:', err);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Награды {platform === 'twitch' ? 'Twitch' : 'VK Live'}</h3>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="flex items-center px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90"
        >
          <Plus className="w-4 h-4 mr-2" />
          Создать награду
        </button>
      </div>

      {/* Конструктор награды */}
      {showCreate && (
        <div className="bg-muted border rounded-lg p-6">
          <h4 className="font-medium mb-4">Новая награда</h4>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                Название
              </label>
              <input
                type="text"
                value={newReward.name}
                onChange={(e) => setNewReward({...newReward, name: e.target.value})}
                className="w-full px-3 py-2 border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder="Название награды"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">
                Описание
              </label>
              <textarea
                value={newReward.description}
                onChange={(e) => setNewReward({...newReward, description: e.target.value})}
                className="w-full px-3 py-2 border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
                rows="3"
                placeholder="Описание награды"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Стоимость (баллы)
                </label>
                <input
                  type="number"
                  value={newReward.price}
                  onChange={(e) => setNewReward({...newReward, price: parseInt(e.target.value)})}
                  className="w-full px-3 py-2 border border-input rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
                  min="1"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">
                  Звук активации
                </label>
                <div className="flex items-center space-x-2">
                  <input
                    type="file"
                    accept=".wav,.mp3,.ogg"
                    onChange={(e) => setNewReward({...newReward, soundFile: e.target.files[0]})}
                    className="hidden"
                    id="sound-upload"
                  />
                  <label
                    htmlFor="sound-upload"
                    className="flex items-center px-3 py-2 border border-input rounded-lg cursor-pointer hover:bg-muted/50"
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    {newReward.soundFile ? newReward.soundFile.name : 'Выберите файл'}
                  </label>
                </div>
              </div>
            </div>
          </div>
          
          <div className="flex justify-end space-x-3 mt-6">
            <button
              onClick={() => setShowCreate(false)}
              className="px-4 py-2 text-muted-foreground hover:text-foreground"
            >
              Отмена
            </button>
            <button
              onClick={createReward}
              disabled={!newReward.name || !newReward.description}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50"
            >
              Создать
            </button>
          </div>
        </div>
      )}

      {/* Сетка наград */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {rewards.map((reward) => (
          <div key={reward.id} className="border rounded-lg p-3 hover:shadow-md transition-shadow bg-card">
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1 min-w-0">
                <h4 className="font-medium text-sm truncate">{reward.name}</h4>
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{reward.description}</p>
              </div>
              
              <div className="flex items-center space-x-1 ml-2">
                <button 
                  className="p-1 text-muted-foreground hover:text-primary"
                  title="Редактировать"
                >
                  <Edit className="w-3 h-3" />
                </button>
                <button 
                  onClick={() => deleteReward(reward.id)}
                  className="p-1 text-muted-foreground hover:text-destructive"
                  title="Удалить"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>
            
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center text-yellow-600 font-medium">
                💰 {reward.price}
              </span>
              
              <span className={`px-2 py-1 rounded-full ${
                reward.is_disabled ? 'bg-muted text-muted-foreground' : 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400'
              }`}>
                {reward.is_disabled ? 'Выкл' : 'Вкл'}
              </span>
            </div>
          </div>
        ))}
      </div>

      {rewards.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <Gift className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p className="text-lg font-medium mb-2">Нет наград</p>
          <p className="text-sm">Создайте первую награду для зрителей</p>
        </div>
      )}
    </div>
  );
};

export default PointsManagementPage;