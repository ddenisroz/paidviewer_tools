import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { logger } from '../../utils/prodLogger';
import CommonClosed from '../../images/lootboxes/common/common_closed.png';
import CommonOpened from '../../images/lootboxes/common/common_opened.png';
import RareClosed from '../../images/lootboxes/rare/rare_closed.png';
import RareOpened from '../../images/lootboxes/rare/rare_opened_.png';
import EpicClosed from '../../images/lootboxes/epic/epic_closed.png';
import EpicOpened from '../../images/lootboxes/epic/epic_opened.png';
import LegendaryClosed from '../../images/lootboxes/legendary/legendary_closed.png';
import LegendaryOpened from '../../images/lootboxes/legendary/legendary_opened.png';
import MythycClosed from '../../images/lootboxes/mythyc/mythyc_closed.png';
import MythycOpened from '../../images/lootboxes/mythyc/mythyc_opened.png';

const QUALITY_IMAGES = {
  'common': { closed: CommonClosed, opened: CommonOpened },
  'rare': { closed: RareClosed, opened: RareOpened },
  'epic': { closed: EpicClosed, opened: EpicOpened },
  'legendary': { closed: LegendaryClosed, opened: LegendaryOpened },
  'mythical': { closed: MythycClosed, opened: MythycOpened },
  'mythyc': { closed: MythycClosed, opened: MythycOpened }
};

const DropsWidget = () => {
  const { token } = useParams();
  const [currentReward, setCurrentReward] = useState(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [animationPhase, setAnimationPhase] = useState('idle'); // idle, spinning, opening, opened
  const ws = useRef(null);
  const [status, setStatus] = useState('Подключение...');
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [widgetConfig, setWidgetConfig] = useState({
    spinning_duration: 1500,
    opening_duration: 1000,
    result_duration: 5500
  });

  useEffect(() => {
    // Проверяем режим предпросмотра из URL
    const urlParams = new URLSearchParams(window.location.search);
    const preview = urlParams.get('preview');
    if (preview === 'true') {
      setIsPreviewMode(true);
      setStatus('Режим предпросмотра - нажмите кнопку для тестирования анимации');
      // Загружаем настройки виджета для предпросмотра
      const apiUrl = import.meta.env.VITE_BOT_SERVICE_URL;
      if (apiUrl && token) {
        // Пытаемся получить настройки через токен
        fetch(`${apiUrl}/api/drops/user-from-token/${token}`)
          .then(res => res.json())
          .then(data => {
            if (data.channel_name && data.platform) {
              return fetch(`${apiUrl}/api/drops/config/${data.channel_name}?platform=${data.platform}`);
            }
          })
          .then(res => res?.json())
          .then(configData => {
            if (configData?.success && configData.data) {
              setWidgetConfig({
                spinning_duration: configData.data.widget_spinning_duration_ms || 1500,
                opening_duration: configData.data.widget_opening_duration_ms || 1000,
                result_duration: configData.data.widget_result_duration_ms || 5500
              });
            }
          })
          .catch(err => logger.error('Error loading preview config:', err));
      }
      return; // Не подключаемся к WebSocket в режиме предпросмотра
    }

    if (!token) {
      logger.error('No token provided');
      setStatus('Ошибка: Отсутствует токен');
      return;
    }

    const wsBaseUrl = import.meta.env.VITE_BOT_SERVICE_WS_URL;
    const apiUrl = import.meta.env.VITE_BOT_SERVICE_URL;
    
    if (!wsBaseUrl || !apiUrl) {
      logger.error('Missing environment variables');
      setStatus('Ошибка: WebSocket URL не настроен');
      return;
    }

    let userId = null;

    // Сначала получаем user_id из токена
    const fetchUserId = async () => {
      try {
        const response = await fetch(`${apiUrl}/api/drops/user-from-token/${token}`);
        if (!response.ok) {
          setStatus('Ошибка: Недействительный токен');
          return;
        }
        const data = await response.json();
        userId = data.user_id;
        
        // Загружаем настройки виджета
        if (userId && data.channel_name && data.platform) {
          try {
            const configResponse = await fetch(`${apiUrl}/api/drops/config/${data.channel_name}?platform=${data.platform}`);
            if (configResponse.ok) {
              const configData = await configResponse.json();
              if (configData.success && configData.data) {
                setWidgetConfig({
                  spinning_duration: configData.data.widget_spinning_duration_ms || 1500,
                  opening_duration: configData.data.widget_opening_duration_ms || 1000,
                  result_duration: configData.data.widget_result_duration_ms || 5500
                });
              }
            }
          } catch (configError) {
            logger.error('Error loading widget config:', configError);
            // Продолжаем с дефолтными значениями
          }
        }
        
        // Теперь подключаемся к WebSocket
        const wsUrl = `${wsBaseUrl}/ws/chat/${userId}`;
        const websocket = new WebSocket(wsUrl);

        websocket.onopen = () => {
          logger.log('Connected to drops WebSocket');
          setWs(websocket);
          setStatus('Ожидание наград...');
        };

        websocket.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'drops' && data.event === 'reward_received') {
              showReward(data.data);
            }
          } catch (error) {
            logger.error('Error parsing WebSocket message:', error);
          }
        };

        websocket.onclose = () => {
          logger.log('Drops WebSocket disconnected');
          setWs(null);
          setStatus('Переподключение...');
          // Попытка переподключения
          setTimeout(() => {
            const reconnectWs = new WebSocket(wsUrl);
            reconnectWs.onopen = websocket.onopen;
            reconnectWs.onmessage = websocket.onmessage;
            reconnectWs.onclose = websocket.onclose;
            reconnectWs.onerror = websocket.onerror;
            ws.current = reconnectWs;
          }, 3000);
        };

        websocket.onerror = (error) => {
          logger.error('Drops WebSocket error:', error);
        };

        ws.current = websocket;
      } catch (error) {
        logger.error('Error fetching user ID:', error);
        setStatus('Ошибка: Не удалось подключиться');
      }
    };

    fetchUserId();

    return () => {
      if (ws.current) {
        ws.current.close();
      }
    };
  }, [token]);

  const showReward = (rewardData) => {
    setCurrentReward(rewardData);
    setIsAnimating(true);
    setAnimationPhase('spinning');

    // Проигрываем звук если есть
    if (rewardData.sound_file) {
      const audio = new Audio(rewardData.sound_file);
      audio.volume = rewardData.sound_volume || 1.0;
      audio.play().catch(console.error);
    }

    // Анимация с настраиваемыми длительностями
    setTimeout(() => {
      setAnimationPhase('opening');
    }, widgetConfig.spinning_duration);

    setTimeout(() => {
      setAnimationPhase('opened');
    }, widgetConfig.spinning_duration + widgetConfig.opening_duration);

    // После показа результата просто скрываем виджет без анимации закрытия
    setTimeout(() => {
      setIsAnimating(false);
      setCurrentReward(null);
      setAnimationPhase('idle');
    }, widgetConfig.spinning_duration + widgetConfig.opening_duration + widgetConfig.result_duration);
  };

  const getQualityImages = (quality) => {
    const qualityLower = quality?.toLowerCase();
    return QUALITY_IMAGES[qualityLower] || QUALITY_IMAGES['common'];
  };

  const getQualityColor = (quality) => {
    switch (quality?.toLowerCase()) {
      case 'common':
        return 'from-gray-500 to-gray-600';
      case 'rare':
        return 'from-blue-500 to-blue-600';
      case 'epic':
        return 'from-purple-500 to-purple-600';
      case 'legendary':
        return 'from-yellow-500 to-yellow-600';
      case 'mythical':
      case 'mythyc':
        return 'from-pink-500 to-pink-600';
      default:
        return 'from-gray-500 to-gray-600';
    }
  };

  // Тестовая анимация для режима предпросмотра
  const testAnimation = () => {
    const testReward = {
      quality: 'epic',
      viewer_name: 'TestViewer',
      reward: '1000 очков',
      reward_type: 'points',
      streak_days: 5,
      donation_amount: null,
      sound_file: null,
      sound_volume: 1.0
    };
    showReward(testReward);
  };

  // Показываем status если не подключены
  if (!isAnimating || !currentReward) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-900 to-black rounded-lg">
        <div className="text-center text-white/40">
          <div className="mb-4">
            <img 
              src={CommonClosed} 
              alt="Waiting"
              className="w-32 h-32 mx-auto opacity-30"
            />
          </div>
          <p className="text-sm font-medium mb-4">{status}</p>
          {isPreviewMode && (
            <button
              onClick={testAnimation}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors font-medium"
            >
              🎬 Тестировать анимацию
            </button>
          )}
        </div>
      </div>
    );
  }

  const images = getQualityImages(currentReward.quality);

  return (
    <div className="w-full h-full flex items-center justify-center">
      {/* Анимация крутки и открытия */}
      <div className="relative w-full h-full">
        {/* Основной контейнер сундука */}
        <div className={`relative w-full h-full flex items-center justify-center transition-all duration-300 ${
          animationPhase === 'spinning' ? 'animate-spin' : ''
        } ${
          animationPhase === 'opening' ? 'scale-110' : ''
        } ${
          animationPhase === 'opened' ? 'scale-100' : ''
        }`}>
          <img 
            src={animationPhase === 'opened' ? images.opened : images.closed}
            alt={`${currentReward.quality} chest`}
            className="w-64 h-64 object-contain transition-all duration-500"
          />
        </div>

        {/* Информация о награде (появляется после открытия) */}
        {animationPhase === 'opened' && (
          <div className={`absolute inset-0 flex flex-col items-center justify-center animate-fade-in`}>
            <div className="bg-gradient-to-r from-black/90 to-black/70 rounded-xl p-6 backdrop-blur-lg border-2 border-white/20 max-w-md">
              {/* Имя зрителя */}
              <h2 className={`text-2xl font-bold mb-3 bg-gradient-to-r ${getQualityColor(currentReward.quality)} bg-clip-text text-transparent`}>
                {currentReward.viewer_name}
              </h2>

              {/* Награда */}
              <div className="mb-4">
                <h3 className="text-xl font-semibold text-white mb-1">
                  {currentReward.reward}
                </h3>
                <p className="text-sm text-white/60 capitalize">
                  {currentReward.reward_type}
                </p>
              </div>

              {/* Дополнительная информация */}
              <div className="flex flex-col gap-2 text-sm text-white/80">
                {currentReward.streak_days && (
                  <div>Стрик: {currentReward.streak_days} дней</div>
                )}
                {currentReward.donation_amount && (
                  <div>Донат: {currentReward.donation_amount}₽</div>
                )}
              </div>

              {/* Качество */}
              <div className={`mt-4 inline-block px-4 py-2 rounded-lg bg-gradient-to-r ${getQualityColor(currentReward.quality)} text-white font-bold`}>
                {currentReward.quality.toUpperCase()}
              </div>
            </div>
          </div>
        )}

        {/* Анимация частиц вокруг сундука */}
        {isAnimating && animationPhase !== 'idle' && (
          <div className="absolute inset-0 pointer-events-none">
            {[...Array(30)].map((_, i) => (
              <div
                key={i}
                className={`absolute w-2 h-2 bg-white rounded-full ${
                  animationPhase === 'opening' || animationPhase === 'opened' ? 'animate-ping' : ''
                }`}
                style={{
                  left: `${Math.random() * 100}%`,
                  top: `${Math.random() * 100}%`,
                  animationDelay: `${Math.random() * 2}s`,
                  animationDuration: `${1 + Math.random()}s`
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default DropsWidget;
