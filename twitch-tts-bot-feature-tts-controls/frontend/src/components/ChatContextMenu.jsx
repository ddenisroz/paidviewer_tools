// src/components/ChatContextMenu.jsx
import React, { useEffect, useRef } from 'react';
import { 
    Ban, 
    Clock, 
    ShieldCheck, 
    Star, 
    VolumeX, 
    Volume2,
    Crown
} from 'lucide-react';

const ChatContextMenu = ({ 
    x, 
    y, 
    message, 
    onClose, 
    onAction,
    isTtsBlocked = false
}) => {
    const menuRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (menuRef.current && !menuRef.current.contains(event.target)) {
                onClose();
            }
        };

        const handleEscape = (event) => {
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

    const handleAction = (action) => {
        onAction(action, message);
        onClose();
    };

    // Определяем, какие действия доступны для платформы
    const isTwitch = message.platform === 'twitch';
    const isVk = message.platform === 'vk';
    
    // VK Live API ограничения - доступны только базовые функции
    const vkAvailableActions = ['block_tts', 'unblock_tts'];
    const twitchAvailableActions = ['block_tts', 'unblock_tts', 'timeout_10m', 'timeout_1h', 'ban', 'add_moderator', 'remove_moderator', 'add_vip', 'remove_vip'];

    return (
        <div
            ref={menuRef}
            className="fixed bg-popover border border-border rounded-md shadow-lg py-1 z-50 min-w-[200px]"
            style={{
                left: `${x}px`,
                top: `${y}px`,
            }}
        >
            {/* TTS Блокировка */}
            <button
                onClick={() => handleAction(isTtsBlocked ? 'unblock_tts' : 'block_tts')}
                className="w-full px-4 py-2 text-sm text-left hover:bg-accent flex items-center gap-2 transition-colors"
            >
                {isTtsBlocked ? (
                    <>
                        <Volume2 className="h-4 w-4 text-green-500" />
                        <span>Разблокировать TTS</span>
                    </>
                ) : (
                    <>
                        <VolumeX className="h-4 w-4 text-red-500" />
                        <span>Заблокировать TTS</span>
                    </>
                )}
            </button>

            {/* Модерация - только для Twitch */}
            {isTwitch && (
                <>
                    <div className="h-px bg-border my-1" />
                    <div className="px-2 py-1 text-xs text-muted-foreground">Модерация (Twitch)</div>
                    
                    <button
                        onClick={() => handleAction('timeout_10m')}
                        className="w-full px-4 py-2 text-sm text-left hover:bg-accent flex items-center gap-2 transition-colors"
                    >
                        <Clock className="h-4 w-4 text-orange-500" />
                        <span>Таймаут 10 минут</span>
                    </button>

                    <button
                        onClick={() => handleAction('timeout_1h')}
                        className="w-full px-4 py-2 text-sm text-left hover:bg-accent flex items-center gap-2 transition-colors"
                    >
                        <Clock className="h-4 w-4 text-orange-500" />
                        <span>Таймаут 1 час</span>
                    </button>

                    <button
                        onClick={() => handleAction('ban')}
                        className="w-full px-4 py-2 text-sm text-left hover:bg-accent flex items-center gap-2 transition-colors text-red-500"
                    >
                        <Ban className="h-4 w-4" />
                        <span>Забанить</span>
                    </button>
                </>
            )}

            {/* VK Live ограничения */}
            {isVk && (
                <>
                    <div className="h-px bg-border my-1" />
                    <div className="px-2 py-1 text-xs text-muted-foreground">VK Live API</div>
                    <div className="px-4 py-2 text-xs text-muted-foreground">
                        Модерация недоступна в VK Live API
                    </div>
                </>
            )}

            {/* Роли - только для Twitch */}
            {isTwitch && (
                <>
                    <div className="h-px bg-border my-1" />
                    <div className="px-2 py-1 text-xs text-muted-foreground">Роли (Twitch)</div>

                    <button
                        onClick={() => handleAction('add_moderator')}
                        className="w-full px-4 py-2 text-sm text-left hover:bg-accent flex items-center gap-2 transition-colors"
                    >
                        <ShieldCheck className="h-4 w-4 text-green-500" />
                        <span>Сделать модератором</span>
                    </button>

                    <button
                        onClick={() => handleAction('remove_moderator')}
                        className="w-full px-4 py-2 text-sm text-left hover:bg-accent flex items-center gap-2 transition-colors"
                    >
                        <ShieldCheck className="h-4 w-4 text-gray-500" />
                        <span>Снять модератора</span>
                    </button>

                    <button
                        onClick={() => handleAction('add_vip')}
                        className="w-full px-4 py-2 text-sm text-left hover:bg-accent flex items-center gap-2 transition-colors"
                    >
                        <Star className="h-4 w-4 text-purple-500" />
                        <span>Сделать VIP</span>
                    </button>

                    <button
                        onClick={() => handleAction('remove_vip')}
                        className="w-full px-4 py-2 text-sm text-left hover:bg-accent flex items-center gap-2 transition-colors"
                    >
                        <Star className="h-4 w-4 text-gray-500" />
                        <span>Снять VIP</span>
                    </button>
                </>
            )}

            {/* VK Live - роли недоступны */}
            {isVk && (
                <>
                    <div className="h-px bg-border my-1" />
                    <div className="px-2 py-1 text-xs text-muted-foreground">Роли (VK Live)</div>
                    <div className="px-4 py-2 text-xs text-muted-foreground">
                        Управление ролями недоступно в VK Live API
                    </div>
                </>
            )}
        </div>
    );
};

export default ChatContextMenu;





