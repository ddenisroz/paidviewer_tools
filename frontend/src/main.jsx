import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, useLocation } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import App from './App.jsx'
import './App.css'
import './styles/design-system.css'

// Lazy load non-critical providers для ускорения начальной загрузки
import { composeProviders } from './utils/composeProviders.jsx'
import { ToastProvider } from './components/ui/toast.jsx'
import { AuthProvider } from './context/AuthContext.jsx'
import { IntegrationsProvider } from './context/IntegrationsContext.jsx';
import { ChatProvider } from './context/ChatContext.jsx'
import { UserSettingsProvider } from './context/UserSettingsContext.jsx'
import { queryClient } from './lib/queryClient.js'

// 🎯 Core провайдеры - только самые критичные для начального рендера
// Toast - обязательно сразу (для уведомлений)
// Auth - обязательно сразу (проверка авторизации)
// Остальные - загружаются после первого рендера если нужно
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

// Убираем класс "загрузка" после монтирования
const root = ReactDOM.createRoot(document.getElementById('root'));

root.render(
  // StrictMode отключен: создает двойные WebSocket подключения в dev режиме
  // <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ConditionalContextWrapper>
          <App />
        </ConditionalContextWrapper>
      </BrowserRouter>
    </QueryClientProvider>
  // </React.StrictMode>
);

// Font loading detection - prevent FOUT (Flash of Unstyled Text)
(function() {
  // Mark fonts as loaded immediately to prevent hiding content
  // With font-display: fallback, content is always visible with system font
  document.body.classList.add('fonts-loaded', 'loaded');
  
  // Force font load check to prevent layout shift
  if (document.fonts && document.fonts.check) {
    // Check if Inter font is loaded, if not it will use fallback seamlessly
    const fontLoaded = document.fonts.check('1em Inter');
    if (!fontLoaded && document.fonts.ready) {
      document.fonts.ready.then(() => {
        // Font loaded, ensure no layout shift
        document.body.classList.add('fonts-ready');
      });
    } else {
      document.body.classList.add('fonts-ready');
    }
  } else {
    document.body.classList.add('fonts-ready');
  }
})();
