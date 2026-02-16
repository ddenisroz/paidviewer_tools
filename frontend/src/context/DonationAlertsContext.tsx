// src/context/DonationAlertsContext.tsx
import React, { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react';

/* eslint-disable react-refresh/only-export-components */
import { API_BASE_URL } from '@/constants';
import { saveReturnUrl } from '@/features/auth/utils/oauthRedirect';
import { logger } from '@/shared/utils/prodLogger';

import { useAuth } from './AuthContext';

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

            const response = await fetch(`${API_BASE_URL}/api/donationalerts/status`, {
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                const data = await response.json();
                setIsConnected(data.connected || false);
            } else {
                setIsConnected(false);
            }
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

            const response = await fetch(`${API_BASE_URL}/api/donationalerts/connect`, {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Ошибка подключения: ${response.status} - ${errorText}`);
            }

            const data = await response.json();

            if (data.auth_url) {
                saveReturnUrl();
                window.location.href = data.auth_url;
                return true;
            } else {
                throw new Error('URL авторизации не получен');
            }
        } catch (err: unknown) {
            logger.error('Error connecting to DonationAlerts:', err);
            const error = err as { message?: string };
            setError(error.message || 'Неизвестная ошибка');
            return false;
        } finally {
            setIsLoading(false);
        }
    };

    const disconnect = async (): Promise<boolean> => {
        try {
            setIsLoading(true);
            setError(null);

            const response = await fetch(`${API_BASE_URL}/api/donationalerts/disconnect`, {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                setIsConnected(false);
                return true;
            } else {
                throw new Error('Ошибка отключения');
            }
        } catch (err: unknown) {
            logger.error('Error disconnecting from DonationAlerts:', err);
            const error = err as { message?: string };
            setError(error.message || 'Неизвестная ошибка');
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
        checkStatus
    };

    return (
        <DonationAlertsContext.Provider value={value}>
            {children}
        </DonationAlertsContext.Provider>
    );
};

