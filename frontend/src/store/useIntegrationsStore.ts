// frontend/src/store/useIntegrationsStore.ts
/**
 * Zustand store for integrations state management.
 *
 * Manages:
 * - Connected platform integrations (Twitch, VK, DonationAlerts)
 * - Loading state
 * - Error state
 */

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

export interface Integration {
    connected: boolean;
    username: string | null;
    platform_user_id: string | null;
    avatar_url: string | null;
}

export interface IntegrationsState {
    // State
    integrations: Record<string, Integration>;
    isLoading: boolean;
    error: string | null;
    lastFetched: number | null;

    // Actions
    setIntegrations: (integrations: Record<string, Integration>) => void;
    setLoading: (loading: boolean) => void;
    setError: (error: string | null) => void;
    clearIntegrations: () => void;

    // Derived helpers
    hasIntegration: (platform: string) => boolean;
    getIntegration: (platform: string) => Integration | null;
}

export const useIntegrationsStore = create<IntegrationsState>()(
    devtools(
        persist(
            (set, get) => ({
                integrations: {},
                isLoading: false,
                error: null,
                lastFetched: null,

                setIntegrations: (integrations) =>
                    set({
                        integrations,
                        lastFetched: Date.now(),
                        error: null,
                    }),

                setLoading: (isLoading) => set({ isLoading }),

                setError: (error) => set({ error, isLoading: false }),

                clearIntegrations: () =>
                    set({
                        integrations: {},
                        lastFetched: null,
                        error: null,
                    }),

                hasIntegration: (platform) => {
                    const { integrations } = get();
                    return integrations[platform]?.connected ?? false;
                },

                getIntegration: (platform) => {
                    const { integrations } = get();
                    return integrations[platform] ?? null;
                },
            }),
            {
                name: 'integrations-storage',
                partialize: (state) => ({
                    integrations: state.integrations,
                    lastFetched: state.lastFetched,
                }),
            }
        ),
        { name: 'IntegrationsStore' }
    )
);

// Selector hooks
export const useTwitchIntegration = () => useIntegrationsStore((state) => state.integrations.twitch ?? null);

export const useVkIntegration = () => useIntegrationsStore((state) => state.integrations.vk ?? null);

export const useHasAnyIntegration = () =>
    useIntegrationsStore((state) => Object.values(state.integrations).some((i) => i.connected));
