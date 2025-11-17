import React, { createContext, useContext, useState, useCallback, useRef, useEffect, ReactNode } from 'react';
import { logger } from '../utils/prodLogger';
import { useAudioPriority } from './AudioPriorityContext';

interface TtsQueueItem {
    id: string;
    text: string;
    audioUrl: string;
    volume: number;
    username?: string;
    platform?: string;
    timestamp: Date;
}

interface TtsPlayerContextValue {
    queue: TtsQueueItem[];
    currentItem: TtsQueueItem | null;
    isPlaying: boolean;
    addToQueue: (item: Omit<TtsQueueItem, 'id' | 'timestamp'>) => void;
    clearQueue: () => void;
    skipCurrent: () => void;
}

const TtsPlayerContext = createContext<TtsPlayerContextValue | undefined>(undefined);

interface TtsPlayerProviderProps {
    children: ReactNode;
}

export const TtsPlayerProvider: React.FC<TtsPlayerProviderProps> = ({ children }) => {
    const [queue, setQueue] = useState<TtsQueueItem[]>([]);
    const [currentItem, setCurrentItem] = useState<TtsQueueItem | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    
    const audioContext = useRef<AudioContext | null>(null);
    const currentSource = useRef<AudioBufferSourceNode | null>(null);
    const audioElement = useRef<HTMLAudioElement | null>(null);
    const { requestAudioFocus, releaseAudioFocus } = useAudioPriority();

    // Initialize AudioContext
    useEffect(() => {
        const initAudioContext = () => {
            if (!audioContext.current || audioContext.current.state === 'closed') {
                audioContext.current = new (window.AudioContext || (window as any).webkitAudioContext)();
                logger.info('🎵 [TTS Player] AudioContext created');
            }
        };

        // Initialize on user interaction
        const handleUserInteraction = () => {
            initAudioContext();
            document.removeEventListener('click', handleUserInteraction);
            document.removeEventListener('keydown', handleUserInteraction);
        };

        document.addEventListener('click', handleUserInteraction);
        document.addEventListener('keydown', handleUserInteraction);

        return () => {
            document.removeEventListener('click', handleUserInteraction);
            document.removeEventListener('keydown', handleUserInteraction);
            
            if (audioContext.current && audioContext.current.state !== 'closed') {
                audioContext.current.close();
            }
        };
    }, []);

    const playNext = useCallback(async () => {
        if (queue.length === 0) {
            setCurrentItem(null);
            setIsPlaying(false);
            releaseAudioFocus('tts');
            return;
        }

        const nextItem = queue[0];
        setCurrentItem(nextItem);
        setIsPlaying(true);
        
        // Remove from queue
        setQueue(prev => prev.slice(1));

        // Request audio focus (pause/duck YouTube)
        requestAudioFocus('tts');

        try {
            // Try Web Audio API first
            if (audioContext.current && audioContext.current.state !== 'closed') {
                if (audioContext.current.state === 'suspended') {
                    await audioContext.current.resume();
                }

                logger.debug(`📥 [TTS Player] Fetching audio from: ${nextItem.audioUrl}`);
                const response = await fetch(nextItem.audioUrl);
                
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                
                const arrayBuffer = await response.arrayBuffer();
                const audioBuffer = await audioContext.current.decodeAudioData(arrayBuffer);
                
                const source = audioContext.current.createBufferSource();
                const gainNode = audioContext.current.createGain();
                
                source.buffer = audioBuffer;
                gainNode.gain.value = nextItem.volume / 100;
                
                source.connect(gainNode);
                gainNode.connect(audioContext.current.destination);
                
                source.onended = () => {
                    logger.debug('🎵 [TTS Player] Audio finished');
                    currentSource.current = null;
                    releaseAudioFocus('tts');
                    setIsPlaying(false);
                    setCurrentItem(null);
                    
                    // Play next item after a short delay
                    setTimeout(() => playNext(), 100);
                };
                
                currentSource.current = source;
                source.start(0);
                logger.info(`✅ [TTS Player] Playing TTS via Web Audio API`);
                
            } else {
                throw new Error('AudioContext not available');
            }
        } catch (err: any) {
            logger.warn('[TTS Player] Web Audio API failed, falling back to Audio element:', err.message);
            
            // Fallback to HTML Audio element
            const audio = new Audio(nextItem.audioUrl);
            audio.volume = nextItem.volume / 100;
            
            audio.onended = () => {
                logger.debug('🎵 [TTS Player] Audio finished (fallback)');
                audioElement.current = null;
                releaseAudioFocus('tts');
                setIsPlaying(false);
                setCurrentItem(null);
                
                // Play next item after a short delay
                setTimeout(() => playNext(), 100);
            };
            
            audio.onerror = () => {
                logger.error('[TTS Player] Audio playback error');
                audioElement.current = null;
                releaseAudioFocus('tts');
                setIsPlaying(false);
                setCurrentItem(null);
                
                // Try next item
                setTimeout(() => playNext(), 100);
            };
            
            audioElement.current = audio;
            
            try {
                await audio.play();
                logger.info(`✅ [TTS Player] Playing TTS via Audio element`);
            } catch (playErr) {
                logger.error('[TTS Player] Failed to play audio:', playErr);
                releaseAudioFocus('tts');
                setIsPlaying(false);
                setCurrentItem(null);
                
                // Try next item
                setTimeout(() => playNext(), 100);
            }
        }
    }, [queue, requestAudioFocus, releaseAudioFocus]);

    // Auto-play when queue has items and nothing is playing
    useEffect(() => {
        if (queue.length > 0 && !isPlaying && !currentItem) {
            playNext();
        }
    }, [queue, isPlaying, currentItem, playNext]);

    const addToQueue = useCallback((item: Omit<TtsQueueItem, 'id' | 'timestamp'>) => {
        const newItem: TtsQueueItem = {
            ...item,
            id: `${Date.now()}-${Math.random()}`,
            timestamp: new Date()
        };
        
        setQueue(prev => [...prev, newItem]);
        logger.debug(`📝 [TTS Player] Added to queue: ${newItem.text.substring(0, 50)}...`);
    }, []);

    const clearQueue = useCallback(() => {
        // Stop current playback
        if (currentSource.current) {
            currentSource.current.stop();
            currentSource.current = null;
        }
        if (audioElement.current) {
            audioElement.current.pause();
            audioElement.current = null;
        }
        
        setQueue([]);
        setCurrentItem(null);
        setIsPlaying(false);
        releaseAudioFocus('tts');
        logger.info('🗑️ [TTS Player] Queue cleared');
    }, [releaseAudioFocus]);

    const skipCurrent = useCallback(() => {
        // Stop current playback
        if (currentSource.current) {
            currentSource.current.stop();
            currentSource.current = null;
        }
        if (audioElement.current) {
            audioElement.current.pause();
            audioElement.current = null;
        }
        
        setCurrentItem(null);
        setIsPlaying(false);
        releaseAudioFocus('tts');
        
        // Play next item
        setTimeout(() => playNext(), 100);
        logger.info('⏭️ [TTS Player] Skipped current item');
    }, [playNext, releaseAudioFocus]);

    const value: TtsPlayerContextValue = {
        queue,
        currentItem,
        isPlaying,
        addToQueue,
        clearQueue,
        skipCurrent
    };

    return (
        <TtsPlayerContext.Provider value={value}>
            {children}
        </TtsPlayerContext.Provider>
    );
};

export const useTtsPlayer = (): TtsPlayerContextValue => {
    const context = useContext(TtsPlayerContext);
    if (!context) {
        throw new Error('useTtsPlayer must be used within a TtsPlayerProvider');
    }
    return context;
};

export default TtsPlayerContext;
