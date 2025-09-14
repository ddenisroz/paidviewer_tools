import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AuthLoader from './AuthLoader';
import { toast } from 'sonner';

const HiddenAuth = () => {
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [countdown, setCountdown] = useState(3);
    const [isAuthSuccess, setIsAuthSuccess] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        // Счетчик обратного отсчета
        const countdownInterval = setInterval(() => {
            setCountdown(prev => {
                if (prev <= 1) {
                    clearInterval(countdownInterval);
                    // Открываем popup окно для авторизации
                    const popup = window.open(
                        `${import.meta.env.VITE_API_BASE_URL}/api/auth/twitch/login`,
                        'twitch_auth',
                        'width=600,height=700,scrollbars=yes,resizable=yes'
                    );
                    
                    // Слушаем сообщения от popup окна
                    const handleMessage = (event) => {
                        if (event.origin !== window.location.origin) return;
                        
                        if (event.data.type === 'AUTH_SUCCESS') {
                            // Закрываем popup
                            if (popup && !popup.closed) {
                                popup.close();
                            }
                            // Убираем слушатель
                            window.removeEventListener('message', handleMessage);
                            clearInterval(checkClosed);
                            // Устанавливаем флаг успешной авторизации
                            setIsAuthSuccess(true);
                            setIsLoading(false);
                            
                            // Перенаправляем через небольшую задержку
                            setTimeout(() => {
                                navigate('/dashboard');
                            }, 1500);
                        }
                    };
                    
                    window.addEventListener('message', handleMessage);
                    
                    // Слушаем закрытие popup окна как fallback
                    const checkClosed = setInterval(() => {
                        if (popup?.closed) {
                            clearInterval(checkClosed);
                            window.removeEventListener('message', handleMessage);
                            // Проверяем, авторизован ли пользователь
                            const token = localStorage.getItem('token');
                            if (token) {
                                setIsAuthSuccess(true);
                                setIsLoading(false);
                                setTimeout(() => {
                                    navigate('/dashboard');
                                }, 1500);
                            } else {
                                setError('Авторизация отменена');
                                setIsLoading(false);
                            }
                        }
                    }, 1000);
                    
                    // Дополнительная проверка через 30 секунд
                    setTimeout(() => {
                        if (popup && !popup.closed) {
                            popup.close();
                        }
                        clearInterval(checkClosed);
                        window.removeEventListener('message', handleMessage);
                        const token = localStorage.getItem('token');
                        if (token) {
                            setIsAuthSuccess(true);
                            setIsLoading(false);
                            setTimeout(() => {
                                navigate('/dashboard');
                            }, 1500);
                        } else {
                            setError('Время ожидания истекло');
                            setIsLoading(false);
                        }
                    }, 30000);
                    
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(countdownInterval);
    }, [navigate]);

    if (isAuthSuccess) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center">
                {/* Затемненный фон */}
                <div className="absolute inset-0 bg-black/80 backdrop-blur-sm"></div>
                
                {/* Модальное окно с успехом */}
                <div className="relative bg-card border border-border/40 rounded-lg p-8 max-w-md w-full mx-4 shadow-2xl">
                    <div className="text-center space-y-6">
                        <div className="w-16 h-16 mx-auto mb-4">
                            <div className="w-full h-full bg-green-500/20 rounded-full flex items-center justify-center">
                                <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                            </div>
                        </div>
                        
                        <div className="space-y-2">
                            <h2 className="text-2xl font-bold text-foreground">
                                Авторизация успешна!
                            </h2>
                            <p className="text-muted-foreground">
                                Перенаправляем в дашборд...
                            </p>
                        </div>
                        
                        <div className="w-full h-2 bg-muted rounded-full">
                            <div className="h-2 bg-gradient-to-r from-green-500 to-blue-500 rounded-full animate-pulse"></div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center">
                {/* Затемненный фон */}
                <div className="absolute inset-0 bg-black/80 backdrop-blur-sm"></div>
                
                {/* Модальное окно с ошибкой */}
                <div className="relative bg-card border border-border/40 rounded-lg p-8 max-w-md w-full mx-4 shadow-2xl">
                    <div className="text-center space-y-6">
                        <div className="w-16 h-16 mx-auto mb-4">
                            <div className="w-full h-full bg-red-500/20 rounded-full flex items-center justify-center">
                                <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </div>
                        </div>
                        
                        <div className="space-y-2">
                            <h2 className="text-2xl font-bold text-foreground">
                                Ошибка авторизации
                            </h2>
                            <p className="text-muted-foreground">
                                {error}
                            </p>
                        </div>
                        
                        <button
                            onClick={() => navigate('/login')}
                            className="px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
                        >
                            Вернуться к входу
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return <AuthLoader platform="Twitch" countdown={countdown} />;
};

export default HiddenAuth;
