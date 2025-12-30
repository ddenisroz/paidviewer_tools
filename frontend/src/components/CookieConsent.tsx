import React, { useEffect, useState } from 'react';

const CookieConsent: React.FC = () => {
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
        <div className="fixed bottom-4 left-4 z-50 max-w-xs">
            <div className="relative bg-slate-900/95 backdrop-blur-sm border border-slate-700/50 rounded-xl p-3 shadow-2xl animate-in slide-in-from-left-4 duration-500">
                {/* Иконка печенья */}
                <div className="absolute -top-2 -right-2">
                    <div className="bg-amber-500/20 rounded-full px-2 py-1 flex items-center justify-center">
                        <span className="text-amber-400 text-xs whitespace-nowrap">COOKIE</span>
                    </div>
                </div>
                
                {/* Контент */}
                <div>
                    <p className="text-xs text-muted-foreground leading-relaxed mb-2 pr-10">
                        Сайт использует Cookies для передачи данных об авторизации на сервер.
                    </p>
                    
                    {/* Кнопка */}
                    <button
                        onClick={handleAccept}
                        className="w-full bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white text-xs font-medium py-2 px-3 rounded-lg transition-all duration-200 hover:shadow-lg"
                    >
                        Согласен, даже если данные окажутся в открытом доступе
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CookieConsent;

