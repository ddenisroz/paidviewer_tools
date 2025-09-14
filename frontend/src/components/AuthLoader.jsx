import React, { useState, useEffect } from 'react';
import { Loader } from './ui/loader';

const AuthLoader = ({ platform = 'Twitch', countdown = 0 }) => {
    const [progress, setProgress] = useState(0);
    const [currentStep, setCurrentStep] = useState(0);
    
    const steps = [
        "Подготовка к авторизации...",
        "Загрузка компонентов...",
        "Установка соединения...",
        "Перенаправление..."
    ];
    
    useEffect(() => {
        const interval = setInterval(() => {
            setProgress(prev => {
                if (prev >= 100) {
                    clearInterval(interval);
                    return 100;
                }
                return prev + 2;
            });
        }, 100);
        
        const stepInterval = setInterval(() => {
            setCurrentStep(prev => {
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
    }, []);
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Затемненный фон */}
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm"></div>
            
            {/* Модальное окно */}
            <div className="relative bg-card border border-border/40 rounded-lg p-8 max-w-md w-full mx-4 shadow-2xl">
                <div className="text-center space-y-6">
                    {/* Анимированная иконка */}
                    <div className="relative">
                        <div className="w-16 h-16 mx-auto mb-4">
                            <Loader size="lg" />
                        </div>
                        <div className="absolute inset-0 flex items-center justify-center">
                            <div className="w-8 h-8 bg-purple-500/20 rounded-full animate-ping"></div>
                        </div>
                        <div className="absolute inset-0 flex items-center justify-center">
                            <div className="w-6 h-6 bg-purple-400/40 rounded-full animate-pulse"></div>
                        </div>
                        <div className="absolute inset-0 flex items-center justify-center">
                            <div className="w-3 h-3 bg-purple-300 rounded-full animate-bounce"></div>
                        </div>
                    </div>
                    
                    {/* Заголовок и описание */}
                    <div className="space-y-2">
                        <h2 className="text-2xl font-bold text-foreground">
                            Авторизация {platform}
                        </h2>
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
                            <p className="text-muted-foreground text-xs">
                                {steps[currentStep]}
                            </p>
                            <span className="text-muted-foreground text-xs font-medium">
                                {progress}%
                            </span>
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
