import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Star, 
  Shield, 
  Gem, 
  Crown, 
  Gift, 
  Volume2,
  Zap,
  Users,
  DollarSign
} from 'lucide-react';

const DropsDisplay = ({ drops, onPlaySound }) => {
  const [displayedDrops, setDisplayedDrops] = useState([]);
  const [animations, setAnimations] = useState({});

  useEffect(() => {
    if (drops && drops.length > 0) {
      // Добавляем новые дропы с анимацией
      const newDrops = drops.filter(drop => 
        !displayedDrops.some(displayed => displayed.id === drop.id)
      );
      
      newDrops.forEach(drop => {
        setAnimations(prev => ({
          ...prev,
          [drop.id]: 'animate-in'
        }));
        
        // Воспроизводим звук если есть
        if (drop.sound_file && onPlaySound) {
          onPlaySound(drop.sound_file, drop.sound_volume);
        }
        
        // Убираем анимацию через 3 секунды
        setTimeout(() => {
          setAnimations(prev => ({
            ...prev,
            [drop.id]: 'animate-out'
          }));
        }, 3000);
      });
      
      setDisplayedDrops(prev => [...prev, ...newDrops]);
    }
  }, [drops]);

  const getQualityIcon = (qualityName) => {
    switch (qualityName) {
      case 'Common': return <Shield className="w-5 h-5 text-gray-500" />;
      case 'Rare': return <Star className="w-5 h-5 text-blue-500" />;
      case 'Epic': return <Gem className="w-5 h-5 text-purple-500" />;
      case 'Legendary': return <Crown className="w-5 h-5 text-yellow-500" />;
      default: return <Gift className="w-5 h-5 text-gray-500" />;
    }
  };

  const getQualityColor = (qualityName) => {
    switch (qualityName) {
      case 'Common': return 'border-gray-300 bg-gray-50';
      case 'Rare': return 'border-blue-300 bg-blue-50';
      case 'Epic': return 'border-purple-300 bg-purple-50';
      case 'Legendary': return 'border-yellow-300 bg-yellow-50';
      default: return 'border-gray-300 bg-gray-50';
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

  const getTypeText = (type) => {
    switch (type) {
      case 'streak': return 'Стрик';
      case 'donation': return 'Донат';
      case 'mythical': return 'Мифический';
      default: return 'Drops';
    }
  };

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2 max-w-sm">
      {displayedDrops.map((drop) => (
        <Card 
          key={drop.id}
          className={`transition-all duration-500 transform ${
            animations[drop.id] === 'animate-in' 
              ? 'translate-x-0 opacity-100 scale-100' 
              : animations[drop.id] === 'animate-out'
              ? 'translate-x-full opacity-0 scale-95'
              : 'translate-x-full opacity-0 scale-95'
          } ${getQualityColor(drop.quality?.name)}`}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0">
                {getQualityIcon(drop.quality?.name)}
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold text-sm truncate">
                    {drop.viewer_name}
                  </span>
                  {getTypeIcon(drop.lootbox_type)}
                </div>
                
                <p className="text-sm text-gray-600 truncate">
                  {drop.reward_name}
                </p>
                
                <div className="flex items-center gap-2 mt-2">
                  <Badge 
                    variant="secondary" 
                    className={`text-xs ${
                      drop.quality?.name === 'Legendary' ? 'bg-yellow-100 text-yellow-800' :
                      drop.quality?.name === 'Epic' ? 'bg-purple-100 text-purple-800' :
                      drop.quality?.name === 'Rare' ? 'bg-blue-100 text-blue-800' :
                      'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {drop.quality?.name}
                  </Badge>
                  
                  <Badge variant="outline" className="text-xs">
                    {getTypeText(drop.lootbox_type)}
                  </Badge>
                </div>
              </div>
              
              {drop.sound_file && (
                <div className="flex-shrink-0">
                  <Volume2 className="w-4 h-4 text-blue-500" />
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

// Компонент для отображения мифического Drops
export const MythicalDropsAlert = ({ isActive, timeLeft, donationAmount, onClose }) => {
  const [countdown, setCountdown] = useState(timeLeft);

  useEffect(() => {
    if (!isActive) return;

    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          onClose();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isActive, onClose]);

  if (!isActive) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <Card className="max-w-md mx-4 bg-gradient-to-r from-orange-50 to-red-50 border-orange-300">
        <CardContent className="p-8 text-center">
          <div className="mb-6">
            <Zap className="w-16 h-16 text-orange-500 mx-auto mb-4 animate-pulse" />
            <h2 className="text-2xl font-bold text-orange-900 mb-2">
              ⚡ МИФИЧЕСКИЙ DROPS! ⚡
            </h2>
            <p className="text-orange-700">
              Специальное событие! Задонатьте <strong>{donationAmount}₽</strong> чтобы получить эксклюзивную награду!
            </p>
          </div>
          
          <div className="mb-6">
            <div className="text-4xl font-bold text-orange-600 mb-2">
              {Math.floor(countdown / 60)}:{(countdown % 60).toString().padStart(2, '0')}
            </div>
            <p className="text-sm text-orange-600">Осталось времени</p>
          </div>
          
          <div className="flex gap-3">
            <Button 
              onClick={onClose}
              variant="outline"
              className="flex-1"
            >
              Закрыть
            </Button>
            <Button 
              className="flex-1 bg-orange-600 hover:bg-orange-700"
              onClick={() => window.open('https://donationalerts.com', '_blank')}
            >
              Задонатить
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

// Компонент статистики Drops
export const DropsStats = ({ stats }) => {
  return (
    <Card className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20">
      <CardContent className="p-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">
              {stats?.totalDrops || 0}
            </div>
            <div className="text-sm text-gray-600">Всего Drops</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">
              {stats?.todayDrops || 0}
            </div>
            <div className="text-sm text-gray-600">Сегодня</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-purple-600">
              {stats?.legendaryDrops || 0}
            </div>
            <div className="text-sm text-gray-600">Legendary</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-orange-600">
              {stats?.mythicalDrops || 0}
            </div>
            <div className="text-sm text-gray-600">Мифические</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default DropsDisplay;
