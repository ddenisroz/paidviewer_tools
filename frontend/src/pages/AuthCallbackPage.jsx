import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import AuthLoader from '../components/AuthLoader';
import { toast } from 'sonner';

const AuthCallbackPage = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const [isProcessing, setIsProcessing] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const processAuth = async () => {
            try {
                const token = searchParams.get('token');
                const code = searchParams.get('code');
                const error = searchParams.get('error');

                if (error) {
                    throw new Error(`Ошибка авторизации: ${error}`);
                }

                // Если есть токен, сохраняем его и перенаправляем
                if (token) {
                    // Проверяем, не обрабатывали ли мы уже этот токен
                    const existingToken = localStorage.getItem('token');
                    if (existingToken === token) {
                        // Токен уже обработан, просто перенаправляем
                        navigate('/dashboard');
                        return;
                    }
                    
                    localStorage.setItem('token', token);
                    
                    // Проверяем, нужно ли закрыть popup
                    const closePopup = searchParams.get('close_popup');
                    
                    if (closePopup === 'true') {
                        // Если это popup, закрываем его и обновляем родительское окно
                        if (window.opener) {
                            // Отправляем сообщение родительскому окну
                            window.opener.postMessage({ type: 'AUTH_SUCCESS', token }, window.location.origin);
                            
                            // Небольшая задержка перед закрытием popup
                            await new Promise(resolve => setTimeout(resolve, 500));
                            
                            // Закрываем popup
                            window.close();
                        } else {
                            // Если не popup, перенаправляем как обычно
                            await new Promise(resolve => setTimeout(resolve, 1000));
                            navigate('/dashboard');
                        }
                    } else {
                        // Имитируем время обработки
                        await new Promise(resolve => setTimeout(resolve, 1000));
                        
                        // Перенаправляем на главную страницу
                        navigate('/dashboard');
                    }
                    return;
                }

                // Если есть код авторизации (старый способ)
                if (code) {
                    // Имитируем время обработки
                    await new Promise(resolve => setTimeout(resolve, 2000));
                    
                    // Перенаправляем на главную страницу
                    navigate('/dashboard');
                    return;
                }

                // Если нет ни токена, ни кода
                throw new Error('Токен авторизации не получен');
                
            } catch (err) {
                console.error('Auth callback error:', err);
                setError(err.message);
                setIsProcessing(false);
                
                // Через 3 секунды перенаправляем на главную
                setTimeout(() => {
                    navigate('/dashboard');
                }, 3000);
            }
        };

        processAuth();
    }, [searchParams, navigate]);

    if (error) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-red-900 via-red-800 to-pink-900 flex items-center justify-center">
                <div className="text-center space-y-6">
                    <div className="w-20 h-20 mx-auto mb-4">
                        <div className="w-full h-full bg-red-500/20 rounded-full flex items-center justify-center">
                            <svg className="w-10 h-10 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </div>
                    </div>
                    
                    <div className="space-y-2">
                        <h2 className="text-2xl font-bold text-white">
                            Ошибка авторизации
                        </h2>
                        <p className="text-white/70 text-lg">
                            {error}
                        </p>
                    </div>
                    
                    <div className="text-white/50 text-sm">
                        Перенаправляем на главную страницу...
                    </div>
                </div>
            </div>
        );
    }

    return <AuthLoader platform="Twitch" />;
};

export default AuthCallbackPage;