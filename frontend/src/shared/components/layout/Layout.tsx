import { Outlet } from 'react-router-dom';

import { DataProvider } from '@/context/DataContext';
import { DonationAlertsProvider } from '@/context/DonationAlertsContext';
import { PlayerProvider, usePlayer } from '@/context/PlayerContext';
import { TtsProvider } from '@/context/TtsContext';
import GlobalTtsPlayer from '@/features/tts/components/GlobalTtsPlayer';
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
  DonationAlertsProvider
);

// Внутренний компонент для использования usePlayer
const LayoutContent: React.FC = () => {
  const { isVisible, isTheaterMode } = usePlayer();
  const currentPath = window.location.pathname;
  const isOnYoutubePage = currentPath.includes('/dashboard/youtube');

  // Показываем отступ снизу только если плеер виден и не на странице YouTube
  const showPlayerPadding = isVisible && !isTheaterMode && !isOnYoutubePage;

  return (
    <div className="grid min-h-screen w-full grid-cols-1 md:grid-cols-[220px_1fr] lg:grid-cols-[280px_1fr]">
      <Sidebar />
      <div className="flex flex-col">
        <Header />
        <main
          className={`flex flex-1 flex-col gap-2 sm:gap-4 p-2 sm:p-4 lg:gap-6 lg:p-6 bg-muted/40 relative transition-all duration-300 ${showPlayerPadding ? 'pb-24' : ''
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

