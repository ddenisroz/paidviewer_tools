import React, { lazy, Suspense } from 'react';

import { Navigate, Route, Routes } from 'react-router-dom';
import { Toaster } from 'sonner';

import AppErrorBoundary from '@/shared/components/ErrorBoundary/AppErrorBoundary';
import RouteErrorBoundary from '@/shared/components/ErrorBoundary/RouteErrorBoundary';
import { ConnectionStatus } from '@/shared/components/layout/ConnectionStatus';
import Layout from '@/shared/components/layout/Layout';
import { useCacheWebSocketSync } from '@/shared/hooks/useCacheWebSocketSync';

// Minimal loading - no skeletons, pages appear instantly
const MinimalFallback = () => <div className="min-h-screen" />;

// Critical pages - загружаем сразу (только auth flow)
import AuthCallbackPage from './pages/AuthCallbackPage';
import DonationAlertsCallback from './pages/DonationAlertsCallback';
import LoginPage from './pages/LoginPage';
import AuthGuard from './shared/components/AuthGuard';

// All other pages - lazy loading for better initial load performance
const HomePage = lazy(() => import('./pages/HomePage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const TtsMainPage = lazy(() => import('./features/tts/pages/TtsMainPage'));
const VoiceManagementPage = lazy(() => import('./features/tts/pages/VoiceManagementPage'));
const LocalTTSSettingsPage = lazy(() => import('./features/tts/pages/LocalTTSSettingsPage'));
const PointsManagementPage = lazy(() => import('./pages/PointsManagementPage'));

const MediaRequestsPage = lazy(() => import('./pages/media/MediaRequestsPage'));
const AnalyticsPage = lazy(() => import('./pages/AnalyticsPage'));

const CommandsPage = lazy(() => import('./pages/CommandsPage'));
const ObsTtsPage = lazy(() => import('./features/tts/pages/ObsTtsPage'));
const ObsYoutubePage = lazy(() => import('./features/tts/pages/ObsYoutubePage'));
const ChatOverlay = lazy(() => import('./pages/ChatOverlay'));
const ChatWindow = lazy(() => import('./pages/ChatWindow'));
const AdminPage = lazy(() => import('./features/admin/pages/AdminPage'));
const DropsMainPage = lazy(() => import('./features/drops/pages/DropsMainPage'));
const DropsWidget = lazy(() => import('./pages/obs/DropsWidget'));

const App: React.FC = () => {
    // Инициализируем WebSocket синхронизацию кэша
    useCacheWebSocketSync();

    return (
        <>
            {/* Task 6.5: Connection status indicator - Moved to bottom-left */}
            <ConnectionStatus />

            <AppErrorBoundary>
                <Routes>
                    {/* Public Routes */}
                    <Route path="/login" element={
                        <RouteErrorBoundary routeName="Login">
                            <LoginPage />
                        </RouteErrorBoundary>
                    } />
                    <Route path="/auth/callback" element={
                        <RouteErrorBoundary routeName="Auth Callback">
                            <AuthCallbackPage />
                        </RouteErrorBoundary>
                    } />
                    <Route path="/auth/vk/callback" element={
                        <RouteErrorBoundary routeName="VK Auth Callback">
                            <AuthCallbackPage />
                        </RouteErrorBoundary>
                    } />
                    <Route path="/donationalerts/callback" element={
                        <RouteErrorBoundary routeName="DonationAlerts Callback">
                            <DonationAlertsCallback />
                        </RouteErrorBoundary>
                    } />

                    {/* OBS Widgets - minimal loading */}
                    <Route path="/tts-obs/:token" element={
                        <RouteErrorBoundary routeName="TTS OBS Widget">
                            <Suspense fallback={<div className="min-h-screen bg-transparent" />}>
                                <ObsTtsPage />
                            </Suspense>
                        </RouteErrorBoundary>
                    } />
                    <Route path="/youtube-obs/:token" element={
                        <RouteErrorBoundary routeName="YouTube OBS Widget">
                            <Suspense fallback={<div className="min-h-screen bg-transparent" />}>
                                <ObsYoutubePage />
                            </Suspense>
                        </RouteErrorBoundary>
                    } />
                    <Route path="/drops-widget/:token" element={
                        <RouteErrorBoundary routeName="Drops Widget">
                            <Suspense fallback={<div className="min-h-screen bg-transparent" />}>
                                <DropsWidget />
                            </Suspense>
                        </RouteErrorBoundary>
                    } />
                    <Route path="/chat-overlay" element={
                        <RouteErrorBoundary routeName="Chat Overlay">
                            <Suspense fallback={<div className="min-h-screen bg-transparent" />}>
                                <ChatOverlay />
                            </Suspense>
                        </RouteErrorBoundary>
                    } />
                    <Route path="/chat-window" element={
                        <RouteErrorBoundary routeName="Chat Window">
                            <Suspense fallback={<MinimalFallback />}>
                                <ChatWindow />
                            </Suspense>
                        </RouteErrorBoundary>
                    } />

                    {/* Protected Routes with Layout */}
                    <Route path="/" element={<AuthGuard />}>
                        <Route element={<Layout />}>
                            <Route index element={<Navigate to="/dashboard" replace />} />

                            {/* Dashboard - main page */}
                            <Route path="dashboard" element={
                                <RouteErrorBoundary routeName="Dashboard">
                                    <Suspense fallback={<MinimalFallback />}>
                                        <HomePage />
                                    </Suspense>
                                </RouteErrorBoundary>
                            } />

                            {/* TTS Routes */}
                            <Route path="dashboard/tts" element={
                                <RouteErrorBoundary routeName="TTS">
                                    <Suspense fallback={<MinimalFallback />}>
                                        <TtsMainPage />
                                    </Suspense>
                                </RouteErrorBoundary>
                            } />
                            <Route path="dashboard/tts/voices" element={
                                <RouteErrorBoundary routeName="Voice Management">
                                    <Suspense fallback={<MinimalFallback />}>
                                        <VoiceManagementPage />
                                    </Suspense>
                                </RouteErrorBoundary>
                            } />
                            <Route path="dashboard/tts/local" element={
                                <RouteErrorBoundary routeName="Local TTS Settings">
                                    <Suspense fallback={<MinimalFallback />}>
                                        <LocalTTSSettingsPage />
                                    </Suspense>
                                </RouteErrorBoundary>
                            } />

                            {/* Settings */}
                            <Route path="dashboard/settings" element={
                                <RouteErrorBoundary routeName="Settings">
                                    <Suspense fallback={<MinimalFallback />}>
                                        <SettingsPage />
                                    </Suspense>
                                </RouteErrorBoundary>
                            } />

                            {/* Media Routes */}
                            <Route path="dashboard/media" element={
                                <RouteErrorBoundary routeName="Media Requests">
                                    <Suspense fallback={<MinimalFallback />}>
                                        <MediaRequestsPage />
                                    </Suspense>
                                </RouteErrorBoundary>
                            } />
                            <Route path="dashboard/points" element={
                                <RouteErrorBoundary routeName="Points">
                                    <Suspense fallback={<MinimalFallback />}>
                                        <PointsManagementPage />
                                    </Suspense>
                                </RouteErrorBoundary>
                            } />
                            <Route path="dashboard/drops" element={
                                <RouteErrorBoundary routeName="Drops">
                                    <Suspense fallback={<MinimalFallback />}>
                                        <DropsMainPage />
                                    </Suspense>
                                </RouteErrorBoundary>
                            } />

                            {/* Analytics & Commands */}
                            <Route path="dashboard/chat-analysis" element={
                                <RouteErrorBoundary routeName="Analytics">
                                    <Suspense fallback={<MinimalFallback />}>
                                        <AnalyticsPage />
                                    </Suspense>
                                </RouteErrorBoundary>
                            } />
                            <Route path="dashboard/commands" element={
                                <RouteErrorBoundary routeName="Commands">
                                    <Suspense fallback={<MinimalFallback />}>
                                        <CommandsPage />
                                    </Suspense>
                                </RouteErrorBoundary>
                            } />

                            {/* Admin Routes */}
                            <Route path="dashboard/dolbaebadmintts" element={
                                <RouteErrorBoundary routeName="Admin">
                                    <Suspense fallback={<MinimalFallback />}>
                                        <AdminPage />
                                    </Suspense>
                                </RouteErrorBoundary>
                            } />
                            <Route path="dashboard/dolbaebadmintts/sessions" element={
                                <RouteErrorBoundary routeName="Admin Sessions">
                                    <Suspense fallback={<MinimalFallback />}>
                                        <AdminPage />
                                    </Suspense>
                                </RouteErrorBoundary>
                            } />
                            <Route path="dashboard/dolbaebadmintts/users" element={
                                <RouteErrorBoundary routeName="Admin Users">
                                    <Suspense fallback={<MinimalFallback />}>
                                        <AdminPage />
                                    </Suspense>
                                </RouteErrorBoundary>
                            } />
                            <Route path="dashboard/dolbaebadmintts/bots" element={
                                <RouteErrorBoundary routeName="Admin Bots">
                                    <Suspense fallback={<MinimalFallback />}>
                                        <AdminPage />
                                    </Suspense>
                                </RouteErrorBoundary>
                            } />
                            <Route path="dashboard/dolbaebadmintts/monitoring" element={
                                <RouteErrorBoundary routeName="Admin Monitoring">
                                    <Suspense fallback={<MinimalFallback />}>
                                        <AdminPage />
                                    </Suspense>
                                </RouteErrorBoundary>
                            } />
                            <Route path="dashboard/dolbaebadmintts/blocked-channels" element={
                                <RouteErrorBoundary routeName="Admin Blocked Channels">
                                    <Suspense fallback={<MinimalFallback />}>
                                        <AdminPage />
                                    </Suspense>
                                </RouteErrorBoundary>
                            } />
                            <Route path="dashboard/dolbaebadmintts/support" element={
                                <RouteErrorBoundary routeName="Admin Support">
                                    <Suspense fallback={<MinimalFallback />}>
                                        <AdminPage />
                                    </Suspense>
                                </RouteErrorBoundary>
                            } />
                        </Route>
                    </Route>
                </Routes>
            </AppErrorBoundary>

            {/* Toast Manager - premium aesthetic at the end of DOM */}
            <Toaster
                position="bottom-right"
                expand={false}
                visibleToasts={3}
                duration={3000}
                closeButton
                theme="dark"
                richColors={false}
                toastOptions={{
                    className: 'group toast-group',
                    // Styles are now handled by toast-overrides.css
                    classNames: {
                        toast: 'group-[.toaster]:backdrop-blur-xl group-[.toaster]:shadow-2xl',
                        description: 'group-[.toast]:text-muted-foreground',
                        actionButton: 'group-[.toast]:bg-primary group-[.toast]:text-primary-foreground',
                        cancelButton: 'group-[.toast]:bg-muted group-[.toast]:text-muted-foreground',
                    },
                }}
            />
        </>
    );
}

export default App;
