import React, { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';

import AuthGuard from './components/AuthGuard';
import Layout from './components/Layout';
import ErrorBoundary from './components/ErrorBoundary';
import { useCacheWebSocketSync } from './hooks/useCacheWebSocketSync';

// Убираем глобальный прелоадер

// Lazy loading для страниц
// Critical pages - загружаем сразу
import LoginPage from './pages/LoginPage';
import AuthCallbackPage from './pages/AuthCallbackPage';
import DonationAlertsCallback from './pages/DonationAlertsCallback';
import HomePage from './pages/HomePage';

// Non-critical pages - lazy loading
const GuestPage = lazy(() => import('./pages/GuestPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const TtsMainPage = lazy(() => import('./pages/tts/TtsMainPage'));
const VoiceManagementPage = lazy(() => import('./pages/tts/VoiceManagementPage'));
const LocalTTSSettingsPage = lazy(() => import('./pages/tts/LocalTTSSettingsPage'));
const PointsManagementPage = lazy(() => import('./pages/PointsManagementPage'));
const YoutubeIntegrationPage = lazy(() => import('./pages/media/YoutubeIntegrationPage'));
const AnalyticsPage = lazy(() => import('./pages/AnalyticsPage'));
const CommandsPage = lazy(() => import('./pages/CommandsPage'));
const ObsTtsPage = lazy(() => import('./pages/tts/ObsTtsPage'));
const ObsYoutubePage = lazy(() => import('./pages/tts/ObsYoutubePage'));
const ChatOverlay = lazy(() => import('./pages/ChatOverlay'));
const ChatWindow = lazy(() => import('./pages/ChatWindow'));
const AdminPage = lazy(() => import('./pages/admin/AdminPage'));
const UserManagementPage = lazy(() => import('./pages/admin/UserManagementPage'));
const BotManagementPage = lazy(() => import('./pages/admin/BotManagementPage'));
const MonitoringPage = lazy(() => import('./pages/admin/MonitoringPage'));
const BlockedChannelsPage = lazy(() => import('./pages/admin/BlockedChannelsPage'));
const SupportTicketsPage = lazy(() => import('./pages/admin/SupportTicketsPage'));
const DropsMainPage = lazy(() => import('./pages/drops/DropsMainPage'));
const DropsWidget = lazy(() => import('./pages/obs/DropsWidget'));
// Убираем DropsRewardsPage - бесполезная вкладка


function App() {
    // Инициализируем WebSocket синхронизацию кэша
    useCacheWebSocketSync();
    
    return (
        <>
            <Toaster 
                position="top-right"
                richColors
                expand={true}
                duration={4000}
                toastOptions={{
                    className: 'toast-notification',
                    style: {
                        background: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        color: 'hsl(var(--foreground))',
                    },
                    classNames: {
                        toast: 'toast-base',
                        title: 'toast-title',
                        description: 'toast-description',
                        success: 'toast-success',
                        error: 'toast-error',
                        warning: 'toast-warning',
                        info: 'toast-info',
                        actionButton: 'toast-action',
                        cancelButton: 'toast-cancel',
                        closeButton: 'toast-close',
                    },
                }}
            />
            <ErrorBoundary>
                <Suspense fallback={
                    <div style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: 'hsl(260, 30%, 8%)',
                        zIndex: 9999
                    }}>
                        {/* Minimal invisible loading - no spinner, just background */}
                    </div>
                }>
                    <Routes>
                        {/* Public Routes */}
                        <Route path="/login" element={<LoginPage />} />
                        <Route path="/guest" element={<GuestPage />} />
                        <Route path="/auth/callback" element={<AuthCallbackPage />} />
                        <Route path="/auth/vk/callback" element={<AuthCallbackPage />} />
                        <Route path="/donationalerts/callback" element={<DonationAlertsCallback />} />
                        <Route path="/tts-obs/:token" element={<ObsTtsPage />} />
                        <Route path="/youtube-obs/:token" element={<ObsYoutubePage />} />
                        <Route path="/drops-widget/:token" element={<DropsWidget />} />
                        <Route path="/chat-overlay" element={<ChatOverlay />} />
                        <Route path="/chat-window" element={<ChatWindow />} />

                        {/* Protected Routes with Layout */}
                        <Route path="/" element={<AuthGuard />}>
                            <Route element={<Layout />}>
                                <Route index element={<Navigate to="/dashboard" replace />} />
                                <Route path="dashboard" element={<HomePage />} />
                                <Route path="dashboard/tts" element={<TtsMainPage />} />
                                <Route path="dashboard/tts/voices" element={<VoiceManagementPage />} />
                                <Route path="dashboard/tts/local" element={<LocalTTSSettingsPage />} />
                                <Route path="dashboard/settings" element={<SettingsPage />} />
                                <Route path="dashboard/youtube" element={<YoutubeIntegrationPage />} />
                                <Route path="dashboard/points" element={<PointsManagementPage />} />
                                <Route path="dashboard/drops" element={<DropsMainPage />} />
                                <Route path="dashboard/chat-analysis" element={<AnalyticsPage />} />
                                <Route path="dashboard/commands" element={<CommandsPage />} />
                                
                                {/* Admin Routes */}
                                <Route path="dashboard/dolbaebadmintts" element={<AdminPage />} />
                                <Route path="dashboard/dolbaebadmintts/sessions" element={<AdminPage />} />
                                <Route path="dashboard/dolbaebadmintts/users" element={<AdminPage />} />
                                <Route path="dashboard/dolbaebadmintts/bots" element={<AdminPage />} />
                                <Route path="dashboard/dolbaebadmintts/monitoring" element={<AdminPage />} />
                                <Route path="dashboard/dolbaebadmintts/blocked-channels" element={<AdminPage />} />
                                <Route path="dashboard/dolbaebadmintts/support" element={<AdminPage />} />
                            </Route>
                        </Route>
                    </Routes>
                </Suspense>
            </ErrorBoundary>
        </>
    );
}

export default App;
