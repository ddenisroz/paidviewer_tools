import React from 'react';
import Layout from '../components/Layout';
import YouTubeQueueCarousel from '../components/YouTubeQueueCarousel';
import { Play, Music, Settings, TrendingUp } from 'lucide-react';

const YouTubeQueuePage = () => {
  return (
    <Layout>
      <div className="space-y-6">
        {/* Заголовок страницы */}
        <div className="bg-gradient-to-r from-red-500 to-pink-500 rounded-lg p-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold mb-6 text-foreground flex items-center">
                <Play className="w-8 h-8 mr-3" />
                YouTube Очередь
              </h1>
              <p className="mt-2 text-red-100">
                Управляйте очередью заказанных видео от зрителей
              </p>
            </div>
            
            <div className="text-right">
              <div className="text-3xl font-bold">🎵</div>
              <p className="text-sm text-red-100">Song Requests</p>
            </div>
          </div>
        </div>

        {/* Статистика и быстрые действия */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Статистика */}
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="flex items-center">
              <div className="p-3 bg-blue-100 rounded-lg">
                <Music className="w-6 h-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-600">Сегодня заказано</p>
                <p className="text-2xl font-bold text-gray-900">42</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="flex items-center">
              <div className="p-3 bg-green-100 rounded-lg">
                <TrendingUp className="w-6 h-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-600">Активных зрителей</p>
                <p className="text-2xl font-bold text-gray-900">156</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="flex items-center">
              <div className="p-3 bg-purple-100 rounded-lg">
                <Settings className="w-6 h-6 text-purple-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-600">Настройки</p>
                <button className="text-purple-600 hover:text-purple-700 font-medium">
                  Изменить
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Основной контент - карусель очереди */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Очередь видео */}
          <div className="lg:col-span-2">
            <YouTubeQueueCarousel />
          </div>

          {/* Боковая панель с дополнительной информацией */}
          <div className="space-y-6">
            {/* Текущее видео */}
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Сейчас играет
              </h3>
              
              <div className="text-center py-8 text-gray-500">
                <Play className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p>Видео не воспроизводится</p>
                <p className="text-sm mt-1">Выберите видео из очереди</p>
              </div>
            </div>

            {/* Настройки очереди */}
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Настройки очереди
              </h3>
              
              <div className="space-y-4">
                <div>
                  <label className="flex items-center">
                    <input type="checkbox" className="rounded border-gray-300" defaultChecked />
                    <span className="ml-2 text-sm text-gray-700">Автопроигрывание</span>
                  </label>
                </div>
                
                <div>
                  <label className="flex items-center">
                    <input type="checkbox" className="rounded border-gray-300" />
                    <span className="ml-2 text-sm text-gray-700">Только подписчики</span>
                  </label>
                </div>
                
                <div>
                  <label className="flex items-center">
                    <input type="checkbox" className="rounded border-gray-300" defaultChecked />
                    <span className="ml-2 text-sm text-gray-700">Модерация заказов</span>
                  </label>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Макс. длительность (мин)
                  </label>
                  <input
                    type="number"
                    defaultValue="10"
                    min="1"
                    max="60"
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Популярные команды */}
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Команды чата
              </h3>
              
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <code className="bg-gray-100 px-2 py-1 rounded">!sr &lt;URL&gt;</code>
                  <span className="text-gray-600">Заказать видео</span>
                </div>
                
                <div className="flex justify-between">
                  <code className="bg-gray-100 px-2 py-1 rounded">!queue</code>
                  <span className="text-gray-600">Показать очередь</span>
                </div>
                
                <div className="flex justify-between">
                  <code className="bg-gray-100 px-2 py-1 rounded">!next</code>
                  <span className="text-gray-600">Следующее видео</span>
                </div>
                
                <div className="flex justify-between">
                  <code className="bg-gray-100 px-2 py-1 rounded">!skip</code>
                  <span className="text-gray-600">Пропустить видео</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Уведомление */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <Play className="h-5 w-5 text-blue-400" />
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-blue-800">
                YouTube Song Requests активны!
              </h3>
              <div className="mt-2 text-sm text-blue-700">
                <p>
                  Зрители могут заказывать видео через команду <code className="bg-blue-100 px-1 rounded">!sr</code> в чате.
                  Все заказы будут отображаться в очереди выше.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default YouTubeQueuePage;
