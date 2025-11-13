import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Gift, Star, Zap, Crown, Gem, LucideIcon } from 'lucide-react';

interface ImageLootboxProps {
  images?: string[]; // Массив путей к картинкам для анимации
  title: string; 
  rarity: 'common' | 'rare' | 'epic' | 'legendary'; 
  isOpening?: boolean;
  onOpen?: () => void;
  className?: string;
  size?: 'small' | 'medium' | 'large'; // small, medium, large
}

const ImageLootbox: React.FC<ImageLootboxProps> = ({ 
  images, // Массив путей к картинкам для анимации
  title, 
  rarity, 
  isOpening = false,
  onOpen,
  className = "",
  size = "medium" // small, medium, large
}) => {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);

  const sizeClasses: Record<string, string> = {
    small: "w-32 h-32",
    medium: "w-48 h-48", 
    large: "w-64 h-64"
  };

  const rarityColors: Record<string, string> = {
    common: "bg-gray-500",
    rare: "bg-blue-500", 
    epic: "bg-purple-500",
    legendary: "bg-yellow-500"
  };

  const rarityIcons: Record<string, React.ReactNode> = {
    common: <Star className="w-4 h-4" />,
    rare: <Zap className="w-4 h-4" />,
    epic: <Gem className="w-4 h-4" />,
    legendary: <Crown className="w-4 h-4" />
  };

  // Анимация открытия лутбокса
  useEffect(() => {
    if (isOpening && images && images.length > 0) {
      setIsAnimating(true);
      
      // Быстрая смена картинок для эффекта открытия
      let index = 0;
      const interval = setInterval(() => {
        setCurrentImageIndex(index);
        index++;
        
        if (index >= images.length) {
          clearInterval(interval);
          setIsAnimating(false);
          // Оставляем последнюю картинку
          setCurrentImageIndex(images.length - 1);
        }
      }, 150); // Смена каждые 150мс

      return () => clearInterval(interval);
    }
  }, [isOpening, images]);

  const handleOpen = () => {
    if (onOpen) {
      onOpen();
    }
  };

  const currentImage = images && images.length > 0 ? images[currentImageIndex] : null;

  return (
    <Card 
      className={`relative overflow-hidden bg-transparent border-2 border-transparent hover:border-purple-400 transition-all duration-300 ${className}`}
    >
      <CardContent className="p-0 relative">
        {/* Контейнер для картинки */}
        <div className={`relative ${sizeClasses[size]} flex items-center justify-center`}>
          {currentImage ? (
            <img
              src={currentImage}
              alt={title}
              className={`w-full h-full object-contain transition-all duration-200 ${
                isAnimating ? 'animate-pulse scale-110' : 'scale-100'
              }`}
            />
          ) : (
            <div className="w-full h-full bg-gray-700 rounded-lg flex items-center justify-center">
              <Gift className="w-16 h-16 text-gray-500" />
            </div>
          )}
          
          {/* Эффект свечения при анимации */}
          {isAnimating && (
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-30 animate-shimmer"></div>
          )}
        </div>

        {/* Информация о лутбоксе */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black to-transparent p-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-white font-semibold text-sm truncate">{title}</h3>
              <div className="flex items-center gap-2 mt-1">
                <Badge 
                  className={`${rarityColors[rarity] || 'bg-gray-500'} text-white text-xs flex items-center gap-1`}
                >
                  {rarityIcons[rarity] || <Star className="w-3 h-3" />}
                  {rarity}
                </Badge>
              </div>
            </div>
            {isAnimating && (
              <div className="text-yellow-400 text-xs animate-pulse">
                Открывается...
              </div>
            )}
          </div>
        </div>
      </CardContent>
      
      {/* Кнопка открытия */}
      <div className="mt-3 text-center">
        <Button
          onClick={handleOpen}
          disabled={isAnimating}
          className={`w-full ${
            rarity === 'legendary' ? 'bg-yellow-600 hover:bg-yellow-700' :
            rarity === 'epic' ? 'bg-purple-600 hover:bg-purple-700' :
            rarity === 'rare' ? 'bg-blue-600 hover:bg-blue-700' :
            'bg-gray-600 hover:bg-gray-700'
          }`}
          size="sm"
        >
          <Gift className="w-4 h-4 mr-2" />
          {isAnimating ? 'Открывается...' : 'Открыть лутбокс'}
        </Button>
      </div>
    </Card>
  );
};

export default ImageLootbox;

