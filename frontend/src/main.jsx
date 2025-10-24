import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, useLocation } from 'react-router-dom'
import App from './App.jsx'
import './App.css'
import { AuthProvider } from './context/AuthContext.jsx'
import { DataProvider } from './context/DataContext.jsx'
import { IntegrationsProvider } from './context/IntegrationsContext.jsx';
import { ToastProvider } from './components/ui/toast.jsx'
import { TtsProvider } from './context/TtsContext.jsx'
import { TtsHealthProvider } from './context/TtsHealthContext.jsx'
import { TtsCardProvider } from './context/TtsCardContext.jsx'
import { ChatProvider } from './context/ChatContext.jsx'
import { PlayerProvider } from './context/PlayerContext.jsx'
import { DonationAlertsProvider } from './context/DonationAlertsContext.jsx'
import { UserSettingsProvider } from './context/UserSettingsContext.jsx'

// Компонент-обёртка для условного рендера контекстов
const ConditionalContextWrapper = ({ children }) => {
  const location = useLocation();
  
  // Для overlay страниц (OBS виджеты) не нужны тяжелые контексты
  const isOverlayRoute = 
    location.pathname.startsWith('/chat-overlay') ||
    location.pathname.startsWith('/tts-obs') ||
    location.pathname.startsWith('/youtube-obs') ||
    location.pathname.startsWith('/drops-widget');
  
  if (isOverlayRoute) {
    // Минимальные контексты для overlay (только Toast, без Auth/Chat/Integrations)
    return <ToastProvider>{children}</ToastProvider>;
  }
  
  // Полный стек контекстов для основного приложения
  return (
    <ToastProvider>
      <AuthProvider>
        <IntegrationsProvider>
          <TtsHealthProvider>
            <TtsCardProvider>
              <ChatProvider>
                <DataProvider>
                  <TtsProvider>
                    <PlayerProvider>
                      <DonationAlertsProvider>
                        <UserSettingsProvider>
                          {children}
                        </UserSettingsProvider>
                      </DonationAlertsProvider>
                    </PlayerProvider>
                  </TtsProvider>
                </DataProvider>
              </ChatProvider>
            </TtsCardProvider>
          </TtsHealthProvider>
        </IntegrationsProvider>
      </AuthProvider>
    </ToastProvider>
  );
};

ReactDOM.createRoot(document.getElementById('root')).render(
  // StrictMode отключен: создает двойные WebSocket подключения в dev режиме
  // <React.StrictMode>
    <BrowserRouter>
      <ConditionalContextWrapper>
        <App />
      </ConditionalContextWrapper>
    </BrowserRouter>
  // </React.StrictMode>
  ,
)
