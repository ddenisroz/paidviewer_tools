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
  size?: 'small' | 'medium' | 'large';
  predeterminedResult?: {
    reward_name: string;
    quality: string;
    image_url?: string;
  }; // Predetermined result from backend
}

const ImageLootbox: React.FC<ImageLootboxProps> = ({ 
  images,
  title, 
  rarity, 
  isOpening = false,
  onOpen,
  className = "",
  size = "medium",
  predeterminedResult
}) => {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [finalResult, setFinalResult] = useState<typeof predeterminedResult | null>(null);

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

  // Animation towards predetermined result from backend
  // This ensures the animation cannot be manipulated from client-side
  useEffect(() => {
    if (isOpening && images && images.length > 0) {
      setIsAnimating(true);
      
      // Fast image cycling to create opening effect
      // The animation will always end at the predetermined result
      let index = 0;
      const cycleSpeed = 150; // ms per image
      const totalCycles = 3; // Number of full cycles through images
      const totalFrames = images.length * totalCycles;
      
      const interval = setInterval(() => {
        // Cycle through images multiple times
        setCurrentImageIndex(index % images.length);
        index++;
        
        if (index >= totalFrames) {
          clearInterval(interval);
          setIsAnimating(false);
          
          // Show predetermined result from backend
          if (predeterminedResult) {
            setFinalResult(predeterminedResult);
          } else {
            // Fallback to last image if no predetermined result
            setCurrentImageIndex(images.length - 1);
          }
        }
      }, cycleSpeed);

      return () => clearInterval(interval);
    }
  }, [isOpening, images, predeterminedResult]);

  const handleOpen = () => {
    if (onOpen) {
      onOpen();
    }
  };

  // Display predetermined result if available, otherwise show current animation frame
  const currentImage = finalResult?.image_url || 
    (images && images.length > 0 ? images[currentImageIndex] : null);

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
              alt={finalResult?.reward_name || title}
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
          
          {/* Show final result overlay after animation */}
          {finalResult && !isAnimating && (
            <div className="absolute inset-0 bg-black bg-opacity-70 flex items-center justify-center">
              <div className="text-center p-4">
                <div className="text-2xl font-bold text-white mb-2">
                  {finalResult.reward_name}
                </div>
                <Badge 
                  className={`${rarityColors[finalResult.quality.toLowerCase() as keyof typeof rarityColors] || 'bg-gray-500'} text-white`}
                >
                  {finalResult.quality}
                </Badge>
              </div>
            </div>
          )}
        </div>

        {/* Информация о лутбоксе */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black to-transparent p-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-white font-semibold text-sm truncate">
                {finalResult?.reward_name || title}
              </h3>
              <div className="flex items-center gap-2 mt-1">
                <Badge 
                  className={`${rarityColors[finalResult?.quality.toLowerCase() as keyof typeof rarityColors || rarity] || 'bg-gray-500'} text-white text-xs flex items-center gap-1`}
                >
                  {rarityIcons[finalResult?.quality.toLowerCase() as keyof typeof rarityIcons || rarity] || <Star className="w-3 h-3" />}
                  {finalResult?.quality || rarity}
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
          {isAnimating ? 'Открывается...' : finalResult ? 'Открыто!' : 'Открыть лутбокс'}
        </Button>
      </div>
    </Card>
  );
};

export default ImageLootbox;

