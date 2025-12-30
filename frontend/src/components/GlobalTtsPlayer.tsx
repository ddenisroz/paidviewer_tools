import React, { useState } from 'react';

import { ChevronDown, ChevronUp, List, MessageSquare, SkipForward, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { BUTTON_SIZES, TRANSITIONS } from '@/constants/designSystem';
import { cn } from '@/lib/utils';

import { useTtsPlayer } from '../context/TtsPlayerContext';

const GlobalTtsPlayer: React.FC = () => {
    const { queue, currentItem, isPlaying, clearQueue, skipCurrent } = useTtsPlayer();
    const [showQueue, setShowQueue] = useState(false);

    // Don't show player if nothing is playing and queue is empty
    if (!currentItem && queue.length === 0) {
        return null;
    }

    // Format text for display (truncate if too long)
    const formatText = (text: string, maxLength: number = 100) => {
        if (text.length <= maxLength) return text;
        return `${text.substring(0, maxLength)  }...`;
    };

    return (
        <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-2 pointer-events-none">
            {/* Queue panel - shows above the player */}
            {showQueue && queue.length > 0 && (
                <div className="bg-gray-900/95 backdrop-blur-md border border-gray-700 rounded-xl shadow-2xl w-80 max-h-64 overflow-hidden pointer-events-auto">
                    <div className="flex items-center justify-between px-4 py-2 border-b border-gray-700">
                        <div className="flex items-center gap-2">
                            <List className="w-4 h-4 text-gray-400" />
                            <span className="text-sm text-gray-300 font-medium">Очередь TTS ({queue.length})</span>
                        </div>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setShowQueue(false)}
                            className="text-gray-400 hover:text-white hover:bg-gray-800 border-0 p-1 h-6 w-6"
                        >
                            <ChevronDown className="w-4 h-4" />
                        </Button>
                    </div>
                    <div className="h-56 overflow-y-auto">
                        <div className="p-2 space-y-1">
                            {queue.map((item, index) => (
                                <div 
                                    key={item.id} 
                                    className="flex items-start gap-2 p-2 rounded-lg hover:bg-gray-800/50 transition-colors"
                                >
                                    <div className="flex-shrink-0 w-6 h-6 bg-gray-800 rounded-full flex items-center justify-center text-xs font-medium text-gray-400">
                                        {index + 1}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <p className="text-white text-xs leading-relaxed break-words">
                                            {formatText(item.text, 80)}
                                        </p>
                                        {item.username && (
                                            <p className="text-gray-400 text-xs mt-1">
                                                от {item.username}
                                                {item.platform && ` (${item.platform})`}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}
            
            {/* Main TTS player */}
            {currentItem && (
                <div className="bg-gray-900/95 backdrop-blur-md border border-gray-700 rounded-xl shadow-2xl w-80 pointer-events-auto">
                    <div className="px-4 py-3">
                        {/* Header with icon and controls */}
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 bg-blue-500/20 rounded-lg flex items-center justify-center">
                                    <MessageSquare className="w-4 h-4 text-blue-400" />
                                </div>
                                <span className="text-sm text-gray-300 font-medium">TTS</span>
                                {isPlaying && (
                                    <div className="flex gap-1">
                                        <div className="w-1 h-3 bg-blue-400 rounded-full animate-pulse" style={{ animationDelay: '0ms' }}></div>
                                        <div className="w-1 h-3 bg-blue-400 rounded-full animate-pulse" style={{ animationDelay: '150ms' }}></div>
                                        <div className="w-1 h-3 bg-blue-400 rounded-full animate-pulse" style={{ animationDelay: '300ms' }}></div>
                                    </div>
                                )}
                            </div>
                            
                            <div className="flex items-center gap-1">
                                {/* Queue button */}
                                {queue.length > 0 && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setShowQueue(!showQueue)}
                                        className={cn(BUTTON_SIZES.iconSm, "text-gray-400 hover:text-white hover:bg-gray-800 border-0 relative", TRANSITIONS.colors)}
                                        title={showQueue ? "Скрыть очередь" : "Показать очередь"}
                                    >
                                        {showQueue ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                                        <span className="absolute -top-1 -right-1 bg-blue-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
                                            {queue.length}
                                        </span>
                                    </Button>
                                )}
                                
                                {/* Skip button */}
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={skipCurrent}
                                    className={cn(BUTTON_SIZES.iconSm, "text-gray-400 hover:text-white hover:bg-gray-800 border-0", TRANSITIONS.colors)}
                                    title="Пропустить"
                                >
                                    <SkipForward className="w-4 h-4" />
                                </Button>
                                
                                {/* Clear queue button */}
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={clearQueue}
                                    className={cn(BUTTON_SIZES.iconSm, "text-gray-400 hover:text-white hover:bg-gray-800 border-0", TRANSITIONS.colors)}
                                    title="Очистить очередь"
                                >
                                    <X className="w-4 h-4" />
                                </Button>
                            </div>
                        </div>
                        
                        {/* Current message */}
                        <div className="bg-gray-800/50 rounded-lg p-3 mb-2">
                            <p className="text-white text-sm leading-relaxed break-words">
                                {currentItem.text}
                            </p>
                        </div>
                        
                        {/* User info */}
                        {currentItem.username && (
                            <div className="flex items-center justify-between text-xs text-gray-400">
                                <span>
                                    от {currentItem.username}
                                    {currentItem.platform && ` (${currentItem.platform})`}
                                </span>
                                {queue.length > 0 && (
                                    <span>
                                        +{queue.length} в очереди
                                    </span>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default GlobalTtsPlayer;
