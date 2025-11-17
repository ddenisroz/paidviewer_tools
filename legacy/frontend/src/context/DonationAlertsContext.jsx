// src/context/DonationAlertsContext.jsx
import React, { createContext, useContext, useState, useEffect } from 'react';
import { API_BASE_URL } from '../constants';
import { useAuth } from './AuthContext';
import { saveReturnUrl } from '../utils/oauthRedirect';
import { logger } from '../utils/prodLogger';

const DonationAlertsContext = createContext();

export const useDonationAlerts = () => {
    const context = useContext(DonationAlertsContext);
    if (!context) {
        throw new Error('useDonationAlerts must be used within a DonationAlertsProvider');
    }
    return context;
};

export const DonationAlertsProvider = ({ children }) => {
    const { user } = useAuth();
    const [isConnected, setIsConnected] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);

    // Проверка статуса подключения
    const checkStatus = async () => {
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
        /* eslint-enable no-unreachable */
    };

    // Подключение к DonationAlerts
    const connect = async () => {
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
                // 💾 Сохраняем текущую страницу перед редиректом
                saveReturnUrl();
                // Прямое перенаправление на страницу авторизации
                window.location.href = data.auth_url;
                return true;
            } else {
                throw new Error('URL авторизации не получен');
            }
        } catch (err) {
            logger.error('Error connecting to DonationAlerts:', err);
            setError(err.message);
            return false;
        } finally {
            setIsLoading(false);
        }
    };

    // Отключение от DonationAlerts
    const disconnect = async () => {
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
        } catch (err) {
            logger.error('Error disconnecting from DonationAlerts:', err);
            setError(err.message);
            return false;
        } finally {
            setIsLoading(false);
        }
    };

    // Проверяем статус при изменении пользователя
    useEffect(() => {
        checkStatus();
    }, [user]);

    // Слушаем событие успешного подключения от callback страницы
    useEffect(() => {
        const handleDonationAlertsConnected = (event) => {
            if (event.detail && event.detail.success) {
                setIsConnected(true);
                setError(null);
                checkStatus(); // Обновляем статус
            }
        };

        window.addEventListener('donationalerts_connected', handleDonationAlertsConnected);
        
        return () => {
            window.removeEventListener('donationalerts_connected', handleDonationAlertsConnected);
        };
    }, []);

    const value = {
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
