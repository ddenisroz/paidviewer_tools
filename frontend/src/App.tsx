import React, { lazy, Suspense } from 'react';

import { Navigate, Route, Routes } from 'react-router-dom';
import { Toaster } from 'sonner';

import AppErrorBoundary from './components/ErrorBoundary/AppErrorBoundary';
import RouteErrorBoundary from './components/ErrorBoundary/RouteErrorBoundary';
import Layout from './components/Layout';
import { ConnectionStatus } from './components/layout/ConnectionStatus';
import { AdminSkeleton, DashboardSkeleton, FormSkeleton, PageSkeleton } from './components/ui/PageSkeleton';
import { useCacheWebSocketSync } from './hooks/useCacheWebSocketSync';

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
const YoutubeIntegrationPage = lazy(() => import('./pages/media/YoutubeIntegrationPage'));
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
            {/* Task 6.5: Connection status indicator */}
            <ConnectionStatus />
            
            {/* Smart Toast Manager - bottom-right, не перекрывает контент */}
            <Toaster 
                position="bottom-right"
                richColors
                expand={false}
                visibleToasts={3}
                duration={2500}
                closeButton
                toastOptions={{
                    className: 'toast-notification',
                    style: {
                        background: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        color: 'hsl(var(--foreground))',
                        pointerEvents: 'auto',
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
                                <Suspense fallback={<PageSkeleton />}>
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
                                        <Suspense fallback={<DashboardSkeleton />}>
                                            <HomePage />
                                        </Suspense>
                                    </RouteErrorBoundary>
                                } />
                                
                                {/* TTS Routes */}
                                <Route path="dashboard/tts" element={
                                    <RouteErrorBoundary routeName="TTS">
                                        <Suspense fallback={<PageSkeleton />}>
                                            <TtsMainPage />
                                        </Suspense>
                                    </RouteErrorBoundary>
                                } />
                                <Route path="dashboard/tts/voices" element={
                                    <RouteErrorBoundary routeName="Voice Management">
                                        <Suspense fallback={<PageSkeleton />}>
                                            <VoiceManagementPage />
                                        </Suspense>
                                    </RouteErrorBoundary>
                                } />
                                <Route path="dashboard/tts/local" element={
                                    <RouteErrorBoundary routeName="Local TTS Settings">
                                        <Suspense fallback={<FormSkeleton />}>
                                            <LocalTTSSettingsPage />
                                        </Suspense>
                                    </RouteErrorBoundary>
                                } />
                                
                                {/* Settings */}
                                <Route path="dashboard/settings" element={
                                    <RouteErrorBoundary routeName="Settings">
                                        <Suspense fallback={<FormSkeleton />}>
                                            <SettingsPage />
                                        </Suspense>
                                    </RouteErrorBoundary>
                                } />
                                
                                {/* Media Routes */}
                                <Route path="dashboard/youtube" element={
                                    <RouteErrorBoundary routeName="YouTube">
                                        <Suspense fallback={<PageSkeleton />}>
                                            <YoutubeIntegrationPage />
                                        </Suspense>
                                    </RouteErrorBoundary>
                                } />
                                <Route path="dashboard/points" element={
                                    <RouteErrorBoundary routeName="Points">
                                        <Suspense fallback={<PageSkeleton />}>
                                            <PointsManagementPage />
                                        </Suspense>
                                    </RouteErrorBoundary>
                                } />
                                <Route path="dashboard/drops" element={
                                    <RouteErrorBoundary routeName="Drops">
                                        <Suspense fallback={<PageSkeleton />}>
                                            <DropsMainPage />
                                        </Suspense>
                                    </RouteErrorBoundary>
                                } />
                                
                                {/* Analytics & Commands */}
                                <Route path="dashboard/chat-analysis" element={
                                    <RouteErrorBoundary routeName="Analytics">
                                        <Suspense fallback={<PageSkeleton />}>
                                            <AnalyticsPage />
                                        </Suspense>
                                    </RouteErrorBoundary>
                                } />
                                <Route path="dashboard/commands" element={
                                    <RouteErrorBoundary routeName="Commands">
                                        <Suspense fallback={<PageSkeleton />}>
                                            <CommandsPage />
                                        </Suspense>
                                    </RouteErrorBoundary>
                                } />
                                
                                {/* Admin Routes */}
                                <Route path="dashboard/dolbaebadmintts" element={
                                    <RouteErrorBoundary routeName="Admin">
                                        <Suspense fallback={<AdminSkeleton />}>
                                            <AdminPage />
                                        </Suspense>
                                    </RouteErrorBoundary>
                                } />
                                <Route path="dashboard/dolbaebadmintts/sessions" element={
                                    <RouteErrorBoundary routeName="Admin Sessions">
                                        <Suspense fallback={<AdminSkeleton />}>
                                            <AdminPage />
                                        </Suspense>
                                    </RouteErrorBoundary>
                                } />
                                <Route path="dashboard/dolbaebadmintts/users" element={
                                    <RouteErrorBoundary routeName="Admin Users">
                                        <Suspense fallback={<AdminSkeleton />}>
                                            <AdminPage />
                                        </Suspense>
                                    </RouteErrorBoundary>
                                } />
                                <Route path="dashboard/dolbaebadmintts/bots" element={
                                    <RouteErrorBoundary routeName="Admin Bots">
                                        <Suspense fallback={<AdminSkeleton />}>
                                            <AdminPage />
                                        </Suspense>
                                    </RouteErrorBoundary>
                                } />
                                <Route path="dashboard/dolbaebadmintts/monitoring" element={
                                    <RouteErrorBoundary routeName="Admin Monitoring">
                                        <Suspense fallback={<AdminSkeleton />}>
                                            <AdminPage />
                                        </Suspense>
                                    </RouteErrorBoundary>
                                } />
                                <Route path="dashboard/dolbaebadmintts/blocked-channels" element={
                                    <RouteErrorBoundary routeName="Admin Blocked Channels">
                                        <Suspense fallback={<AdminSkeleton />}>
                                            <AdminPage />
                                        </Suspense>
                                    </RouteErrorBoundary>
                                } />
                                <Route path="dashboard/dolbaebadmintts/support" element={
                                    <RouteErrorBoundary routeName="Admin Support">
                                        <Suspense fallback={<AdminSkeleton />}>
                                            <AdminPage />
                                        </Suspense>
                                    </RouteErrorBoundary>
                                } />
                            </Route>
                        </Route>
                    </Routes>
            </AppErrorBoundary>
        </>
    );
}

export default App;

