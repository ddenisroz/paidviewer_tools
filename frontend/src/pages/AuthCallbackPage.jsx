import React, { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AuthLoader from '../components/AuthLoader';

const AuthCallbackPage = () => {
    const navigate = useNavigate();
    const { loginAndFetchUser } = useAuth();
    const [searchParams] = useSearchParams();

    useEffect(() => {
        const token = searchParams.get('token');
        console.log('🔑 Токен из URL:', token);

        const handleCallback = async () => {
            if (token) {
                console.log('✅ Токен найден, пытаемся авторизоваться...');
                await loginAndFetchUser(token);
                // После успешного получения пользователя, перенаправляем на дашборд.
                navigate('/dashboard', { replace: true });
            } else {
                // Если токена нет, возможно, произошла ошибка
                console.error("❌ Токен не найден в URL после авторизации");
                navigate('/login', { replace: true });
            }
        };

        handleCallback();
    }, [loginAndFetchUser, navigate, searchParams]);

    return <AuthLoader platform="Twitch" />;
};

export default AuthCallbackPage;