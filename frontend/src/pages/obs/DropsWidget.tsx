import React, { useEffect, useRef, useState } from 'react';

import { useParams } from 'react-router-dom';

import { dropsService } from '@/services/api/services/dropsService';
import { logger } from '@/shared/utils/prodLogger';

import CommonOpened from '../../images/lootboxes/common/common_opened.png';
import EpicOpened from '../../images/lootboxes/epic/epic_opened.png';
import LegendaryOpened from '../../images/lootboxes/legendary/legendary_opened.png';
import MythycOpened from '../../images/lootboxes/mythyc/mythyc_opened.png';
import RareOpened from '../../images/lootboxes/rare/rare_opened_.png';

const QUALITY_IMAGES: Record<string, string> = {
  'common': CommonOpened,
  'rare': RareOpened,
  'epic': EpicOpened,
  'legendary': LegendaryOpened,
  'mythical': MythycOpened,
  'mythyc': MythycOpened
};

interface Reward {
  id: number;
  name: string;
  description?: string;
  image_url?: string;
  quality?: {
    name: string;
  };
  is_active?: boolean;
}

interface RewardData {
  quality?: string;
  quality_name?: string;
  viewer_name?: string;
  reward_name?: string;
  reward_id?: number;
  reward_type?: string;
  reward_value?: number;
  description?: string;
  sound_file?: string | null;
  sound_volume?: number;
}

interface MythicalSession {
  donation_amount: number;
  time_remaining_seconds: number;
}

interface WebSocketMessage {
  type: string;
  event?: string;
  data?: RewardData;
}

type AnimationPhase = 'idle' | 'opening' | 'roulette' | 'result';

interface WidgetConfig {
  spinning_duration: number;
  opening_duration: number;
  result_duration: number;
}

interface UserTokenResponse {
  user_id?: number;
  channel_name?: string;
  platform?: string;
}

interface WidgetConfigData {
  widget_spinning_duration_ms?: number;
  widget_opening_duration_ms?: number;
  widget_result_duration_ms?: number;
}

interface DropsApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

const DropsWidget: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const [currentReward, setCurrentReward] = useState<RewardData | null>(null);
  const [allRewards, setAllRewards] = useState<Reward[]>([]);
  const [isAnimating, setIsAnimating] = useState<boolean>(false);
  const [animationPhase, setAnimationPhase] = useState<AnimationPhase>('idle');
  const ws = useRef<WebSocket | null>(null);
  const [status, setStatus] = useState<string>('Подключение...');
  const [isPreviewMode, setIsPreviewMode] = useState<boolean>(false);
  const [roulettePosition, setRoulettePosition] = useState<number>(0);
  const channelNameRef = useRef<string | null>(null);
  const platformRef = useRef<string | null>(null);
  const [mythicalSession, setMythicalSession] = useState<MythicalSession | null>(null);
  const [mythicalTimer, setMythicalTimer] = useState<number | null>(null);
  const mythicalTimerInterval = useRef<NodeJS.Timeout | null>(null);
  const widgetConfig = useRef<WidgetConfig>({
    spinning_duration: 1500,
    opening_duration: 1000,
    result_duration: 5500
  });

  const startMythicalTimer = React.useCallback((initialSeconds: number): void => {
    if (mythicalTimerInterval.current) {
      clearInterval(mythicalTimerInterval.current);
    }
    
    let remaining = initialSeconds;
    setMythicalTimer(remaining);
    
    mythicalTimerInterval.current = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        setMythicalTimer(0);
        setMythicalSession(null);
        if (mythicalTimerInterval.current) {
          clearInterval(mythicalTimerInterval.current);
        }
      } else {
        setMythicalTimer(remaining);
      }
    }, 1000);
  }, []);

  const loadMythicalSession = React.useCallback(async (channel?: string | null): Promise<void> => {
    const targetChannel = channel ?? channelNameRef.current;
    if (!targetChannel || !token) return;

    try {
      const response = await dropsService.getMythicalSession(targetChannel, token);
      const data = response.data as DropsApiResponse<MythicalSession>;
      if (data.success && data.data) {
        setMythicalSession(data.data);
        startMythicalTimer(data.data.time_remaining_seconds);
      } else {
        setMythicalSession(null);
        setMythicalTimer(null);
        if (mythicalTimerInterval.current) {
          clearInterval(mythicalTimerInterval.current);
        }
      }
    } catch (error) {
      logger.error('Error loading mythical session:', error);
    }
  }, [token, startMythicalTimer]);

  const formatTimer = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const loadRewardsForQuality = React.useCallback(async (quality: string, channelName: string, platform: string): Promise<Reward[]> => {
    try {
      const response = await dropsService.getRewardsForWidget(channelName, {
        platform,
        quality,
        widget_token: token
      });
      const data = response.data as unknown as { success?: boolean; data?: Reward[] } | Reward[];
      const rewards = Array.isArray(data) ? data : (data.success && data.data ? data.data : []);
      return rewards.filter((r: Reward) => r.is_active);
    } catch (error) {
      logger.error('Error loading rewards:', error);
    }
    return [];
  }, [token]);

  const showReward = React.useCallback(async (rewardData: RewardData): Promise<void> => {
    const quality = rewardData.quality?.toLowerCase() || rewardData.quality || 'common';
    const rewards = await loadRewardsForQuality(
      quality,
      channelNameRef.current || '',
      platformRef.current || ''
    );
    
    const duplicatedRewards = [...rewards, ...rewards, ...rewards];
    setAllRewards(duplicatedRewards);
    
    setCurrentReward(rewardData);
    setIsAnimating(true);
    setAnimationPhase('opening');

    if (rewardData.sound_file) {
      const audio = new Audio(rewardData.sound_file);
      audio.volume = rewardData.sound_volume || 1.0;
      audio.play().catch((err) => logger.error('Error playing reward sound:', err));
    }

    setTimeout(() => {
      setAnimationPhase('roulette');
      const startPosition = 0;
      
      let targetIndex = duplicatedRewards.findIndex(r => 
        r.id === rewardData.reward_id || r.name === rewardData.reward_name
      );
      
      if (targetIndex === -1) {
        logger.warn('Reward not found in active rewards list, using fallback');
        targetIndex = rewards.findIndex(r => r.name === rewardData.reward_name);
        if (targetIndex === -1) {
          logger.error('Could not find reward even in fallback, showing first reward');
          targetIndex = 0;
        }
      }
      
      const targetPosition = targetIndex;
      let currentPos = startPosition;
      const _totalCards = duplicatedRewards.length;
      const finalPosition = targetPosition + rewards.length;
      const duration = widgetConfig.current.spinning_duration;
      const startTime = Date.now();
      
      const animate = (): void => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
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

    setTimeout(() => {
      setIsAnimating(false);
      setCurrentReward(null);
      setAllRewards([]);
      setAnimationPhase('idle');
      setRoulettePosition(0);
    }, widgetConfig.current.opening_duration + widgetConfig.current.spinning_duration + widgetConfig.current.result_duration);
  }, [loadRewardsForQuality]);

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const preview = urlParams.get('preview');
    if (preview === 'true') {
      setIsPreviewMode(true);
      setStatus('Режим предпросмотра - нажмите кнопку для тестирования анимации');
      if (token) {
        dropsService.getUserFromToken(token)
          .then(res => {
            const data = res.data as DropsApiResponse<UserTokenResponse>;
            if (data.data?.channel_name && data.data?.platform) {
              channelNameRef.current = data.data.channel_name;
              platformRef.current = data.data.platform;
              return dropsService.getConfigWithToken(data.data.channel_name, {
                platform: data.data.platform,
                widget_token: token
              });
            }
            return undefined;
          })
          .then(res => {
            if (!res) return;
            const configData = res.data as DropsApiResponse<WidgetConfigData>;
            if (configData?.success && configData.data) {
              widgetConfig.current = {
                spinning_duration: configData.data.widget_spinning_duration_ms || 1500,
                opening_duration: configData.data.widget_opening_duration_ms || 1000,
                result_duration: configData.data.widget_result_duration_ms || 5505
              };
            }
          })
          .catch(err => logger.error('Error loading preview config:', err));
      }
      return;
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

    const fetchUserId = async (): Promise<void> => {
      try {
        const response = await dropsService.getUserFromToken(token);
        const apiData = response.data as DropsApiResponse<UserTokenResponse>;
        const data = apiData.data || apiData as unknown as UserTokenResponse;
        const userId = (data as UserTokenResponse & { user_id?: number }).user_id;
        channelNameRef.current = data.channel_name || null;
        platformRef.current = data.platform || null;

        if (userId && data.channel_name && data.platform) {
          try {
            const configResponse = await dropsService.getConfigWithToken(data.channel_name, {
              platform: data.platform,
              widget_token: token
            });
            const configData = configResponse.data as DropsApiResponse<WidgetConfigData>;
            if (configData.success && configData.data) {
              widgetConfig.current = {
                spinning_duration: configData.data.widget_spinning_duration_ms || 1500,
                opening_duration: configData.data.widget_opening_duration_ms || 1000,
                result_duration: configData.data.widget_result_duration_ms || 5500
              };
            }
          } catch (configError) {
            logger.error('Error loading widget config:', configError);
          }
        }

        void loadMythicalSession(data.channel_name || null);

        const wsUrl = `${wsBaseUrl}/ws/chat/${userId}`;
        const websocket = new WebSocket(wsUrl);

        websocket.onopen = (): void => {
          logger.log('Connected to drops WebSocket');
          ws.current = websocket;
          setStatus('Ожидание наград...');
        };

        websocket.onmessage = (event: MessageEvent): void => {
          try {
            const data = JSON.parse(event.data) as WebSocketMessage;
            if (data.type === 'drops' && data.event === 'reward_received' && data.data) {
              void showReward(data.data);
            } else if (data.type === 'drops' && data.event === 'mythical_session_started') {
              void loadMythicalSession();
            } else if (data.type === 'drops' && data.event === 'mythical_session_ended') {
              setMythicalSession(null);
              setMythicalTimer(null);
            }
          } catch (error) {
            logger.error('Error parsing WebSocket message:', error);
          }
        };

        websocket.onclose = (): void => {
          logger.log('Drops WebSocket disconnected');
          ws.current = null;
          setStatus('Переподключение...');
          setTimeout(() => {
            const reconnectWs = new WebSocket(wsUrl);
            reconnectWs.onopen = websocket.onopen;
            reconnectWs.onmessage = websocket.onmessage;
            reconnectWs.onclose = websocket.onclose;
            reconnectWs.onerror = websocket.onerror;
            ws.current = reconnectWs;
          }, 3000);
        };

        websocket.onerror = (): void => {
          logger.error('Drops WebSocket error');
        };

        ws.current = websocket;
      } catch (error) {
        logger.error('Error fetching user ID:', error);
        setStatus('Ошибка: Не удалось подключиться');
      }
    };

    void fetchUserId();

    const mythicalCheckInterval = setInterval(() => {
      const currentChannel = channelNameRef.current;
      if (currentChannel) {
        void loadMythicalSession(currentChannel);
      }
    }, 10000);

    return () => {
      if (ws.current) {
        ws.current.close();
      }
      if (mythicalTimerInterval.current) {
        clearInterval(mythicalTimerInterval.current);
      }
      clearInterval(mythicalCheckInterval);
    };
  }, [token, loadMythicalSession, showReward]);

  const getQualityImage = (quality: string): string => {
    const qualityLower = quality?.toLowerCase();
    return QUALITY_IMAGES[qualityLower] || QUALITY_IMAGES['common'];
  };

  const getQualityColor = (quality: string): string => {
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

  const testAnimation = async (quality: string = 'epic'): Promise<void> => {
    const testRewards: Record<string, RewardData> = {
      common: {
        quality: 'common',
        quality_name: 'common',
        viewer_name: 'TestViewer',
        reward_name: '100 очков',
        reward_id: 1,
        reward_type: 'points',
        reward_value: 100,
        description: 'Тестовая награда (Обычная)',
        sound_file: null,
        sound_volume: 1.0
      },
      rare: {
        quality: 'rare',
        quality_name: 'rare',
        viewer_name: 'TestViewer',
        reward_name: '500 очков',
        reward_id: 2,
        reward_type: 'points',
        reward_value: 500,
        description: 'Тестовая награда (Редкая)',
        sound_file: null,
        sound_volume: 1.0
      },
      epic: {
        quality: 'epic',
        quality_name: 'epic',
        viewer_name: 'TestViewer',
        reward_name: '1000 очков',
        reward_id: 3,
        reward_type: 'points',
        reward_value: 1000,
        description: 'Тестовая награда (Эпическая)',
        sound_file: null,
        sound_volume: 1.0
      },
      legendary: {
        quality: 'legendary',
        quality_name: 'legendary',
        viewer_name: 'TestViewer',
        reward_name: '5000 очков',
        reward_id: 4,
        reward_type: 'points',
        reward_value: 5000,
        description: 'Тестовая награда (Легендарная)',
        sound_file: null,
        sound_volume: 1.0
      },
      mythical: {
        quality: 'mythical',
        quality_name: 'mythical',
        viewer_name: 'TestViewer',
        reward_name: '10000 очков',
        reward_id: 5,
        reward_type: 'points',
        reward_value: 10000,
        description: 'Тестовая награда (Мифическая)',
        sound_file: null,
        sound_volume: 1.0
      }
    };
    
    const testReward = testRewards[quality] || testRewards.epic;
    await showReward(testReward);
  };

  if (mythicalSession && mythicalTimer !== null && mythicalTimer > 0) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-pink-900/50 via-purple-900/50 to-pink-900/50 rounded-lg border-2 border-pink-500/30">
        <div className="text-center text-white">
          <div className="mb-4">
            <img 
              src={QUALITY_IMAGES.mythical} 
              alt="Мифический сундук"
              className="w-32 h-32 mx-auto animate-pulse"
            />
          </div>
          <h2 className="text-2xl font-bold mb-2 bg-gradient-to-r from-pink-400 to-purple-400 bg-clip-text text-transparent">
            Мифический Drops активен!
          </h2>
          <p className="text-lg font-semibold mb-4 text-pink-300">
            Минимальный донат: {mythicalSession.donation_amount}₽
          </p>
          <div className="text-4xl font-bold text-yellow-400 mb-2 font-mono">
            {formatTimer(mythicalTimer)}
          </div>
          <p className="text-sm text-white/60">
            Осталось времени
          </p>
        </div>
      </div>
    );
  }

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
            <div className="space-y-3">
              <p className="text-xs text-gray-400 mb-2">Тестовые события:</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <button
                  onClick={() => testAnimation('common')}
                  className="px-3 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded-lg transition-colors text-xs font-medium"
                >
                  Обычный
                </button>
                <button
                  onClick={() => testAnimation('rare')}
                  className="px-3 py-2 bg-blue-700 hover:bg-blue-800 text-white rounded-lg transition-colors text-xs font-medium"
                >
                  Редкий
                </button>
                <button
                  onClick={() => testAnimation('epic')}
                  className="px-3 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg transition-colors text-xs font-medium text-xs"
                >
                  Эпический
                </button>
                <button
                  onClick={() => testAnimation('legendary')}
                  className="px-3 py-2 bg-yellow-600 hover:bg-yellow-500 text-white rounded-lg transition-colors text-xs font-medium"
                >
                  Легендарный
                </button>
                <button
                  onClick={() => testAnimation('mythical')}
                  className="px-3 py-2 bg-pink-600 hover:bg-pink-500 text-white rounded-lg transition-colors text-xs font-medium col-span-2 sm:col-span-1"
                >
                  Мифический
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  const quality = currentReward.quality?.toLowerCase() || currentReward.quality || 'common';
  const chestImage = getQualityImage(quality);
  const _visibleCards = 5;
  const cardWidth = 200;

  return (
    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-900 to-black relative overflow-hidden">
      <div className="absolute inset-0 flex items-center justify-center z-10">
        <img 
          src={chestImage}
          alt={`${quality} chest`}
          className="w-96 h-96 object-contain opacity-80"
        />
      </div>

      {(animationPhase === 'roulette' || animationPhase === 'result') && (
        <div className="absolute inset-0 flex items-center justify-center z-20 bg-black/60">
          <div className="relative w-full h-64 overflow-hidden">
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-52 h-64 border-4 border-yellow-400 rounded-lg shadow-lg shadow-yellow-400/50 z-30 pointer-events-none">
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 text-yellow-400 font-bold text-lg">
                [REWARD]
              </div>
            </div>

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
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <div className="w-full h-40 bg-gradient-to-br from-gray-700 to-gray-900 flex items-center justify-center">
                        <span className="text-white/40 text-2xl">[REWARD]</span>
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

