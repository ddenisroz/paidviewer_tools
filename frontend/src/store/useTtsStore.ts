// frontend/src/store/useTtsStore.ts
/**
 * Zustand store for TTS state management.
 *
 * Manages:
 * - TTS enabled/disabled status
 * - Engine health status
 * - Whitelist status
 * - Voice loading state
 */

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

interface EngineStatus {
    loaded: boolean;
    error: string | null;
}

interface TtsState {
    // State
    ttsEnabled: boolean;
    isWhitelisted: boolean | null;
    engineStatus: EngineStatus;
    isInitialized: boolean;
    isToggling: boolean;
    isCheckingHealth: boolean;

    // Actions
    setTtsEnabled: (enabled: boolean) => void;
    setIsWhitelisted: (value: boolean | null) => void;
    setEngineStatus: (status: EngineStatus) => void;
    setIsInitialized: (value: boolean) => void;
    setIsToggling: (value: boolean) => void;
    setIsCheckingHealth: (value: boolean) => void;
    reset: () => void;
}

const initialState = {
    ttsEnabled: false,
    isWhitelisted: null,
    engineStatus: { loaded: false, error: null },
    isInitialized: false,
    isToggling: false,
    isCheckingHealth: false,
};

export const useTtsStore = create<TtsState>()(
    devtools(
        persist(
            (set) => ({
                ...initialState,

                setTtsEnabled: (enabled) => set({ ttsEnabled: enabled }),

                setIsWhitelisted: (value) => set({ isWhitelisted: value }),

                setEngineStatus: (status) => set({ engineStatus: status }),

                setIsInitialized: (value) => set({ isInitialized: value }),

                setIsToggling: (value) => set({ isToggling: value }),

                setIsCheckingHealth: (value) => set({ isCheckingHealth: value }),

                reset: () => set(initialState),
            }),
            {
                name: 'tts-storage',
                partialize: (state) => ({
                    ttsEnabled: state.ttsEnabled,
                    isWhitelisted: state.isWhitelisted,
                }),
            }
        ),
        { name: 'TtsStore' }
    )
);

// Selector hooks for optimized re-renders
export const useTtsEnabled = () => useTtsStore((state) => state.ttsEnabled);
export const useIsWhitelisted = () => useTtsStore((state) => state.isWhitelisted);
export const useEngineStatus = () => useTtsStore((state) => state.engineStatus);
export const useIsToggling = () => useTtsStore((state) => state.isToggling);
