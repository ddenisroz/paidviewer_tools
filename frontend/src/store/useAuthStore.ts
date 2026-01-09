import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

import { toast } from 'sonner';

import { apiClient } from '@/services/api/client';

import type { User } from '@/types/user';

interface AuthState {
    user: User | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    error: string | null;

    // Actions
    checkAuth: () => Promise<void>;
    logout: () => Promise<void>;
    loginWithTwitch: () => void;
    loginWithVk: () => void;
    setUser: (user: User | null) => void;
    setError: (error: string | null) => void;
}

export const useAuthStore = create<AuthState>()(
    devtools(
        (set, _get) => ({
            user: null,
            isAuthenticated: false,
            isLoading: true,
            error: null,

            setUser: (user) => set({ user, isAuthenticated: !!user }),
            setError: (error) => set({ error }),

            checkAuth: async () => {
                set({ isLoading: true, error: null });
                try {
                    // Changed to /api/auth/status to match expected response format { authenticated, user, ... }
                    const response = await apiClient.get('/api/auth/status');
                    if (response.data?.authenticated) {
                        set({ user: response.data.user, isAuthenticated: true, isLoading: false });
                        console.log('[AuthStore] Auth success:', response.data);
                    } else {
                        set({ user: null, isAuthenticated: false, isLoading: false });
                        console.warn('[AuthStore] Auth check returned false');
                    }
                } catch (error) {
                    // If 401, just not authenticated
                    set({ user: null, isAuthenticated: false, isLoading: false });
                    console.error('[AuthStore] Check auth failed:', error);
                    // DEBUG: Show toast on error (except 401 which is normal for guests)
                    // @ts-ignore
                    if (error?.response?.status !== 401) {
                        // @ts-ignore
                        toast.error(`Auth Check Failed: ${error.message || 'Unknown error'}`);
                    }
                }
            },

            logout: async () => {
                set({ isLoading: true });
                try {
                    await apiClient.post('/api/auth/logout');
                    set({ user: null, isAuthenticated: false, isLoading: false });

                    // Clear local storage if any
                    localStorage.removeItem('cached_user');

                    // Reload page to clear all states
                    window.location.reload();
                } catch (error) {
                    console.error('[AuthStore] Logout failed:', error);
                    set({ isLoading: false, error: 'Logout failed' });
                }
            },

            loginWithTwitch: () => {
                const baseUrl = apiClient.defaults.baseURL || '';
                window.location.href = `${baseUrl}/auth/twitch/login`;
            },

            loginWithVk: () => {
                const baseUrl = apiClient.defaults.baseURL || '';
                window.location.href = `${baseUrl}/auth/vk/login`;
            }
        }),
        { name: 'AuthStore' }
    )
);
