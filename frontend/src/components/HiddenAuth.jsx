import React, { useEffect, useState } from 'react';
import { API_BASE_URL } from '../constants';
// import { useNavigate } from 'react-router-dom';
import AuthLoader from './AuthLoader';
// import { toast } from 'sonner';
// import { useAuth } from '../context/AuthContext';

const HiddenAuth = () => {
    const [isLoading, setIsLoading] = useState(false); // Убираем прелоадер
    const [error] = useState(null);
    const [countdown, setCountdown] = useState(3);
    const [isAuthSuccess] = useState(false);
    // const [isNavigating, setIsNavigating] = useState(false);
    // const [isProcessing, setIsProcessing] = useState(false);
    // const navigate = useNavigate();
    // const { refreshUser } = useAuth();

    useEffect(() => {
        // Счетчик обратного отсчета
        const countdownInterval = setInterval(() => {
            setCountdown(prev => {
                if (prev <= 1) {
                    clearInterval(countdownInterval);
                    // Получаем URL авторизации и открываем popup
                    const apiBaseUrl = API_BASE_URL;
                    
                    // Открываем popup напрямую с OAuth endpoint (без AJAX)
                    const popup = window.open(
                        `${apiBaseUrl}/auth/twitch/login`,
                        'twitch_auth',
                        'width=600,height=700,scrollbars=yes,resizable=yes'
                    );
                    
                    if (popup) {
                        // Слушаем сообщения от popup окна
                        const handleMessage = (event) => {
                            // 📨 Получено сообщение:', event.data, 'от origin:', event.origin);
                            
                            // Принимаем сообщения от разрешенных origins
                            const frontendUrl = import.meta.env.VITE_FRONTEND_URL;
                            if (!frontendUrl) {
                                throw new Error('VITE_FRONTEND_URL environment variable is required');
                            }
                            
                            const allowedOrigins = [
                                API_BASE_URL,
                                frontendUrl,
                                window.location.origin
                            ];
                            
                            if (!allowedOrigins.includes(event.origin)) {
                                // ❌ Сообщение от неразрешенного origin:', event.origin);
                                return;
                            }
                            
                            if (event.data.type === 'TWITCH_AUTH_SUCCESS') {
                                // ✅ Авторизация Twitch успешна!');
                                popup.close();
                                window.removeEventListener('message', handleMessage);
                                // Обновляем статус авторизации принудительно
                                window.dispatchEvent(new CustomEvent('auth_refresh_required'));
                                // Дополнительно перезагружаем страницу для гарантии
                                setTimeout(() => window.location.reload(), 1000);
                            } else if (event.data.type === 'TWITCH_AUTH_ERROR') {
                                console.error('❌ Ошибка авторизации Twitch:', event.data.error);
                                popup.close();
                                window.removeEventListener('message', handleMessage);
                            }
                        };
                        
                        window.addEventListener('message', handleMessage);
                        
                        // Проверяем, не закрыли ли popup
                        const checkClosed = setInterval(() => {
                            if (popup.closed) {
                                clearInterval(checkClosed);
                                window.removeEventListener('message', handleMessage);
                            }
                        }, 1000);
                    }
                    
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(countdownInterval);
    }, []);

    if (isLoading) {
        return <AuthLoader />;
    }

    if (error) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">
                <div className="text-center">
                    <h2 className="text-2xl font-bold text-red-400 mb-4">Ошибка авторизации</h2>
                    <p className="text-gray-300 mb-6">{error}</p>
                    <button
                        onClick={() => window.location.reload()}
                        className="px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                    >
                        Попробовать снова
                    </button>
                </div>
            </div>
        );
    }

    if (isAuthSuccess) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">
                <div className="text-center">
                    <h2 className="text-2xl font-bold text-green-400 mb-4">Авторизация успешна!</h2>
                    <p className="text-gray-300 mb-6">Перенаправление на главную страницу...</p>
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-400 mx-auto"></div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-900 text-white">
            <div className="text-center">
                <h2 className="text-2xl font-bold text-blue-400 mb-4">Авторизация через Twitch</h2>
                <p className="text-gray-300 mb-6">
                    {countdown > 0 ? `Открытие окна авторизации через ${countdown}...` : 'Открытие окна авторизации...'}
                </p>
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400 mx-auto"></div>
            </div>
        </div>
    );
};

export default HiddenAuth;