import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Gift, 
  Star, 
  Crown, 
  Gem, 
  Zap,
  Trophy,
  Sparkles
} from 'lucide-react';

const DropsWidget = () => {
  const [currentReward, setCurrentReward] = useState(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [ws, setWs] = useState(null);

  useEffect(() => {
    // Получаем токен из URL
    const token = window.location.pathname.split('/').pop();
    if (!token) {
      console.error('No token provided');
      return;
    }

    // Подключаемся к WebSocket
    const wsUrl = `${import.meta.env.VITE_WS_URL || 'ws://localhost:8000'}/ws/drops-widget/${token}`;
    const websocket = new WebSocket(wsUrl);

    websocket.onopen = () => {
      console.log('Connected to drops WebSocket');
      setWs(websocket);
    };

    websocket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'drops' && data.event === 'reward_received') {
          showReward(data.data);
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    websocket.onclose = () => {
      console.log('Drops WebSocket disconnected');
      setWs(null);
    };

    websocket.onerror = (error) => {
      console.error('Drops WebSocket error:', error);
    };

    return () => {
      websocket.close();
    };
  }, []);

  const showReward = (rewardData) => {
    setCurrentReward(rewardData);
    setIsAnimating(true);

    // Проигрываем звук если есть
    if (rewardData.sound_file) {
      const audio = new Audio(rewardData.sound_file);
      audio.volume = rewardData.sound_volume || 1.0;
      audio.play().catch(console.error);
    }

    // Скрываем через 10 секунд
    setTimeout(() => {
      setIsAnimating(false);
      setCurrentReward(null);
    }, 10000);
  };

  const getQualityIcon = (quality) => {
    switch (quality?.toLowerCase()) {
      case 'common':
        return <Gift className="w-6 h-6 text-gray-400" />;
      case 'rare':
        return <Star className="w-6 h-6 text-blue-400" />;
      case 'epic':
        return <Crown className="w-6 h-6 text-purple-400" />;
      case 'legendary':
        return <Gem className="w-6 h-6 text-yellow-400" />;
      case 'mythical':
        return <Sparkles className="w-6 h-6 text-pink-400" />;
      default:
        return <Trophy className="w-6 h-6 text-gray-400" />;
    }
  };

  const getQualityColor = (quality) => {
    switch (quality?.toLowerCase()) {
      case 'common':
        return 'bg-gray-500';
      case 'rare':
        return 'bg-blue-500';
      case 'epic':
        return 'bg-purple-500';
      case 'legendary':
        return 'bg-yellow-500';
      case 'mythical':
        return 'bg-pink-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getRewardTypeIcon = (type) => {
    switch (type) {
      case 'points':
        return <Zap className="w-4 h-4" />;
      case 'voice':
        return <Gift className="w-4 h-4" />;
      case 'command':
        return <Trophy className="w-4 h-4" />;
      default:
        return <Gift className="w-4 h-4" />;
    }
  };

  if (!currentReward || !isAnimating) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-black/20 rounded-lg">
        <div className="text-center text-white/60">
          <Gift className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p className="text-sm">Ожидание наград...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`w-full h-full transition-all duration-1000 ${
      isAnimating ? 'animate-pulse' : ''
    }`}>
      <Card className={`w-full h-full border-2 ${
        getQualityColor(currentReward.quality)
      } shadow-2xl transform transition-all duration-500 ${
        isAnimating ? 'scale-105' : 'scale-100'
      }`}>
        <CardContent className="p-6 h-full flex flex-col items-center justify-center text-center">
          {/* Анимация появления */}
          <div className={`mb-4 transition-all duration-500 ${
            isAnimating ? 'animate-bounce' : ''
          }`}>
            {getQualityIcon(currentReward.quality)}
          </div>

          {/* Имя зрителя */}
          <h2 className="text-2xl font-bold text-white mb-2 drop-shadow-lg">
            {currentReward.viewer_name}
          </h2>

          {/* Награда */}
          <div className="mb-4">
            <h3 className="text-xl font-semibold text-white mb-1 drop-shadow-lg">
              {currentReward.reward}
            </h3>
            <div className="flex items-center justify-center gap-2">
              {getRewardTypeIcon(currentReward.reward_type)}
              <span className="text-sm text-white/80">
                {currentReward.reward_type}
              </span>
            </div>
          </div>

          {/* Качество */}
          <Badge 
            variant="secondary" 
            className={`${getQualityColor(currentReward.quality)} text-white font-bold px-3 py-1`}
          >
            {currentReward.quality}
          </Badge>

          {/* Дополнительная информация */}
          {currentReward.streak_days && (
            <div className="mt-3 text-sm text-white/80">
              Стрик: {currentReward.streak_days} дней
            </div>
          )}

          {currentReward.donation_amount && (
            <div className="mt-3 text-sm text-white/80">
              Донат: {currentReward.donation_amount}₽
            </div>
          )}

          {/* Анимация частиц */}
          {isAnimating && (
            <div className="absolute inset-0 pointer-events-none">
              {[...Array(20)].map((_, i) => (
                <div
                  key={i}
                  className="absolute w-2 h-2 bg-white/60 rounded-full animate-ping"
                  style={{
                    left: `${Math.random() * 100}%`,
                    top: `${Math.random() * 100}%`,
                    animationDelay: `${Math.random() * 2}s`,
                    animationDuration: `${2 + Math.random() * 2}s`
                  }}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default DropsWidget;
