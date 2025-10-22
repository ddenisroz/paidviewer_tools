import React, { useState, useEffect } from 'react';

const CookieConsent = () => {
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        // Проверяем, есть ли уже согласие в localStorage
        const hasAccepted = localStorage.getItem('AcceptCookies');
        if (!hasAccepted) {
            setIsVisible(true);
        }
    }, []);

    const handleAccept = () => {
        // Сохраняем согласие в localStorage
        localStorage.setItem('AcceptCookies', 'true');
        setIsVisible(false);
    };

    if (!isVisible) return null;

    return (
        <div className="fixed bottom-4 left-4 z-50 max-w-sm">
            <div className="relative bg-slate-900/95 backdrop-blur-sm border border-slate-700/50 rounded-xl p-4 shadow-2xl animate-in slide-in-from-left-4 duration-500">
                {/* Иконка печенья (перемещена) */}
                <div className="absolute top-3 right-3">
                    <div className="w-8 h-8 bg-amber-500/20 rounded-full flex items-center justify-center">
                        <span className="text-amber-400 text-lg">🍪</span>
                    </div>
                </div>
                
                {/* Контент */}
                <div>
                    <h3 className="text-sm font-semibold text-foreground mb-2 pr-10">
                        Использование Cookies
                    </h3>
                    <p className="text-xs text-muted-foreground leading-relaxed mb-3 pr-10">
                        Сайт использует Cookies для передачи данных об авторизации и хранении токенов на сервере. 
                        Продолжая авторизацию, вы даете согласие на обработку ваших данных.
                    </p>
                    
                    {/* Кнопка */}
                    <button
                        onClick={handleAccept}
                        className="w-full bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white text-sm font-medium py-3 px-4 rounded-lg transition-all duration-200 hover:shadow-lg"
                    >
                        Согласен, даже если данные окажутся в открытом доступе
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CookieConsent;
