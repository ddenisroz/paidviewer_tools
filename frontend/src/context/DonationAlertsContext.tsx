// src/context/DonationAlertsContext.tsx
import React, { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react';

/* eslint-disable react-refresh/only-export-components */
import { saveReturnUrl } from '@/features/auth/utils/oauthRedirect';
import { apiClient } from '@/services/api/client';
import { integrationsService } from '@/services/api/services/integrationsService';
import { logger } from '@/shared/utils/prodLogger';

import { useAuth } from './AuthContext';

import type { AxiosError } from 'axios';

interface DonationAlertsContextValue {
    isConnected: boolean;
    isLoading: boolean;
    error: string | null;
    connect: () => Promise<boolean>;
    disconnect: () => Promise<boolean>;
    checkStatus: () => Promise<void>;
}

const DonationAlertsContext = createContext<DonationAlertsContextValue | undefined>(undefined);

export const useDonationAlerts = (): DonationAlertsContextValue => {
    const context = useContext(DonationAlertsContext);
    if (!context) {
        throw new Error('useDonationAlerts must be used within a DonationAlertsProvider');
    }
    return context;
};

interface DonationAlertsProviderProps {
    children: ReactNode;
}

interface DonationAlertsStatusResponse {
    connected?: boolean;
}

const getApiErrorMessage = (err: unknown, fallback: string): string => {
    const axiosError = err as AxiosError<{ detail?: string; message?: string } | string>;
    const data = axiosError.response?.data;
    if (typeof data === 'string' && data.trim()) {
        return data;
    }
    if (data && typeof data === 'object') {
        return data.detail || data.message || fallback;
    }
    if (err instanceof Error && err.message) {
        return err.message;
    }
    return fallback;
};

export const DonationAlertsProvider: React.FC<DonationAlertsProviderProps> = ({ children }) => {
    const { user } = useAuth();
    const [isConnected, setIsConnected] = useState<boolean>(false);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    const checkStatus = useCallback(async (): Promise<void> => {
        if (!user) {
            setIsConnected(false);
            return;
        }

        try {
            setIsLoading(true);
            setError(null);

            const response = await apiClient.get<DonationAlertsStatusResponse>('/api/donationalerts/status');
            setIsConnected(Boolean(response.data.connected));
        } catch (err) {
            logger.error('Error checking DonationAlerts status:', err);
            setIsConnected(false);
            setError('Ошибка проверки статуса');
        } finally {
            setIsLoading(false);
        }
    }, [user]);

    const connect = async (): Promise<boolean> => {
        if (!user) {
            setError('Необходима авторизация');
            return false;
        }

        try {
            setIsLoading(true);
            setError(null);

            saveReturnUrl();
            integrationsService.connectDonationAlertsRedirect();
            return true;
        } catch (err: unknown) {
            logger.error('Error connecting to DonationAlerts:', err);
            setError(getApiErrorMessage(err, 'Не удалось подключить DonationAlerts'));
            return false;
        } finally {
            setIsLoading(false);
        }
    };

    const disconnect = async (): Promise<boolean> => {
        try {
            setIsLoading(true);
            setError(null);

            await apiClient.post('/api/donationalerts/disconnect');
            setIsConnected(false);
            return true;
        } catch (err: unknown) {
            logger.error('Error disconnecting from DonationAlerts:', err);
            setError(getApiErrorMessage(err, 'Не удалось отключить DonationAlerts'));
            return false;
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        checkStatus();
    }, [checkStatus]);

    useEffect(() => {
        const handleDonationAlertsConnected = (event: CustomEvent): void => {
            if (event.detail && event.detail.success) {
                setIsConnected(true);
                setError(null);
                checkStatus();
            }
        };

        window.addEventListener('donationalerts_connected', handleDonationAlertsConnected as EventListener);

        return () => {
            window.removeEventListener('donationalerts_connected', handleDonationAlertsConnected as EventListener);
        };
    }, [checkStatus]);

    const value: DonationAlertsContextValue = {
        isConnected,
        isLoading,
        error,
        connect,
        disconnect,
        checkStatus,
    };

    return <DonationAlertsContext.Provider value={value}>{children}</DonationAlertsContext.Provider>;
};
