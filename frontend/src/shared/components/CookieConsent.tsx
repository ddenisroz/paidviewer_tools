import React, { useEffect, useState } from 'react';

import { createPortal } from 'react-dom';

const COOKIE_STORAGE_KEY = 'AcceptCookies';

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

    return createPortal(
        <div className="pointer-events-none fixed bottom-4 right-4 z-[10010] w-[min(23rem,calc(100vw-2rem))]">
            <div className="pv-static-anchor-in pointer-events-auto flex items-center gap-3 rounded-lg border border-border/80 bg-[#0b0712] p-3 shadow-2xl shadow-black/55 ring-1 ring-white/10">
                <div className="min-w-0 flex-1">
                    <p className="brand-wordmark text-[11px] font-semibold uppercase text-amber-300">Cookies</p>
                    <p className="text-xs leading-snug text-muted-foreground">
                        Необходимы и используются для хранения и валидации активной сессии.
                    </p>
                </div>
                <button
                    onClick={handleAccept}
                    className="h-8 shrink-0 rounded-md border border-blue-600 bg-blue-700 px-3 text-xs font-semibold text-white transition-colors hover:border-blue-500 hover:bg-blue-800"
                >
                    Принять
                </button>
            </div>
        </div>,
        document.body
    );
};

export default CookieConsent;
