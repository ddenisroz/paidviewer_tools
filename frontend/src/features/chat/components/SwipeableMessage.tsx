import React, { ReactNode, useRef, useState } from 'react';

import { VolumeX } from 'lucide-react';

import type { ChatMessage } from '@/types/chat';

interface SwipeableMessageProps {
    children: ReactNode;
    onSwipeAction: (action: string, message: ChatMessage) => void;
    message: ChatMessage;
}

const SwipeableMessage = React.memo<SwipeableMessageProps>(({ children, onSwipeAction, message }) => {
    const [touchStart, setTouchStart] = useState<number | null>(null);
    const [touchEnd, setTouchEnd] = useState<number | null>(null);
    const [swipeDistance, setSwipeDistance] = useState(0);
    const [isSwiping, setIsSwiping] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    // Пороговое значение для заглушения TTS
    const muteThreshold = 80; // Заглушить TTS
    const banThreshold = 150; // Для ban (если будет добавлено)
    const timeoutThreshold = 200; // Максимальный свайп

    const handleTouchStart = (e: React.TouchEvent) => {
        setTouchEnd(null);
        setTouchStart(e.targetTouches[0].clientX);
        setIsSwiping(true);
    };

    const handleTouchMove = (e: React.TouchEvent) => {
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
        if (distance > muteThreshold) {
            // Заглушить TTS
            onSwipeAction('block_tts', message);
        }

        // Сбрасываем состояние
        setSwipeDistance(0);
        setIsSwiping(false);
        setTouchStart(null);
        setTouchEnd(null);
    };

    // Получаем иконку и цвет в зависимости от дистанции свайпа
    const getSwipeIndicator = () => {
        if (swipeDistance < muteThreshold) {
            return null;
        } else {
            return {
                icon: <VolumeX className="w-5 h-5" />,
                color: 'bg-red-500',
                text: 'Заглушить TTS',
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
                        opacity: Math.min(swipeDistance / timeoutThreshold, 1),
                    }}
                >
                    <div className="flex items-center gap-2 text-white">
                        {indicator.icon}
                        <span className="text-sm font-medium whitespace-nowrap">{indicator.text}</span>
                    </div>
                </div>
            )}

            {/* Контент сообщения */}
            <div
                className="relative transition-transform w-full"
                style={{
                    transform: `translateX(-${swipeDistance}px)`,
                    transition: isSwiping ? 'none' : 'transform 0.3s ease-out',
                }}
            >
                {children}
            </div>
        </div>
    );
});

SwipeableMessage.displayName = 'SwipeableMessage';

export default SwipeableMessage;
