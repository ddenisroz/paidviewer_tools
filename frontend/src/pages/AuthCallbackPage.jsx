import React, { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AuthLoader from '../components/AuthLoader';

const AuthCallbackPage = () => {
    const navigate = useNavigate();
    const { loginAndFetchUser } = useAuth();
    const [searchParams] = useSearchParams();

    // Определяем платформу по URL
    const isVkCallback = window.location.pathname.includes('/auth/vk/callback');
    const platform = isVkCallback ? 'VK Live' : 'Twitch';

    useEffect(() => {
        const token = searchParams.get('token');
        // 🔑 Токен из URL:', token);
        // 🔗 Платформа:', platform);

        const handleCallback = async () => {
            if (token) {
                // ✅ Токен найден, пытаемся авторизоваться...');
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
    }, [loginAndFetchUser, navigate, searchParams, platform]);

    return <AuthLoader platform={platform} />;
};

export default AuthCallbackPage;