import React, { useEffect, useState } from 'react';

const COOKIE_STORAGE_KEY = 'AcceptCookies';
const COOKIE_MESSAGE = 'Cookies нужны для входа, сохранения сессии и ваших настроек.';

const CookieConsent: React.FC = () => {
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        const hasAccepted = localStorage.getItem(COOKIE_STORAGE_KEY);
        if (!hasAccepted) {
            setIsVisible(true);
        }
    }, []);

    const handleAccept = (): void => {
        localStorage.setItem(COOKIE_STORAGE_KEY, 'true');
        setIsVisible(false);
    };

    if (!isVisible) {
        return null;
    }

    return (
        <div className="fixed bottom-4 right-4 z-50 w-[calc(100%-2rem)] max-w-xs">
            <div className="relative rounded-lg border border-border/70 bg-popover/95 p-3 shadow-2xl backdrop-blur-sm">
                <div className="absolute -right-2 -top-5">
                    <div className="flex items-center justify-center rounded-full border border-amber-500/30 bg-amber-500/20 px-2 py-1">
                        <span className="text-[10px] font-bold tracking-wider text-amber-400">Cookies</span>
                    </div>
                </div>

                <div className="pr-2 pt-1">
                    <p className="mb-3 text-xs leading-relaxed text-muted-foreground">
                        {COOKIE_MESSAGE}
                    </p>
                    <button
                        onClick={handleAccept}
                        className="w-full rounded-lg bg-blue-700 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-blue-800"
                    >
                        Принять
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CookieConsent;
