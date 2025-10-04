// src/context/DonationAlertsContext.jsx
import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';

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
            
            const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/donationalerts/status`, {
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
            console.error('Error checking DonationAlerts status:', err);
            setIsConnected(false);
            setError('Ошибка проверки статуса');
        } finally {
            setIsLoading(false);
        }
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
            
            const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/donationalerts/connect`, {
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
                // Открываем окно авторизации
                const popup = window.open(
                    data.auth_url,
                    'donationalerts_auth',
                    'width=600,height=700,scrollbars=yes,resizable=yes'
                );
                
                // Слушаем сообщения от popup окна
                const handleMessage = (event) => {
                    const allowedOrigins = [
                        'http://localhost:8000',
                        'http://localhost:5173',
                        window.location.origin
                    ];
                    
                    if (!allowedOrigins.includes(event.origin)) {
                        return;
                    }
                    
                    if (event.data.type === 'DONATIONALERTS_AUTH_SUCCESS') {
                        console.log('✅ DonationAlerts авторизация успешна!');
                        popup.close();
                        window.removeEventListener('message', handleMessage);
                        // Обновляем статус
                        checkStatus();
                    } else if (event.data.type === 'DONATIONALERTS_AUTH_ERROR') {
                        console.error('❌ Ошибка авторизации DonationAlerts:', event.data.error);
                        popup.close();
                        window.removeEventListener('message', handleMessage);
                        setError(event.data.error || 'Ошибка авторизации');
                    }
                };
                
                window.addEventListener('message', handleMessage);
                
                // Проверяем, не закрыли ли окно
                const checkClosed = setInterval(() => {
                    if (popup.closed) {
                        clearInterval(checkClosed);
                        window.removeEventListener('message', handleMessage);
                        setIsLoading(false);
                    }
                }, 1000);
                
                return true;
            } else {
                throw new Error('URL авторизации не получен');
            }
        } catch (err) {
            console.error('Error connecting to DonationAlerts:', err);
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
            
            const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/donationalerts/disconnect`, {
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
            console.error('Error disconnecting from DonationAlerts:', err);
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
