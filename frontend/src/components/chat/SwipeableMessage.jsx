import React, { useRef, useState, useEffect } from 'react';
import { Ban, Clock } from 'lucide-react';

const SwipeableMessage = ({ children, onSwipeAction, message }) => {
    const [touchStart, setTouchStart] = useState(null);
    const [touchEnd, setTouchEnd] = useState(null);
    const [swipeDistance, setSwipeDistance] = useState(0);
    const [isSwiping, setIsSwiping] = useState(false);
    const containerRef = useRef(null);
    
    // Минимальное расстояние для регистрации свайпа (в пикселях)
    const minSwipeDistance = 50;
    
    // Пороговые значения для разных действий
    const timeoutThreshold = 80; // Таймаут 10мин
    const banThreshold = 150;     // Бан
    
    const handleTouchStart = (e) => {
        setTouchEnd(null);
        setTouchStart(e.targetTouches[0].clientX);
        setIsSwiping(true);
    };
    
    const handleTouchMove = (e) => {
        if (!touchStart) return;
        
        const currentTouch = e.targetTouches[0].clientX;
        const distance = touchStart - currentTouch;
        
        // Ограничиваем свайп только вправо (отрицательные значения)
        if (distance < 0) {
            setSwipeDistance(0);
            return;
        }
        
        // Ограничиваем максимальное расстояние
        setSwipeDistance(Math.min(distance, banThreshold + 50));
        setTouchEnd(currentTouch);
    };
    
    const handleTouchEnd = () => {
        if (!touchStart || !touchEnd) {
            setSwipeDistance(0);
            setIsSwiping(false);
            return;
        }
        
        const distance = touchStart - touchEnd;
        
        // Определяем действие по дистанции свайпа
        if (distance > banThreshold) {
            // Бан
            onSwipeAction('ban', message);
        } else if (distance > timeoutThreshold) {
            // Таймаут 10 минут
            onSwipeAction('timeout_10m', message);
        }
        
        // Сбрасываем состояние
        setSwipeDistance(0);
        setIsSwiping(false);
        setTouchStart(null);
        setTouchEnd(null);
    };
    
    // Получаем иконку и цвет в зависимости от дистанции свайпа
    const getSwipeIndicator = () => {
        if (swipeDistance < timeoutThreshold) {
            return null;
        } else if (swipeDistance < banThreshold) {
            return {
                icon: <Clock className="w-5 h-5" />,
                color: 'bg-yellow-500',
                text: 'Таймаут 10м'
            };
        } else {
            return {
                icon: <Ban className="w-5 h-5" />,
                color: 'bg-red-500',
                text: 'Бан'
            };
        }
    };
    
    const indicator = getSwipeIndicator();
    
    return (
        <div 
            ref={containerRef}
            className="relative overflow-hidden touch-pan-y"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
        >
            {/* Индикатор действия (фон) */}
            {indicator && (
                <div 
                    className={`absolute right-0 top-0 bottom-0 flex items-center justify-center px-4 ${indicator.color} transition-all`}
                    style={{ 
                        width: `${Math.min(swipeDistance, banThreshold + 50)}px`,
                        opacity: Math.min(swipeDistance / timeoutThreshold, 1)
                    }}
                >
                    <div className="flex items-center gap-2 text-white">
                        {indicator.icon}
                        <span className="text-sm font-medium whitespace-nowrap">
                            {indicator.text}
                        </span>
                    </div>
                </div>
            )}
            
            {/* Контент сообщения */}
            <div 
                className="relative bg-background transition-transform"
                style={{ 
                    transform: `translateX(-${swipeDistance}px)`,
                    transition: isSwiping ? 'none' : 'transform 0.3s ease-out'
                }}
            >
                {children}
            </div>
        </div>
    );
};

export default SwipeableMessage;

