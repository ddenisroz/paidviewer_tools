import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { logger } from '../utils/prodLogger';

const AuthCallbackPage = () => {
    const navigate = useNavigate();
    const { refreshAuthStatus } = useAuth();

    useEffect(() => {
        const handleCallback = async () => {
            try {
                // Обновляем статус аутентификации (cookie уже установлен backend'ом)
                await refreshAuthStatus();
                // Перенаправляем на дашборд
                navigate('/dashboard', { replace: true });
            } catch (error) {
                logger.error("❌ Ошибка при обновлении статуса аутентификации:", error);
                navigate('/login', { replace: true });
            }
        };

        handleCallback();
    }, [refreshAuthStatus, navigate]);

    // Возвращаем null чтобы ничего не отображать
    return null;
};

export default AuthCallbackPage;