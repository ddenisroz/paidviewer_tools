import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AuthLoader from './AuthLoader';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';

const HiddenAuth = () => {
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [countdown, setCountdown] = useState(3);
    const [isAuthSuccess, setIsAuthSuccess] = useState(false);
    const [isNavigating, setIsNavigating] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const navigate = useNavigate();
    const { refreshUser } = useAuth();

    useEffect(() => {
        // Счетчик обратного отсчета
        const countdownInterval = setInterval(() => {
            setCountdown(prev => {
                if (prev <= 1) {
                    clearInterval(countdownInterval);
                    // Открываем popup окно для авторизации
                    const apiBaseUrl = import.meta.env.VITE_BOT_SERVICE_URL || 'http://localhost:8000';
                    const popup = window.open(
                        `${apiBaseUrl}/api/auth/twitch/login`,
                        'twitch_auth',
                        'width=600,height=700,scrollbars=yes,resizable=yes'
                    );
                    
                    // Слушаем сообщения от popup окна
                    const handleMessage = (event) => {
                        console.log('📨 Получено сообщение:', event.data, 'от origin:', event.origin);
                        
                        // Принимаем сообщения от localhost:8000 (бэкенд) или от текущего origin
                        const allowedOrigins = [
                            window.location.origin,
                            'http://localhost:8000',
                            'https://localhost:8000'
                        ];
                        
                        console.log('🔍 Проверка origin:', {
                            eventOrigin: event.origin,
                            allowedOrigins,
                            isAllowed: allowedOrigins.includes(event.origin)
                        });
                        
                        if (!allowedOrigins.includes(event.origin)) {
                            console.log('❌ Origin не разрешен:', event.origin);
                            return;
                        }
                        
                        if (event.data.type === 'twitch_auth_success' && !isNavigating && !isProcessing) {
                            console.log('🎉 Получены данные авторизации:', event.data);
                            console.log('📍 Origin события:', event.origin);
                            console.log('📍 Текущий origin:', window.location.origin);
                            
                            // Предотвращаем дублирование
                            setIsNavigating(true);
                            setIsProcessing(true);
                            
                            // Закрываем popup
                            if (popup && !popup.closed) {
                                popup.close();
                            }
                            // Убираем слушатель
                            window.removeEventListener('message', handleMessage);
                            clearInterval(checkClosed);
                            
                            // Дополнительная защита от дублирования
                            if (isAuthSuccess) {
                                console.log('⚠️ Авторизация уже обработана, игнорируем дубликат');
                                return;
                            }
                            
                            // Данные уже сохранены в куки на бэкенде
                            console.log('💾 Данные получены через postMessage (куки уже установлены):', {
                                token: event.data.token,
                                user: event.data.user
                            });
                            
                            // Устанавливаем флаг успешной авторизации
                            setIsAuthSuccess(true);
                            setIsLoading(false);
                            
                            console.log('🚀 Перенаправляем на /dashboard через 2 секунды...');
                            
                            // Перенаправляем с задержкой, чтобы куки успели установиться
                            setTimeout(async () => {
                                console.log('🔄 Обновляем данные пользователя...');
                                await refreshUser();
                                console.log('🔄 Выполняем навигацию на /dashboard');
                                navigate('/dashboard');
                            }, 1500); // Уменьшаем задержку
                        }
                    };
                    
                    // Убираем старый слушатель если есть
                    window.removeEventListener('message', handleMessage);
                    window.addEventListener('message', handleMessage);
                    
                    // Слушаем закрытие popup окна как fallback
                    const checkClosed = setInterval(() => {
                        if (popup?.closed) {
                            clearInterval(checkClosed);
                            window.removeEventListener('message', handleMessage);
                            
                            // Проверяем, авторизован ли пользователь через куки
                            // Попробуем получить данные пользователя
                            fetch('http://localhost:8000/api/auth/user/me', {
                                credentials: 'include'
                            })
                            .then(response => {
                                if (response.ok) {
                                    return response.json();
                                }
                                throw new Error('Не авторизован');
                            })
                            .then(userData => {
                                console.log('✅ Пользователь авторизован через куки:', userData);
                                
                            // Данные уже сохранены в куки на бэкенде
                            console.log('💾 Данные получены через куки (fallback):', { user: userData });
                                
                                setIsAuthSuccess(true);
                                setIsLoading(false);
                                setTimeout(() => {
                                    navigate('/dashboard');
                                }, 1500);
                            })
                            .catch(error => {
                                console.error('❌ Ошибка проверки авторизации:', error);
                                setError('Авторизация отменена');
                                setIsLoading(false);
                            });
                        }
                    }, 1000);
                    
                    // Дополнительная проверка через 30 секунд
                    setTimeout(() => {
                        if (popup && !popup.closed) {
                            popup.close();
                        }
                        clearInterval(checkClosed);
                        window.removeEventListener('message', handleMessage);
                        
                        // Проверяем, авторизован ли пользователь через куки
                        fetch('http://localhost:8000/api/auth/user/me', {
                            credentials: 'include'
                        })
                        .then(response => {
                            if (response.ok) {
                                return response.json();
                            }
                            throw new Error('Не авторизован');
                        })
                        .then(userData => {
                            console.log('✅ Пользователь авторизован через куки (timeout):', userData);
                            
                            // Данные уже сохранены в куки на бэкенде
                            console.log('💾 Данные получены через куки (timeout):', { user: userData });
                            
                            setIsAuthSuccess(true);
                            setIsLoading(false);
                            setTimeout(() => {
                                navigate('/dashboard');
                            }, 1500);
                        })
                        .catch(error => {
                            console.error('❌ Ошибка проверки авторизации (timeout):', error);
                            setError('Время ожидания истекло');
                            setIsLoading(false);
                        });
                    }, 30000);
                    
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(countdownInterval);
    }, [navigate]);

    // Автоматически закрываем окно через 1 секунду после успешной авторизации
    useEffect(() => {
        if (isAuthSuccess) {
            const timer = setTimeout(() => {
                navigate('/dashboard');
            }, 1000); // Сокращаем время до 1 секунды
            
            return () => clearTimeout(timer);
        }
    }, [isAuthSuccess, navigate]);

    if (isAuthSuccess) {
        return (
                    <div className="fixed inset-0 z-50 flex items-center justify-center">
                        {/* Затемненный фон */}
                        <div className="absolute inset-0 bg-black/80 backdrop-blur-sm"></div>
                        
                        {/* Модальное окно с успехом */}
                        <div className="relative bg-card border border-border/40 rounded-lg p-8 max-w-md w-full mx-4 shadow-2xl">
                            <div className="text-center space-y-6">
                                <div className="w-16 h-16 mx-auto">
                                    <div className="w-full h-full bg-green-500/20 rounded-full flex items-center justify-center animate-pulse">
                                        <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                        </svg>
                                    </div>
                                </div>
                                
                                <h2 className="text-2xl font-bold text-foreground">
                                    Готово!
                                </h2>
                                
                                <p className="text-sm text-muted-foreground">
                                    Перенаправляем на дашборд...
                                </p>
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
                        
                        <h2 className="text-2xl font-bold text-foreground">
                            Ошибка авторизации
                        </h2>
                        
                        <button
                            onClick={() => window.location.reload()}
                            className="px-6 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
                        >
                            Попробовать снова
                        </button>
                    </div>
                </div>
            </div>
        );
    }

            return (
                <div className="fixed inset-0 z-50 flex items-center justify-center">
                    {/* Затемненный фон */}
                    <div className="absolute inset-0 bg-black/80 backdrop-blur-sm"></div>
                    
                    {/* Модальное окно ожидания */}
                    <div className="relative bg-card border border-border/40 rounded-lg p-8 max-w-md w-full mx-4 shadow-2xl">
                        <div className="text-center space-y-6">
                            {/* Анимированное кольцо */}
                            <div className="w-20 h-20 mx-auto">
                                <div className="relative w-full h-full">
                                    {/* Пульсирующее кольцо */}
                                    <div className="absolute inset-0 rounded-full border-2 border-primary/30 auth-pulse"></div>
                                    {/* Внешнее кольцо */}
                                    <div className="absolute inset-0 rounded-full border-4 border-muted/20"></div>
                                    {/* Вращающееся кольцо с градиентом */}
                                    <div 
                                        className="absolute inset-0 rounded-full border-4 border-transparent auth-spinner"
                                        style={{
                                            borderTopColor: '#9146ff',
                                            borderRightColor: '#00d4ff',
                                            borderBottomColor: '#9146ff',
                                            borderLeftColor: 'transparent'
                                        }}
                                    ></div>
                                </div>
                            </div>
                            
                            {/* Текст */}
                            <div className="space-y-2">
                                <h2 className="text-xl font-semibold text-foreground">
                                    Ждём авторизацию
                                </h2>
                                <p className="text-sm text-muted-foreground">
                                    Откройте окно авторизации Twitch
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            );
};

export default HiddenAuth;
