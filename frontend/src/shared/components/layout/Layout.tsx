import { useEffect } from 'react';

import { Outlet, useLocation } from 'react-router-dom';

import { DataProvider } from '@/context/DataContext';
import { DonationAlertsProvider } from '@/context/DonationAlertsContext';
import { PlayerProvider, usePlayer } from '@/context/PlayerContext';
import { TtsProvider, useTts } from '@/context/TtsContext';
import { WidgetLayoutProvider } from '@/context/WidgetLayoutContext';
import CookieConsent from '@/shared/components/CookieConsent';
import GlobalPlayer from '@/shared/components/GlobalPlayer';
import Header from '@/shared/components/layout/Header';
import Sidebar from '@/shared/components/layout/Sidebar';
import { composeProviders } from '@/shared/utils/composeProviders';
// [PACKAGE] Layout-specific провайдеры
// Эти контексты нужны только внутри dashboard layout
// TtsPlayerProvider теперь в main.tsx (нужен для ChatProvider)
const LayoutProviders = composeProviders(
    TtsProvider,
    DataProvider,
    PlayerProvider,
    DonationAlertsProvider,
    WidgetLayoutProvider
);

// Внутренний компонент для использования usePlayer
const LayoutContent: React.FC = () => {
    const { isVisible, isTheaterMode } = usePlayer();
    const location = useLocation();
    const { toggleTts } = useTts(); // Use TTS context
    const currentPath = location.pathname;
    const currentSearch = location.search;
    const searchParams = new URLSearchParams(currentSearch);
    const activeTab = searchParams.get('tab');
    const isMediaYoutubeTab = currentPath.startsWith('/dashboard/media') && (!activeTab || activeTab === 'youtube');
    const isOnYoutubePage = currentPath.startsWith('/dashboard/youtube') || isMediaYoutubeTab;

    // Global Keyboard Shortcut for TTS (Shift+T)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Check for Shift+T, ignore if typing in inputs
            if (e.shiftKey && (e.key === 'T' || e.key === 't')) {
                const target = e.target as HTMLElement;
                if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
                    return;
                }

                e.preventDefault();
                toggleTts();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [toggleTts]);

    // Показываем отступ снизу только если плеер виден и не на странице YouTube
    const showPlayerPadding = isVisible && !isTheaterMode && !isOnYoutubePage;

    return (
        <div className="pv-dashboard-layout h-screen w-full overflow-hidden">
            <Sidebar />
            <div className="flex flex-col h-full overflow-hidden">
                <Header />
                <main
                    className={`pv-dashboard-main flex flex-1 flex-col bg-background/95 relative transition-all duration-300 overflow-y-auto ${
                        showPlayerPadding ? 'pb-24' : ''
                    }`}
                    style={{ scrollbarGutter: 'stable both-edges' }}
                >
                    <div className="max-w-7xl w-full mx-auto flex-1">
                        <Outlet />
                    </div>
                </main>
            </div>

            {/* Уведомление о cookies рендерим один раз здесь */}
            <CookieConsent />

            {/* Глобальный YouTube плеер (мини-плеер/портал) */}
            <GlobalPlayer />
        </div>
    );
};

const Layout: React.FC = () => {
    return (
        <LayoutProviders>
            <LayoutContent />
        </LayoutProviders>
    );
};

export default Layout;
