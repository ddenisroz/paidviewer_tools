import React, { useState, useEffect } from 'react';
import { Mic, MicOff, Volume2, Monitor } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { TwitchIcon, VKIcon } from '../shared/components/PlatformIcons';
import { logger } from '../utils/prodLogger';
import { useTtsPlatformSettings, useSaveTtsPlatformSettings } from '../queries/tts/ttsQueries';

interface TtsPlatformSettings {
  enabled_platforms: string[];
  global_enabled: boolean;
}

const TtsPlatformSelector: React.FC = () => {
  const { user } = useAuth();
  // ✅ НОВЫЙ КОД: Используем централизованные hooks для настроек платформы TTS
  const { data: platformSettingsResponse, isLoading: loading, isInitialLoading: initialLoading } = useTtsPlatformSettings({
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });
  const platformSettingsData = platformSettingsResponse?.data;
  
  const [settings, setSettings] = useState<TtsPlatformSettings>({
    enabled_platforms: ['twitch', 'vk'],
    global_enabled: true
  });

  // ✅ НОВЫЙ КОД: Синхронизируем состояние с данными из React Query
  useEffect(() => {
    if (platformSettingsData) {
      setSettings({
        enabled_platforms: platformSettingsData.enabled_platforms || ['twitch', 'vk'],
        global_enabled: platformSettingsData.global_enabled !== false
      });
      logger.log('🔄 [TTS SELECTOR] State updated from React Query:', {
        enabled_platforms: platformSettingsData.enabled_platforms,
        twitch_enabled: platformSettingsData.enabled_platforms?.includes('twitch'),
        vk_enabled: platformSettingsData.enabled_platforms?.includes('vk')
      });
    }
  }, [platformSettingsData]);

  // ✅ НОВЫЙ КОД: Используем централизованный mutation для сохранения настроек
  const savePlatformSettingsMutation = useSaveTtsPlatformSettings({
    onSuccess: (response, variables) => {
      const newSettings = {
        enabled_platforms: variables.enabled_platforms,
        global_enabled: settings.global_enabled
      };
      setSettings(newSettings);
      
      // 🔄 Отправляем событие для синхронизации с нижними кнопками
      window.dispatchEvent(new CustomEvent('tts-settings-changed', {
        detail: { enabledPlatforms: variables.enabled_platforms }
      }));
      logger.log('🔄 [TTS SELECTOR] Dispatched settings update:', variables.enabled_platforms);
      // toast уже показан в hook
    },
    onError: (error) => {
      logger.error('Error saving TTS settings:', error);
      // toast уже показан в hook
    },
  });

  const saving = savePlatformSettingsMutation.isPending;

  // Сохранение настроек
  const saveSettings = (newSettings: TtsPlatformSettings) => {
    // Отправляем только enabled_platforms
    savePlatformSettingsMutation.mutate({
      enabled_platforms: newSettings.enabled_platforms
    });
  };

  // Переключение глобального TTS
  const toggleGlobalTts = () => {
    const newSettings = {
      ...settings,
      global_enabled: !settings.global_enabled
    };
    setSettings(newSettings);
    // Глобальный TTS не сохраняется через platform-settings, это отдельный endpoint
    // Пока оставляем только локальное обновление
  };

  // Переключение платформы
  const togglePlatform = (platform: string) => {
    const enabledPlatforms = [...settings.enabled_platforms];
    const index = enabledPlatforms.indexOf(platform);
    
    if (index > -1) {
      enabledPlatforms.splice(index, 1);
    } else {
      enabledPlatforms.push(platform);
    }

    const newSettings = {
      ...settings,
      enabled_platforms: enabledPlatforms
    };
    saveSettings(newSettings);
  };

  useEffect(() => {
    // 🔄 Слушаем изменения TTS настроек из нижних кнопок
    const handleTtsSettingsChanged = (event: CustomEvent<{ enabledPlatforms: string[] }>) => {
      const { enabledPlatforms } = event.detail;
      logger.log('🔄 [TTS SELECTOR] Received settings update from shortcuts:', enabledPlatforms);
      setSettings(prev => {
        logger.log('🔄 [TTS SELECTOR] Updating state from', prev.enabled_platforms, 'to', enabledPlatforms);
        return {
          ...prev,
          enabled_platforms: enabledPlatforms
        };
      });
    };
    
    window.addEventListener('tts-settings-changed', handleTtsSettingsChanged as EventListener);
    
    return () => {
      window.removeEventListener('tts-settings-changed', handleTtsSettingsChanged as EventListener);
    };
  }, []);

  // ⚡ Показываем скелетон ТОЛЬКО при первой загрузке
  if (initialLoading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="space-y-3">
            <div className="h-12 bg-gray-200 rounded"></div>
            <div className="h-12 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  const platforms = [
    {
      id: 'twitch',
      name: 'Twitch',
      icon: <TwitchIcon className="w-5 h-5" />,
      color: 'purple',
      description: 'Озвучка сообщений из Twitch чата'
    },
    {
      id: 'vk',
      name: 'VK Live',
      icon: <VKIcon className="w-5 h-5" />,
      color: 'blue',
      description: 'Озвучка сообщений из VK Live чата'
    }
  ];

  return (
    <div className="bg-white rounded-lg shadow-sm border">
      {/* Заголовок */}
      <div className="p-6 border-b">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 flex items-center">
              <Volume2 className="w-5 h-5 mr-2 text-blue-500" />
              Настройки TTS
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              Выбор платформ для озвучки
            </p>
          </div>
          
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-600">TTS</span>
            <button
              onClick={toggleGlobalTts}
              disabled={saving}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                settings.global_enabled 
                  ? 'bg-blue-600' 
                  : 'bg-gray-200'
              } ${saving ? 'opacity-50' : ''}`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  settings.global_enabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* Глобальный статус */}
      <div className="p-6 border-b">
        <div className={`flex items-center p-4 rounded-lg ${
          settings.global_enabled 
            ? 'bg-green-50 border border-green-200' 
            : 'bg-gray-50 border border-gray-200'
        }`}>
          <div className={`p-2 rounded-lg ${
            settings.global_enabled ? 'bg-green-100' : 'bg-gray-100'
          }`}>
            {settings.global_enabled ? (
              <Mic className="w-5 h-5 text-green-600" />
            ) : (
              <MicOff className="w-5 h-5 text-gray-500" />
            )}
          </div>
          
          <div className="ml-3 flex-1">
            <p className={`font-medium ${
              settings.global_enabled ? 'text-green-900' : 'text-gray-700'
            }`}>
              {settings.global_enabled ? 'TTS включен' : 'TTS выключен'}
            </p>
            <p className={`text-sm ${
              settings.global_enabled ? 'text-green-700' : 'text-gray-500'
            }`}>
              {settings.global_enabled 
                ? `Активен на ${settings.enabled_platforms.length} платформе(ах)`
                : 'Озвучка сообщений отключена'
              }
            </p>
          </div>
        </div>
      </div>

      {/* Настройки по платформам */}
      <div className="p-6">
        <h4 className="text-md font-medium text-gray-900 mb-4">
          Выбор платформ
        </h4>
        
        <div className="space-y-4">
          {platforms.map(platform => {
            const isEnabled = settings.enabled_platforms.includes(platform.id);
            const isActive = settings.global_enabled && isEnabled;
            
            return (
              <div key={platform.id} className="flex items-center justify-between p-4 rounded-lg border border-gray-200 hover:border-gray-300 transition-colors">
                <div className="flex items-center space-x-3">
                  <div className={`p-2 rounded-lg ${
                    isActive 
                      ? `bg-${platform.color}-100` 
                      : 'bg-gray-100'
                  }`}>
                    <div className={`text-${platform.color}-600`}>
                      {platform.icon}
                    </div>
                  </div>
                  
                  <div>
                    <h5 className="font-medium text-gray-900">{platform.name}</h5>
                    <p className="text-sm text-gray-600">{platform.description}</p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-3">
                  {/* Статус */}
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    isActive 
                      ? `bg-${platform.color}-100 text-${platform.color}-700` 
                      : 'bg-gray-100 text-gray-600'
                  }`}>
                    {isActive ? 'Активен' : 'Выключен'}
                  </span>
                  
                  {/* Переключатель */}
                  <button
                    onClick={() => togglePlatform(platform.id)}
                    disabled={saving || !settings.global_enabled}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      isEnabled && settings.global_enabled
                        ? `bg-${platform.color}-600` 
                        : 'bg-gray-200'
                    } ${saving || !settings.global_enabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        isEnabled ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>


      {/* Информация */}
      {settings.global_enabled && settings.enabled_platforms.length === 0 && (
        <div className="p-4 border-t bg-yellow-50 border-yellow-200">
          <div className="flex">
            <div className="flex-shrink-0">
              <Monitor className="h-5 w-5 text-yellow-400" />
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-yellow-800">
                TTS включен, но нет активных платформ
              </h3>
              <div className="mt-2 text-sm text-yellow-700">
                <p>Выберите хотя бы одну платформу для озвучки сообщений.</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TtsPlatformSelector;



