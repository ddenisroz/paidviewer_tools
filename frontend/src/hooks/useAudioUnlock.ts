// src/hooks/useAudioUnlock.ts
/**
 * Хук для разблокировки AudioContext после user interaction.
 * Браузеры блокируют автовоспроизведение аудио до первого взаимодействия пользователя.
 */
import { useEffect, useRef } from 'react';

import { logger } from '../utils/prodLogger';

interface UseAudioUnlockReturn {
    audioContext: React.MutableRefObject<AudioContext | null>;
    isUnlocked: boolean;
}

export function useAudioUnlock(): UseAudioUnlockReturn {
    const audioContext = useRef<AudioContext | null>(null);
    const audioUnlocked = useRef<boolean>(false);

    useEffect(() => {
        const unlockAudioContext = async (): Promise<void> => {
            if (audioUnlocked.current) return;
            
            audioUnlocked.current = true;
            logger.info('[OK] User interaction detected - audio unlocked');

            // Remove listeners after first interaction
            document.removeEventListener('click', unlockAudioContext);
            document.removeEventListener('touchstart', unlockAudioContext);
            document.removeEventListener('keydown', unlockAudioContext);

            // Resume AudioContext if suspended
            if (audioContext.current && audioContext.current.state === 'suspended') {
                try {
                    await audioContext.current.resume();
                    logger.info('[VOLUME] AudioContext resumed after user gesture');
                } catch (err) {
                    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
                    logger.debug('AudioContext resume failed:', errorMessage);
                }
            }
        };

        // Add listeners for user interaction
        document.addEventListener('click', unlockAudioContext);
        document.addEventListener('touchstart', unlockAudioContext);
        document.addEventListener('keydown', unlockAudioContext);

        return () => {
            document.removeEventListener('click', unlockAudioContext);
            document.removeEventListener('touchstart', unlockAudioContext);
            document.removeEventListener('keydown', unlockAudioContext);
        };
    }, []);

    return {
        audioContext,
        isUnlocked: audioUnlocked.current
    };
}
