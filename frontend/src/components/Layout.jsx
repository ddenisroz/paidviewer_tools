import { Outlet } from 'react-router-dom';
import Sidebar from './layout/Sidebar';
import Header from './layout/Header';
import CookieConsent from './CookieConsent';
import { TtsHealthProvider } from '../context/TtsHealthContext';
import { TtsCardProvider } from '../context/TtsCardContext';

const Layout = () => {
  return (
    <TtsHealthProvider>
      <TtsCardProvider>
        <div className="grid min-h-screen w-full md:grid-cols-[220px_1fr] lg:grid-cols-[280px_1fr]">
          <Sidebar />
          <div className="flex flex-col">
            <Header />
            <main className="flex flex-1 flex-col gap-4 p-4 lg:gap-6 lg:p-6 bg-muted/40">
                <div className="max-w-7xl w-full mx-auto">
                  <Outlet />
                </div>
            </main>
          </div>
          
          {/* Уведомление о cookies рендерим один раз здесь */}
          <CookieConsent />
        </div>
      </TtsCardProvider>
    </TtsHealthProvider>
  );
};

export default Layout;
