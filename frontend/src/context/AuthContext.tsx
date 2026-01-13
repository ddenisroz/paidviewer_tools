import React, { createContext, ReactNode, useContext, useEffect, useState } from 'react';

import { authLogger as logger } from '../shared/utils/prodLogger';
import { getSharedWebSocket } from '../shared/utils/sharedWebSocket';
import { useAuthStore } from '../store/useAuthStore';

import type { User } from '@/types/user';


interface AuthContextType {
    user: User | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    isCheckingAuth: boolean;
    integrationsNeedRefresh: boolean;
    loginWithTwitch: () => void;
    loginWithVk: () => void;
    logout: () => Promise<void>;
    checkAuthStatus: () => Promise<void>;
    refreshAuthStatus: (force?: boolean) => Promise<void>;
    markIntegrationsRefreshed: () => void;
    isWhitelisted: (platform: string, channel: string) => boolean;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const {
        user,
        isAuthenticated,
        isLoading,
        checkAuth,
        loginWithTwitch,
        loginWithVk,
        logout
    } = useAuthStore();

    // Track if we have performed the initial check
    const [initialCheckDone, setInitialCheckDone] = useState(false);

    // isCheckingAuth logic: if store is loading OR we haven't done initial check
    const isCheckingAuth = isLoading || !initialCheckDone;

    const [integrationsNeedRefresh, setIntegrationsNeedRefresh] = useState(false);

    // Initial auth check and URL param handling
    useEffect(() => {
        const initAuth = async () => {
            // Check for auth params in URL
            const currentUrl = new URL(window.location.href);
            const hasAuthParams = currentUrl.searchParams.has('auth') ||
                currentUrl.searchParams.has('success') ||
                currentUrl.searchParams.has('error');

            if (hasAuthParams) {
                window.history.replaceState({}, '', window.location.pathname);
            }

            await checkAuth();
            setInitialCheckDone(true);
        };

        if (!initialCheckDone) {
            initAuth();
        }
    }, [checkAuth, initialCheckDone]);

    // WebSocket management
    useEffect(() => {
        if (user?.id) {
            logger.info(`[AuthContext] Initializing WebSocket for user ${user.id}`);
            const wsManager = getSharedWebSocket(user.id);

            return () => {
                logger.info('[AuthContext] Cleaning up WebSocket');
                wsManager.cleanup();
            };
        }
    }, [user?.id]);

    const isWhitelisted = (platform: string, channel: string): boolean => {
        if (!user) return false;
        if (user.is_admin) return true;

        if (user.whitelisted_channels) {
            if (platform === 'twitch' && user.whitelisted_channels.twitch === channel) return true;
            if (platform === 'vk' && user.whitelisted_channels.vk === channel) return true;
        }

        return false;
    };

    const refreshAuthStatus = async (_force?: boolean) => {
        await checkAuth();
    };

    const markIntegrationsRefreshed = () => {
        setIntegrationsNeedRefresh(false);
    };

    return (
        <AuthContext.Provider value={{
            user,
            isAuthenticated,
            isLoading,
            isCheckingAuth,
            integrationsNeedRefresh,
            loginWithTwitch,
            loginWithVk,
            logout,
            checkAuthStatus: checkAuth,
            refreshAuthStatus,
            markIntegrationsRefreshed,
            isWhitelisted
        }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
