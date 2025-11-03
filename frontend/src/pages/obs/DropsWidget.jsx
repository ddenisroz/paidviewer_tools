import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { logger } from '../../utils/prodLogger';
import CommonOpened from '../../images/lootboxes/common/common_opened.png';
import RareOpened from '../../images/lootboxes/rare/rare_opened_.png';
import EpicOpened from '../../images/lootboxes/epic/epic_opened.png';
import LegendaryOpened from '../../images/lootboxes/legendary/legendary_opened.png';
import MythycOpened from '../../images/lootboxes/mythyc/mythyc_opened.png';

const QUALITY_IMAGES = {
  'common': CommonOpened,
  'rare': RareOpened,
  'epic': EpicOpened,
  'legendary': LegendaryOpened,
  'mythical': MythycOpened,
  'mythyc': MythycOpened
};

const DropsWidget = () => {
  const { token } = useParams();
  const [currentReward, setCurrentReward] = useState(null);
  const [allRewards, setAllRewards] = useState([]); // Все награды этого качества
  const [isAnimating, setIsAnimating] = useState(false);
  const [animationPhase, setAnimationPhase] = useState('idle'); // idle, opening, roulette, result
  const ws = useRef(null);
  const [status, setStatus] = useState('Подключение...');
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [roulettePosition, setRoulettePosition] = useState(0); // Позиция в рулетке
  const [channelName, setChannelName] = useState(null);
  const [platform, setPlatform] = useState(null);
  const widgetConfig = useRef({
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
              setChannelName(data.channel_name);
              setPlatform(data.platform);
              return fetch(`${apiUrl}/api/drops/config/${data.channel_name}?platform=${data.platform}`);
            }
          })
          .then(res => res?.json())
          .then(configData => {
            if (configData?.success && configData.data) {
              widgetConfig.current = {
                spinning_duration: configData.data.widget_spinning_duration_ms || 1500,
                opening_duration: configData.data.widget_opening_duration_ms || 1000,
                result_duration: configData.data.widget_result_duration_ms || 5500
              };
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

    // Сначала получаем user_id из токена
    const fetchUserId = async () => {
      try {
        const response = await fetch(`${apiUrl}/api/drops/user-from-token/${token}`);
        if (!response.ok) {
          setStatus('Ошибка: Недействительный токен');
          return;
        }
        const data = await response.json();
        const userId = data.user_id;
        setChannelName(data.channel_name);
        setPlatform(data.platform);
        
        // Загружаем настройки виджета
        if (userId && data.channel_name && data.platform) {
          try {
            const configResponse = await fetch(`${apiUrl}/api/drops/config/${data.channel_name}?platform=${data.platform}`);
            if (configResponse.ok) {
              const configData = await configResponse.json();
              if (configData.success && configData.data) {
                widgetConfig.current = {
                  spinning_duration: configData.data.widget_spinning_duration_ms || 1500,
                  opening_duration: configData.data.widget_opening_duration_ms || 1000,
                  result_duration: configData.data.widget_result_duration_ms || 5500
                };
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
          ws.current = websocket;
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
          ws.current = null;
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

  const loadRewardsForQuality = async (quality, channelName, platform) => {
    const apiUrl = import.meta.env.VITE_BOT_SERVICE_URL;
    try {
      const response = await fetch(`${apiUrl}/api/drops/rewards/${channelName}?platform=${platform}&quality=${quality}&widget_token=${token}`);
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data) {
          return data.data.filter(r => r.is_active); // Только активные награды
        }
      }
    } catch (error) {
      logger.error('Error loading rewards:', error);
    }
    return [];
  };

  const showReward = async (rewardData) => {
    // Загружаем все награды этого качества для рулетки
    const quality = rewardData.quality?.toLowerCase() || rewardData.quality;
    const rewards = await loadRewardsForQuality(quality, channelName, platform);
    
    // Дублируем награды для плавной анимации рулетки (чтобы она могла крутиться)
    const duplicatedRewards = [...rewards, ...rewards, ...rewards];
    setAllRewards(duplicatedRewards);
    
    setCurrentReward(rewardData);
    setIsAnimating(true);
    setAnimationPhase('opening'); // Сундук открывается сразу

    // Проигрываем звук если есть
    if (rewardData.sound_file) {
      const audio = new Audio(rewardData.sound_file);
      audio.volume = rewardData.sound_volume || 1.0;
      audio.play().catch((err) => logger.error('Error playing reward sound:', err));
    }

    // После открытия сундука начинается рулетка
    setTimeout(() => {
      setAnimationPhase('roulette');
      // Анимация прокрутки рулетки
      const startPosition = 0;
      const targetIndex = duplicatedRewards.findIndex(r => 
        r.id === rewardData.reward_id || 
        r.name === rewardData.reward_name ||
        (rewards.length > 0 && Math.floor(Math.random() * rewards.length))
      );
      const targetPosition = targetIndex >= 0 ? targetIndex : Math.floor(Math.random() * rewards.length);
      
      // Прокручиваем быстро, потом замедляем
      let currentPos = startPosition;
      const totalCards = duplicatedRewards.length;
      const finalPosition = targetPosition + rewards.length; // Добавляем один полный оборот
      const duration = widgetConfig.current.spinning_duration;
      const startTime = Date.now();
      
      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        // Easing функция для замедления
        const easeOut = 1 - Math.pow(1 - progress, 3);
        currentPos = startPosition + (finalPosition - startPosition) * easeOut;
        setRoulettePosition(currentPos);
        
        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          setAnimationPhase('result');
        }
      };
      
      animate();
    }, widgetConfig.current.opening_duration);

    // После показа результата скрываем виджет
    setTimeout(() => {
      setIsAnimating(false);
      setCurrentReward(null);
      setAllRewards([]);
      setAnimationPhase('idle');
      setRoulettePosition(0);
    }, widgetConfig.current.opening_duration + widgetConfig.current.spinning_duration + widgetConfig.current.result_duration);
  };

  const getQualityImage = (quality) => {
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
  const testAnimation = async () => {
    const testReward = {
      quality: 'epic',
      quality_name: 'epic',
      viewer_name: 'TestViewer',
      reward_name: '1000 очков',
      reward_id: 1,
      reward_type: 'points',
      streak_days: 5,
      donation_amount: null,
      sound_file: null,
      sound_volume: 1.0
    };
    await showReward(testReward);
  };

  // Показываем status если не подключены
  if (!isAnimating || !currentReward) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-900 to-black rounded-lg">
        <div className="text-center text-white/40">
          <div className="mb-4">
            <img 
              src={QUALITY_IMAGES.common} 
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

  const quality = currentReward.quality?.toLowerCase() || currentReward.quality || 'common';
  const chestImage = getQualityImage(quality);
  const visibleCards = 5; // Показываем 5 карточек одновременно
  const cardWidth = 200; // Ширина карточки в px

  return (
    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-900 to-black relative overflow-hidden">
      {/* Открытый сундук (фон) */}
      <div className="absolute inset-0 flex items-center justify-center z-10">
        <img 
          src={chestImage}
          alt={`${quality} chest`}
          className="w-96 h-96 object-contain opacity-80"
        />
      </div>

      {/* Рулетка поверх сундука */}
      {(animationPhase === 'roulette' || animationPhase === 'result') && (
        <div className="absolute inset-0 flex items-center justify-center z-20 bg-black/60">
          <div className="relative w-full h-64 overflow-hidden">
            {/* Центральная область видимости (выделение центральной карточки) */}
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-52 h-64 border-4 border-yellow-400 rounded-lg shadow-lg shadow-yellow-400/50 z-30 pointer-events-none">
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 text-yellow-400 font-bold text-lg">
                🎁
              </div>
            </div>

            {/* Контейнер карточек */}
            <div 
              className="flex items-center h-full transition-transform duration-75 ease-out"
              style={{
                transform: `translateX(calc(50% - ${roulettePosition * cardWidth + cardWidth / 2}px))`
              }}
            >
              {allRewards.map((reward, index) => {
                const isWinner = animationPhase === 'result' && 
                  index === Math.floor(roulettePosition) &&
                  (reward.id === currentReward.reward_id || 
                   reward.name === currentReward.reward_name ||
                   index === Math.floor(roulettePosition));

                return (
                  <div
                    key={`${reward.id}-${index}`}
                    className={`flex-shrink-0 w-52 h-64 mx-2 rounded-lg border-2 overflow-hidden transition-all ${
                      isWinner 
                        ? 'border-yellow-400 shadow-lg shadow-yellow-400/50 scale-110 z-40' 
                        : 'border-gray-600 opacity-60'
                    }`}
                    style={{ backgroundColor: 'rgba(30, 30, 30, 0.9)' }}
                  >
                    {reward.image_url ? (
                      <img 
                        src={reward.image_url} 
                        alt={reward.name}
                        className="w-full h-40 object-cover"
                        onError={(e) => {
                          e.target.style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className="w-full h-40 bg-gradient-to-br from-gray-700 to-gray-900 flex items-center justify-center">
                        <span className="text-white/40 text-2xl">🎁</span>
                      </div>
                    )}
                    <div className="p-3 text-center">
                      <h4 className="text-white font-semibold text-sm mb-1 line-clamp-2">
                        {reward.name}
                      </h4>
                      {reward.description && (
                        <p className="text-white/60 text-xs line-clamp-1">
                          {reward.description}
                        </p>
                      )}
                      {reward.quality && (
                        <div className={`mt-2 inline-block px-2 py-1 rounded text-xs font-bold bg-gradient-to-r ${getQualityColor(reward.quality.name)} text-white`}>
                          {reward.quality.name.toUpperCase()}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Результат (имя зрителя и финальная карточка) */}
      {animationPhase === 'result' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center z-30 bg-black/80">
          <div className="mb-6">
            <h2 className={`text-3xl font-bold mb-2 bg-gradient-to-r ${getQualityColor(quality)} bg-clip-text text-transparent text-center`}>
              {currentReward.viewer_name}
            </h2>
            <p className="text-white/80 text-lg text-center">
              Выиграл награду!
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default DropsWidget;
