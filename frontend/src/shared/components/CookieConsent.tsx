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
        <div className="fixed bottom-4 right-4 z-50 max-w-xs">
            <div className="relative bg-popover/95 backdrop-blur-sm border border-border/70 rounded-xl p-3 shadow-2xl animate-in slide-in-from-left-4 duration-500">
                {/* Иконка печенья */}
                <div className="absolute -top-5 -right-2">
                    <div className="bg-amber-500/20 rounded-full px-2 py-1 flex items-center justify-center border border-amber-500/30">
                        <span className="text-amber-400 text-[10px] font-bold tracking-wider">COOKIE</span>
                    </div>
                </div>

                {/* Контент */}
                <div className="pr-2 pt-1">
                    <p className="text-xs text-muted-foreground leading-relaxed mb-3">
                        Сайт использует Cookies для передачи данных об авторизации на сервер.
                    </p>

                    {/* Кнопка */}
                    <button
                        onClick={handleAccept}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium py-2 px-3 rounded-lg transition-all duration-200 hover:shadow-lg"
                    >
                        Принять
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CookieConsent;

