// src/components/AuthGuard.jsx
import React, { useState, useEffect } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

const AuthGuard = () => {
    const { isAuthenticated, userMode, loading, user } = useAuth();
    const [botStatus, setBotStatus] = useState(null);
    const [checkingBot, setCheckingBot] = useState(false);

    useEffect(() => {
        const checkBotStatus = async () => {
            if (userMode === 'guest' && user?.username) {
                setCheckingBot(true);
                try {
                    const response = await api.get(`/api/chat/guest/status?channel_name=${user.username}`);
                    const verified = response.data.verified === true;
                    setBotStatus(verified);
                } catch (error) {
                    console.error('Failed to check bot status:', error);
                    setBotStatus(false);
                } finally {
                    setCheckingBot(false);
                }
            }
        };

        if (!loading && botStatus !== true) {
            checkBotStatus();
        }
        
        // Проверяем статус бота каждые 5 секунд для гостевых пользователей
        // Но только если бот еще не верифицирован
        let interval;
        if (userMode === 'guest' && user?.username && botStatus !== true) {
            interval = setInterval(checkBotStatus, 5000);
        }
        
        return () => {
            if (interval) {
                clearInterval(interval);
            }
        };
    }, [userMode, user, loading, botStatus]);

    // Если загружается или проверяется статус бота, показываем загрузку
    if (loading || checkingBot || (userMode === 'guest' && botStatus === null)) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-background">
                <p>Загрузка...</p>
            </div>
        );
    }

    // Доступ разрешен, если пользователь аутентифицирован ИЛИ находится в гостевом режиме с подключенным ботом
    const isAllowed = isAuthenticated || (userMode === 'guest' && botStatus === true);

    if (!isAllowed) {
        // Если доступ не разрешен, перенаправляем на страницу входа
        return <Navigate to="/login" replace />;
    }

    // Если доступ разрешен, показываем вложенные роуты (дашборд)
    return <Outlet />;
};

export default AuthGuard;
