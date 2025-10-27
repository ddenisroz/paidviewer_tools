import { Outlet } from 'react-router-dom';
import Sidebar from './layout/Sidebar';
import Header from './layout/Header';
import CookieConsent from './CookieConsent';
import GlobalPlayer from './GlobalPlayer';
import { composeProviders } from '../utils/composeProviders';
import { TtsHealthProvider } from '../context/TtsHealthContext';
import { TtsCardProvider } from '../context/TtsCardContext';
import { TtsProvider } from '../context/TtsContext';
import { DataProvider } from '../context/DataContext';
import { PlayerProvider } from '../context/PlayerContext';
import { DonationAlertsProvider } from '../context/DonationAlertsContext';

// 📦 Layout-specific провайдеры
// Эти контексты нужны только внутри dashboard layout
const LayoutProviders = composeProviders(
  TtsHealthProvider,
  TtsCardProvider,
  TtsProvider,
  DataProvider,
  PlayerProvider,
  DonationAlertsProvider
);

const Layout = () => {
  return (
    <LayoutProviders>
      <div className="grid min-h-screen w-full grid-cols-1 md:grid-cols-[220px_1fr] lg:grid-cols-[280px_1fr]">
        <Sidebar />
        <div className="flex flex-col">
          <Header />
          <main className="flex flex-1 flex-col gap-2 sm:gap-4 p-2 sm:p-4 lg:gap-6 lg:p-6 bg-muted/40 relative">
              <div className="max-w-7xl w-full mx-auto flex-1">
                <Outlet />
              </div>
              {/* Глобальный плеер внутри main */}
              <GlobalPlayer />
          </main>
        </div>
        
        
        {/* Уведомление о cookies рендерим один раз здесь */}
        <CookieConsent />
      </div>
    </LayoutProviders>
  );
};

export default Layout;
