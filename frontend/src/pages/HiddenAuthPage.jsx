import React, { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';

const HiddenAuthPage = () => {
    const [searchParams] = useSearchParams();

    useEffect(() => {
        const token = searchParams.get('token');
        const error = searchParams.get('error');

        if (token) {
            // Не сохраняем токен в localStorage; полагаемся на httpOnly cookies, выставленные бэкендом
            // Отправляем сообщение родительскому окну
            if (window.opener) {
                window.opener.postMessage({
                    type: 'AUTH_SUCCESS',
                    token: token
                }, window.location.origin);
            }
            
            // Закрываем окно
            window.close();
        } else if (error) {
            // Отправляем ошибку родительскому окну
            if (window.opener) {
                window.opener.postMessage({
                    type: 'AUTH_ERROR',
                    message: error
                }, window.location.origin);
            }
            
            // Закрываем окно
            window.close();
        }
    }, [searchParams]);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Затемненный фон */}
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm"></div>
            
            {/* Модальное окно */}
            <div className="relative bg-card border border-border/40 rounded-lg p-8 max-w-md w-full mx-4 shadow-2xl">
                <div className="text-center space-y-6">
                    <div className="w-16 h-16 mx-auto mb-4">
                        <div className="w-full h-full bg-purple-500/20 rounded-full flex items-center justify-center animate-spin">
                            <div className="w-8 h-8 bg-purple-500 rounded-full"></div>
                        </div>
                    </div>
                    
                    <div className="space-y-2">
                        <h2 className="text-2xl font-bold text-foreground">
                            Завершение авторизации...
                        </h2>
                        <p className="text-muted-foreground">
                            Окно закроется автоматически
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default HiddenAuthPage;
