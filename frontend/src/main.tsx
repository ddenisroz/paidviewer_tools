/* eslint-disable import/order */
import React, { useEffect } from 'react';

import { QueryClientProvider } from '@tanstack/react-query';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, useLocation } from 'react-router-dom';

import { ToastProvider } from '@/shared/components/ui/toast';
import '@fontsource/chakra-petch/500.css';
import '@fontsource/chakra-petch/600.css';
import '@fontsource/chakra-petch/700.css';
import '@fontsource/geist-sans/400.css';
import '@fontsource/geist-sans/500.css';
import '@fontsource/geist-sans/600.css';
import '@fontsource/geist-sans/700.css';
import '@fontsource/rajdhani/500.css';
import '@fontsource/rajdhani/600.css';
import '@fontsource/rajdhani/700.css';
import '@fontsource/tektur/400.css';
import '@fontsource/tektur/500.css';
import '@fontsource/tektur/600.css';
import '@fontsource/tektur/700.css';
import App from './App';
import './App.css';
import './styles/design-system.css';
import './styles/toast-overrides.css';

// Initialize Sentry before React

// Lazy load non-critical providers для ускорения начальной загрузки
import { AuthProvider } from './context/AuthContext';
import { ChatProvider } from './context/ChatContext';
import { IntegrationsProvider } from './context/IntegrationsContext';
import { TtsPlayerProvider } from './context/TtsPlayerContext';
import { UserSettingsProvider } from './context/UserSettingsContext';
import { queryClient } from './lib/queryClient';
import { initSentry } from './lib/sentry';
import { composeProviders } from './shared/utils/composeProviders';
import { cleanupQueryCache } from './shared/utils/queryPersist';

initSentry();
cleanupQueryCache();

// [TARGET] Core провайдеры - только самые критичные для начального рендера
// Toast - обязательно сразу (для уведомлений)
// Auth - обязательно сразу (проверка авторизации)
// TtsPlayerProvider - нужен для ChatProvider
// Остальные - загружаются после первого рендера если нужно
const CoreProviders = composeProviders(
    ToastProvider,
    AuthProvider,
    IntegrationsProvider,
    TtsPlayerProvider,
    ChatProvider,
    UserSettingsProvider
);

const TtsDockProviders = composeProviders(ToastProvider, TtsPlayerProvider);

// Компонент-обёртка для условного рендера контекстов
interface ConditionalContextWrapperProps {
    children: React.ReactNode;
}

// eslint-disable-next-line react-refresh/only-export-components
const ConditionalContextWrapper: React.FC<ConditionalContextWrapperProps> = ({ children }) => {
    const location = useLocation();

    // Для overlay страниц (OBS виджеты) нужен только Toast
    const isOverlayRoute =
        location.pathname.startsWith('/chat-overlay') ||
        location.pathname.startsWith('/tts-obs') ||
        location.pathname.startsWith('/youtube-obs') ||
        location.pathname.startsWith('/drops-widget');

    useEffect(() => {
        document.documentElement.classList.toggle('pv-overlay-route', isOverlayRoute);
        document.body.classList.toggle('pv-overlay-route', isOverlayRoute);
        return () => {
            document.documentElement.classList.remove('pv-overlay-route');
            document.body.classList.remove('pv-overlay-route');
        };
    }, [isOverlayRoute]);

    if (location.pathname.startsWith('/tts/obs-dock')) {
        return <TtsDockProviders>{children}</TtsDockProviders>;
    }

    if (isOverlayRoute) {
        return <ToastProvider>{children}</ToastProvider>;
    }

    // Для основного приложения - только Core провайдеры
    // Остальные (TtsHealth, Player, DonationAlerts, etc.) теперь локальные
    // и находятся в Layout.jsx или на конкретных страницах
    return <CoreProviders>{children}</CoreProviders>;
};

// Убираем класс "загрузка" после монтирования
const rootElement = document.getElementById('root');
if (!rootElement) {
    throw new Error('Root element not found');
}

const root = ReactDOM.createRoot(rootElement);

const waitForAppFonts = async (): Promise<void> => {
    if (!document.fonts) {
        return;
    }

    const fontTasks = [
        document.fonts.load('400 1em "Tektur"'),
        document.fonts.load('700 1em "Tektur"'),
        document.fonts.ready,
    ];

    await Promise.race([
        Promise.all(fontTasks).then(() => undefined),
        new Promise<void>((resolve) => window.setTimeout(resolve, 2200)),
    ]);
};

const bootstrap = async () => {
    await waitForAppFonts();

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

    requestAnimationFrame(() => {
        document.body.classList.add('app-ready');
    });
};

void bootstrap();
