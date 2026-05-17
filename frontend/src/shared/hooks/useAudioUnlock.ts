// src/hooks/useAudioUnlock.ts
/**
 * Hook to handle audio context unlock on user interaction.
 * Required for autoplay policies in browsers.
 */

import { useCallback, useEffect, useRef } from 'react';

interface UseAudioUnlockOptions {
    onUnlock?: () => void;
}

export const useAudioUnlock = (options: UseAudioUnlockOptions = {}) => {
    const isUnlocked = useRef(false);
    const audioContext = useRef<AudioContext | null>(null);

    const unlock = useCallback(async () => {
        if (isUnlocked.current) return;

        try {
            if (!audioContext.current) {
                audioContext.current = new (
                    window.AudioContext ||
                    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
                )();
            }

            if (audioContext.current.state === 'suspended') {
                await audioContext.current.resume();
            }

            // Play silent buffer to unlock
            const buffer = audioContext.current.createBuffer(1, 1, 22050);
            const source = audioContext.current.createBufferSource();
            source.buffer = buffer;
            source.connect(audioContext.current.destination);
            source.start(0);

            isUnlocked.current = true;
            options.onUnlock?.();
        } catch (error) {
            console.warn('Failed to unlock audio:', error);
        }
    }, [options]);

    useEffect(() => {
        const events = ['click', 'touchstart', 'keydown'];

        const handleInteraction = () => {
            unlock();
            // Remove listeners after first interaction
            events.forEach((event) => {
                document.removeEventListener(event, handleInteraction);
            });
        };

        events.forEach((event) => {
            document.addEventListener(event, handleInteraction, { once: true });
        });

        return () => {
            events.forEach((event) => {
                document.removeEventListener(event, handleInteraction);
            });
        };
    }, [unlock]);

    return {
        isUnlocked: isUnlocked.current,
        unlock,
        audioContext: audioContext.current,
    };
};

export default useAudioUnlock;
