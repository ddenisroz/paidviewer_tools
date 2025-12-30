import React, { createContext, ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react';

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
    const queueRef = useRef<TtsQueueItem[]>([]);
    const retryCount = useRef<number>(0);
    const MAX_RETRIES = 3;
    const { requestAudioFocus, releaseAudioFocus } = useAudioPriority();
    
    // Sync queue with ref
    useEffect(() => {
        queueRef.current = queue;
    }, [queue]);

    // Initialize AudioContext
    useEffect(() => {
        const initAudioContext = () => {
            if (!audioContext.current || audioContext.current.state === 'closed') {
                // Type-safe AudioContext initialization
                const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
                if (AudioContextClass) {
                    audioContext.current = new AudioContextClass();
                    logger.info('[AUDIO] [TTS Player] AudioContext created');
                }
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
        const currentQueue = queueRef.current;
        
        if (currentQueue.length === 0) {
            setCurrentItem(null);
            setIsPlaying(false);
            releaseAudioFocus('tts');
            return;
        }

        const nextItem = currentQueue[0];
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

                logger.debug(`[RECEIVE] [TTS Player] Fetching audio from: ${nextItem.audioUrl}`);
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
                    logger.debug('[AUDIO] [TTS Player] Audio finished');
                    retryCount.current = 0; // Reset retry counter on success
                    currentSource.current = null;
                    releaseAudioFocus('tts');
                    setIsPlaying(false);
                    setCurrentItem(null);
                    
                    // Play next item after a short delay
                    setTimeout(() => playNext(), 100);
                };
                
                currentSource.current = source;
                source.start(0);
                logger.info(`[OK] [TTS Player] Playing TTS via Web Audio API`);
                
            } else {
                throw new Error('AudioContext not available');
            }
        } catch (err: unknown) {
            const errorMessage = err instanceof Error ? err.message : 'Unknown error';
            logger.warn('[TTS Player] Web Audio API failed, falling back to Audio element:', errorMessage);
            
            // Fallback to HTML Audio element
            const audio = new Audio(nextItem.audioUrl);
            audio.volume = nextItem.volume / 100;
            
            audio.onended = () => {
                logger.debug('[AUDIO] [TTS Player] Audio finished (fallback)');
                retryCount.current = 0; // Reset retry counter on success
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
                
                // Retry with limit
                if (retryCount.current < MAX_RETRIES) {
                    retryCount.current++;
                    logger.warn(`[TTS Player] Retrying (${retryCount.current}/${MAX_RETRIES})...`);
                    setTimeout(() => playNext(), 500);
                } else {
                    logger.error('[TTS Player] Max retries reached, skipping item');
                    retryCount.current = 0;
                    setQueue(prev => prev.slice(1)); // Remove problematic item
                    setTimeout(() => playNext(), 100);
                }
            };
            
            audioElement.current = audio;
            
            try {
                await audio.play();
                retryCount.current = 0; // Reset on successful play
                logger.info(`[OK] [TTS Player] Playing TTS via Audio element`);
            } catch (playErr) {
                logger.error('[TTS Player] Failed to play audio:', playErr);
                audioElement.current = null;
                releaseAudioFocus('tts');
                setIsPlaying(false);
                setCurrentItem(null);
                
                // Retry with limit
                if (retryCount.current < MAX_RETRIES) {
                    retryCount.current++;
                    logger.warn(`[TTS Player] Retrying (${retryCount.current}/${MAX_RETRIES})...`);
                    setTimeout(() => playNext(), 500);
                } else {
                    logger.error('[TTS Player] Max retries reached, skipping item');
                    retryCount.current = 0;
                    setQueue(prev => prev.slice(1)); // Remove problematic item
                    setTimeout(() => playNext(), 100);
                }
            }
        }
    }, [requestAudioFocus, releaseAudioFocus]);

    // Auto-play when queue has items and nothing is playing
    useEffect(() => {
        if (queue.length > 0 && !isPlaying && !currentItem) {
            playNext();
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [queue.length, isPlaying, currentItem]);

    const addToQueue = useCallback((item: Omit<TtsQueueItem, 'id' | 'timestamp'>) => {
        const newItem: TtsQueueItem = {
            ...item,
            id: `${Date.now()}-${Math.random()}`,
            timestamp: new Date()
        };
        
        setQueue(prev => [...prev, newItem]);
        logger.debug(`[LOG] [TTS Player] Added to queue: ${newItem.text.substring(0, 50)}...`);
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
        logger.info('[DELETE] [TTS Player] Queue cleared');
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
        logger.info('[SKIP] [TTS Player] Skipped current item');
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
