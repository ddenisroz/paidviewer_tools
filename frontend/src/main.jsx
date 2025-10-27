import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, useLocation } from 'react-router-dom'
import App from './App.jsx'
import './App.css'
import { composeProviders } from './utils/composeProviders.jsx'
import { AuthProvider } from './context/AuthContext.jsx'
import { IntegrationsProvider } from './context/IntegrationsContext.jsx';
import { ToastProvider } from './components/ui/toast.jsx'
import { ChatProvider } from './context/ChatContext.jsx'
import { UserSettingsProvider } from './context/UserSettingsContext.jsx'

// 🎯 Core провайдеры - нужны везде в приложении
// Только самые критичные: Toast, Auth, Integrations, Chat, UserSettings
const CoreProviders = composeProviders(
  ToastProvider,
  AuthProvider,
  IntegrationsProvider,
  ChatProvider,
  UserSettingsProvider
);

// Компонент-обёртка для условного рендера контекстов
const ConditionalContextWrapper = ({ children }) => {
  const location = useLocation();
  
  // Для overlay страниц (OBS виджеты) нужен только Toast
  const isOverlayRoute = 
    location.pathname.startsWith('/chat-overlay') ||
    location.pathname.startsWith('/tts-obs') ||
    location.pathname.startsWith('/youtube-obs') ||
    location.pathname.startsWith('/drops-widget');
  
  if (isOverlayRoute) {
    return <ToastProvider>{children}</ToastProvider>;
  }
  
  // Для основного приложения - только Core провайдеры
  // Остальные (TtsHealth, Player, DonationAlerts, etc.) теперь локальные
  // и находятся в Layout.jsx или на конкретных страницах
  return <CoreProviders>{children}</CoreProviders>;
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
