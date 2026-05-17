// src/features/chat/components/ChatContextMenu.tsx
import React, { useEffect, useRef, useState } from 'react';

import { Volume2, VolumeX } from 'lucide-react';
import ReactDOM from 'react-dom';

import { logger } from '@/shared/utils/prodLogger';

import type { ChatMessage } from '@/types/chat';

interface ChatContextMenuProps {
    x: number;
    y: number;
    message: ChatMessage;
    onClose: () => void;
    onAction: (action: string, message: ChatMessage) => void;
    isTtsBlocked?: boolean;
}

const ChatContextMenu: React.FC<ChatContextMenuProps> = ({
    x,
    y,
    message,
    onClose,
    onAction,
    isTtsBlocked = false,
}) => {
    const menuRef = useRef<HTMLDivElement>(null);
    const [position, setPosition] = useState({ x, y });

    // Корректируем позицию меню, чтобы оно не выходило за границы экрана
    useEffect(() => {
        if (menuRef.current) {
            const menuRect = menuRef.current.getBoundingClientRect();
            const windowWidth = window.innerWidth;
            const windowHeight = window.innerHeight;

            let adjustedX = x;
            let adjustedY = y;

            // Если меню выходит за правую границу экрана, сдвигаем влево
            if (x + menuRect.width > windowWidth) {
                adjustedX = windowWidth - menuRect.width - 10;
            }

            // Если меню выходит за нижнюю границу экрана, сдвигаем вверх
            if (y + menuRect.height > windowHeight) {
                adjustedY = windowHeight - menuRect.height - 10;
            }

            // Не даём меню выйти за левую границу
            if (adjustedX < 10) {
                adjustedX = 10;
            }

            // Не даём меню выйти за верхнюю границу
            if (adjustedY < 10) {
                adjustedY = 10;
            }

            logger.log(
                `[CONTEXT MENU] Position adjusted: original(${x}, ${y}) -> final(${adjustedX}, ${adjustedY}), size: ${menuRect.width}x${menuRect.height}`
            );
            setPosition({ x: adjustedX, y: adjustedY });
        }
    }, [x, y]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                onClose();
            }
        };

        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                onClose();
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('keydown', handleEscape);

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleEscape);
        };
    }, [onClose]);

    const handleAction = (action: string) => {
        onAction(action, message);
        onClose();
    };

    // Определяем, какие действия доступны для платформы
    // VK Live API ограничения - доступны только базовые функции
    // const vkAvailableActions = ['block_tts', 'unblock_tts'];
    // const twitchAvailableActions = ['block_tts', 'unblock_tts', 'timeout_10m', 'timeout_1h', 'ban', 'add_moderator', 'remove_moderator', 'add_vip', 'remove_vip'];

    return ReactDOM.createPortal(
        <div
            ref={menuRef}
            className="pv-static-anchor-in fixed min-w-44 rounded-md border border-border/70 bg-[#0b0712] py-1 shadow-2xl shadow-black/50 ring-1 ring-white/10 z-[99999]"
            style={{
                left: `${position.x}px`,
                top: `${position.y}px`,
                boxShadow: '0 10px 40px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.1)',
            }}
        >
            {/* Заглушить/Разглушить TTS */}
            <button
                onClick={() => handleAction(isTtsBlocked ? 'unblock_tts' : 'block_tts')}
                className={`w-full px-4 py-2 text-sm text-left hover:bg-accent flex items-center gap-2 transition-colors font-medium ${
                    isTtsBlocked ? 'text-green-500' : 'text-red-500'
                }`}
            >
                {isTtsBlocked ? (
                    <>
                        <Volume2 className="h-4 w-4" />
                        <span>Разглушить TTS</span>
                    </>
                ) : (
                    <>
                        <VolumeX className="h-4 w-4" />
                        <span>Заглушить TTS</span>
                    </>
                )}
            </button>
        </div>,
        document.body
    );
};

export default ChatContextMenu;
