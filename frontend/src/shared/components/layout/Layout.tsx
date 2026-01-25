import { useEffect } from 'react';

import { Outlet, useNavigate } from 'react-router-dom';

import { useAuth } from '@/context/AuthContext';
import { DataProvider } from '@/context/DataContext';
import { DonationAlertsProvider } from '@/context/DonationAlertsContext';
import { PlayerProvider, usePlayer } from '@/context/PlayerContext';
import { TtsProvider, useTts } from '@/context/TtsContext';
import GlobalTtsPlayer from '@/features/tts/components/GlobalTtsPlayer';
import { WidgetLayoutProvider } from '@/context/WidgetLayoutContext';
import CookieConsent from '@/shared/components/CookieConsent';
import GlobalPlayer from '@/shared/components/GlobalPlayer';
import Header from '@/shared/components/layout/Header';
import Sidebar from '@/shared/components/layout/Sidebar';
import { composeProviders } from '@/shared/utils/composeProviders';
// [PACKAGE] Layout-specific провайдеры
// Эти контексты нужны только внутри dashboard layout
// AudioPriorityProvider и TtsPlayerProvider теперь в main.tsx (нужны для ChatProvider)
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
  const { isAuthenticated, isCheckingAuth } = useAuth();
  const navigate = useNavigate();
  const { toggleTts, ttsEnabled } = useTts(); // Use TTS context
  const currentPath = window.location.pathname;
  const isOnYoutubePage = currentPath.includes('/dashboard/youtube');

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
    <div className="grid h-screen w-full grid-cols-1 md:grid-cols-[220px_1fr] lg:grid-cols-[280px_1fr] overflow-hidden">
      <Sidebar />
      <div className="flex flex-col h-full overflow-hidden">
        <Header />
        <main
          className={`flex flex-1 flex-col gap-2 sm:gap-4 p-2 sm:p-4 lg:gap-6 lg:p-6 bg-muted/40 relative transition-all duration-300 overflow-y-auto ${showPlayerPadding ? 'pb-24' : ''
            }`}
        >
          <div className="max-w-7xl w-full mx-auto flex-1">
            <Outlet />
          </div>
          {/* Глобальный плеер внутри main */}
          <GlobalPlayer />
        </main>
      </div>

      {/* Глобальный TTS плеер (фиксирован справа внизу) */}
      <GlobalTtsPlayer />

      {/* Уведомление о cookies рендерим один раз здесь */}
      <CookieConsent />
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

