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

// Убираем класс "загрузка" после монтирования
const root = ReactDOM.createRoot(document.getElementById('root'));

root.render(
  // StrictMode отключен: создает двойные WebSocket подключения в dev режиме
  // <React.StrictMode>
    <BrowserRouter>
      <ConditionalContextWrapper>
        <App />
      </ConditionalContextWrapper>
    </BrowserRouter>
  // </React.StrictMode>
);

// Font loading detection and body visibility control
(function() {
  let fontsLoaded = false;
  let reactLoaded = false;
  
  const showContent = () => {
    if (fontsLoaded && reactLoaded) {
      document.body.classList.add('fonts-loaded', 'loaded');
      // Trigger reflow to ensure CSS transition works
      requestAnimationFrame(() => {
        document.body.offsetHeight;
      });
    }
  };
  
  // Check if Inter font is actually loaded
  const checkInterFont = () => {
    if (document.fonts && document.fonts.check) {
      // Check if Inter font is loaded
      if (document.fonts.check('1em Inter')) {
        fontsLoaded = true;
        showContent();
        return true;
      }
    }
    return false;
  };
  
  // Check if fonts are available
  if (document.fonts && document.fonts.ready) {
    // Wait for fonts to load, then verify Inter specifically
    document.fonts.ready.then(() => {
      // Double-check Inter is loaded
      if (!checkInterFont()) {
        // If Inter not loaded yet, wait a bit more and check again
        setTimeout(() => {
          if (!checkInterFont()) {
            // Inter still not loaded, proceed anyway (safety fallback)
            fontsLoaded = true;
            showContent();
          }
        }, 200);
      }
    }).catch(() => {
      // If font loading fails, proceed anyway after timeout
      setTimeout(() => {
        fontsLoaded = true;
        showContent();
      }, 300);
    });
  } else {
    // Fallback: assume fonts are loaded after short delay
    setTimeout(() => {
      fontsLoaded = true;
      showContent();
    }, 250);
  }
  
  // Safety timeout: show content after max 800ms even if fonts aren't ready
  setTimeout(() => {
    if (!fontsLoaded) {
      fontsLoaded = true;
      showContent();
    }
  }, 800);
  
  // Mark React as loaded after mount
  setTimeout(() => {
    reactLoaded = true;
    showContent();
  }, 0);
})();
