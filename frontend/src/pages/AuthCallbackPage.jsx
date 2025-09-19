import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AuthLoader from '../components/AuthLoader';

const AuthCallbackPage = () => {
    const navigate = useNavigate();
    const { fetchUser } = useAuth();

    useEffect(() => {
        // После редиректа с бэкенда, куки уже должны быть установлены.
        // Мы просто вызываем fetchUser, чтобы обновить состояние в AuthContext.
        const handleCallback = async () => {
            await fetchUser();
            // После успешного получения пользователя, перенаправляем на дашборд.
            navigate('/dashboard');
        };

        handleCallback();
    }, [fetchUser, navigate]);

    return <AuthLoader platform="Twitch" />;
};

export default AuthCallbackPage;