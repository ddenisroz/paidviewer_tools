import React, { useEffect, useState } from 'react';

interface AuthLoaderProps {
    platform?: string;
    countdown?: number;
}

const AuthLoader: React.FC<AuthLoaderProps> = ({ platform = 'Twitch', countdown = 0 }) => {
    const [progress, setProgress] = useState(0);
    const [currentStep, setCurrentStep] = useState(0);

    const steps = [
        'Подготовка к авторизации...',
        'Загрузка компонентов...',
        'Установка соединения...',
        'Перенаправление...',
    ];

    useEffect(() => {
        const interval = setInterval(() => {
            setProgress((prev) => {
                if (prev >= 100) {
                    clearInterval(interval);
                    return 100;
                }
                return prev + 2;
            });
        }, 100);

        const stepInterval = setInterval(() => {
            setCurrentStep((prev) => {
                if (prev >= steps.length - 1) {
                    clearInterval(stepInterval);
                    return steps.length - 1;
                }
                return prev + 1;
            });
        }, 800);

        return () => {
            clearInterval(interval);
            clearInterval(stepInterval);
        };
    }, [steps.length]);
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Затемненный фон */}
            <div className="absolute inset-0 bg-black/85"></div>

            {/* Модальное окно */}
            <div className="relative bg-card border border-border/40 rounded-lg p-8 max-w-md w-full mx-4 shadow-2xl">
                <div className="text-center space-y-6">
                    {/* Анимированная иконка */}
                    <div className="relative w-24 h-24 mx-auto mb-6">
                        {/* Внешний статичный кружок */}
                        <div className="absolute inset-0 border-4 border-purple-200/20 rounded-full"></div>

                        {/* Основной вращающийся кружок */}
                        <div className="absolute inset-0 border-4 border-transparent border-t-purple-500 border-r-purple-400 rounded-full animate-spin-slow"></div>

                        {/* Внутренний кружок (обратное вращение) */}
                        <div className="absolute inset-3 border-2 border-transparent border-b-blue-500 border-l-blue-400 rounded-full animate-spin-reverse"></div>

                        {/* Центральная точка с пульсацией */}
                        <div className="absolute inset-0 flex items-center justify-center">
                            <div className="w-4 h-4 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full animate-pulse-glow shadow-lg shadow-purple-500/50"></div>
                        </div>

                        {/* Орбитальные точки */}
                        <div className="absolute inset-0 flex items-center justify-center">
                            <div className="relative w-16 h-16">
                                <div className="absolute top-0 left-1/2 w-2 h-2 bg-purple-400 rounded-full animate-orbit transform -translate-x-1/2"></div>
                                <div
                                    className="absolute bottom-0 left-1/2 w-2 h-2 bg-blue-400 rounded-full animate-orbit transform -translate-x-1/2"
                                    style={{ animationDelay: '1s' }}
                                ></div>
                            </div>
                        </div>

                        {/* Дополнительные пульсирующие точки */}
                        <div className="absolute -top-2 -right-2 w-3 h-3 bg-purple-400/60 rounded-full animate-ping"></div>
                        <div
                            className="absolute -bottom-2 -left-2 w-3 h-3 bg-blue-400/60 rounded-full animate-ping"
                            style={{ animationDelay: '0.7s' }}
                        ></div>
                        <div
                            className="absolute top-1/2 -right-3 w-2 h-2 bg-purple-300/80 rounded-full animate-ping"
                            style={{ animationDelay: '1.4s' }}
                        ></div>
                        <div
                            className="absolute top-1/2 -left-3 w-2 h-2 bg-blue-300/80 rounded-full animate-ping"
                            style={{ animationDelay: '2.1s' }}
                        ></div>
                    </div>

                    {/* Заголовок и описание */}
                    <div className="space-y-2">
                        <h2 className="text-2xl font-bold text-foreground">Авторизация {platform}</h2>
                        <p className="text-muted-foreground text-sm">
                            Перенаправляем вас на {platform} для безопасной авторизации
                        </p>
                    </div>

                    {/* Прогресс бар */}
                    <div className="space-y-3">
                        <div className="w-full h-3 bg-muted rounded-full overflow-hidden relative">
                            <div
                                className="h-3 bg-gradient-to-r from-purple-500 via-purple-400 to-blue-500 rounded-full transition-all duration-300 ease-out relative"
                                style={{ width: `${progress}%` }}
                            >
                                <div className="absolute inset-0 animate-progress-shimmer"></div>
                            </div>
                        </div>
                        <div className="flex justify-between items-center">
                            <p className="text-muted-foreground text-xs">{steps[currentStep]}</p>
                            <span className="text-muted-foreground text-xs font-medium">{progress}%</span>
                        </div>
                    </div>

                    {/* Счетчик */}
                    <div className="text-muted-foreground text-sm font-medium animate-pulse">
                        {countdown > 0 ? `Перенаправление через ${countdown} секунд...` : 'Перенаправление...'}
                    </div>

                    {/* Дополнительная информация */}
                    <div className="space-y-1 text-muted-foreground text-xs animate-fade-in">
                        <p className="opacity-80">• Откроется popup окно для авторизации</p>
                        <p className="opacity-80">• После успешной авторизации popup закроется автоматически</p>
                        <p className="opacity-80">• Если popup заблокирован, разрешите всплывающие окна</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AuthLoader;
