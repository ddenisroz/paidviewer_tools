import React, { lazy, Suspense, useContext } from 'react';

import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { Toaster } from 'sonner';

import { AuthContext } from '@/context/AuthContext';
import AppErrorBoundary from '@/shared/components/ErrorBoundary/AppErrorBoundary';
import RouteErrorBoundary from '@/shared/components/ErrorBoundary/RouteErrorBoundary';
import Layout from '@/shared/components/layout/Layout';
import { useCacheWebSocketSync } from '@/shared/hooks/useCacheWebSocketSync';

import AuthCallbackPage from './pages/AuthCallbackPage';
import DonationAlertsCallback from './pages/DonationAlertsCallback';
import LoginPage from './pages/LoginPage';
import MemeAlertsCallback from './pages/MemeAlertsCallback';
import MemeAlertsConnect from './pages/MemeAlertsConnect';
import AuthGuard from './shared/components/AuthGuard';

const MinimalFallback = () => <div className="min-h-screen" />;

const HomePage = lazy(() => import('./pages/HomePage'));
const SettingsPage = lazy(() => import('./pages/SettingsMainPage'));
const TtsMainPage = lazy(() => import('./features/tts/pages/TtsMainPage'));
const VoiceManagementPage = lazy(() => import('./features/tts/pages/VoiceManagementPage'));
const LocalTTSSettingsPage = lazy(() => import('./features/tts/pages/LocalTTSSettingsPage'));
const PointsManagementPage = lazy(() => import('./pages/PointsManagementPage'));

const MediaRequestsPage = lazy(() => import('./pages/media/MediaRequestsPage'));
const AnalyticsPage = lazy(() => import('./pages/AnalyticsPage'));

const CommandsPage = lazy(() => import('./pages/CommandsPage'));
const ObsTtsPage = lazy(() => import('./features/tts/pages/ObsTtsPage'));
const TtsObsDockPage = lazy(() => import('./features/tts/pages/TtsObsDockPage'));
const TtsPlayerPage = lazy(() => import('./features/tts/pages/TtsPlayerPage'));

const ChatOverlay = lazy(() => import('./pages/ChatOverlay'));
const ChatWindow = lazy(() => import('./pages/ChatWindow'));
const AdminPage = lazy(() => import('./features/admin/pages/AdminPage'));
const DropsMainPage = lazy(() => import('./features/drops/pages/DropsMainPage'));
const DropsWidget = lazy(() => import('./pages/obs/DropsWidget'));
const YoutubeObsOverlay = lazy(() => import('./pages/obs/YoutubeObsOverlay'));

const App: React.FC = () => {
    const authContext = useContext(AuthContext);
    const location = useLocation();
    const userId = authContext?.user?.id;
    const isRealtimeRoute =
        location.pathname.startsWith('/dashboard') ||
        location.pathname.startsWith('/chat-window') ||
        location.pathname.startsWith('/tts/player') ||
        location.pathname.startsWith('/tts-player');
    const shouldEnableCacheSync =
        Boolean(userId) && Boolean(authContext?.isAuthenticated) && !authContext?.isCheckingAuth && isRealtimeRoute;

    useCacheWebSocketSync(shouldEnableCacheSync ? userId : undefined);

    return (
        <>
            <AppErrorBoundary>
                <Routes>
                    <Route
                        path="/login"
                        element={
                            <RouteErrorBoundary routeName="Login">
                                <LoginPage />
                            </RouteErrorBoundary>
                        }
                    />
                    <Route
                        path="/auth/callback"
                        element={
                            <RouteErrorBoundary routeName="Auth Callback">
                                <AuthCallbackPage />
                            </RouteErrorBoundary>
                        }
                    />
                    <Route
                        path="/auth/vk/callback"
                        element={
                            <RouteErrorBoundary routeName="VK Auth Callback">
                                <AuthCallbackPage />
                            </RouteErrorBoundary>
                        }
                    />
                    <Route
                        path="/donationalerts/callback"
                        element={
                            <RouteErrorBoundary routeName="DonationAlerts Callback">
                                <DonationAlertsCallback />
                            </RouteErrorBoundary>
                        }
                    />
                    <Route
                        path="/memealerts/connect"
                        element={
                            <RouteErrorBoundary routeName="MemeAlerts Connect">
                                <MemeAlertsConnect />
                            </RouteErrorBoundary>
                        }
                    />
                    <Route
                        path="/memealerts/callback"
                        element={
                            <RouteErrorBoundary routeName="MemeAlerts Callback">
                                <MemeAlertsCallback />
                            </RouteErrorBoundary>
                        }
                    />

                    <Route
                        path="/tts-obs/:token"
                        element={
                            <RouteErrorBoundary routeName="TTS OBS Widget">
                                <Suspense fallback={<div className="min-h-screen bg-transparent" />}>
                                    <ObsTtsPage />
                                </Suspense>
                            </RouteErrorBoundary>
                        }
                    />

                    <Route
                        path="/drops-widget/:token"
                        element={
                            <RouteErrorBoundary routeName="Drops Widget">
                                <Suspense fallback={<div className="min-h-screen bg-transparent" />}>
                                    <DropsWidget />
                                </Suspense>
                            </RouteErrorBoundary>
                        }
                    />
                    <Route
                        path="/youtube-obs/:token"
                        element={
                            <RouteErrorBoundary routeName="YouTube OBS Overlay">
                                <Suspense fallback={<div className="min-h-screen bg-transparent" />}>
                                    <YoutubeObsOverlay />
                                </Suspense>
                            </RouteErrorBoundary>
                        }
                    />
                    <Route
                        path="/chat-overlay"
                        element={
                            <RouteErrorBoundary routeName="Chat Overlay">
                                <Suspense fallback={<div className="min-h-screen bg-transparent" />}>
                                    <ChatOverlay />
                                </Suspense>
                            </RouteErrorBoundary>
                        }
                    />
                    <Route
                        path="/chat-window"
                        element={
                            <RouteErrorBoundary routeName="Chat Window">
                                <Suspense fallback={<MinimalFallback />}>
                                    <ChatWindow />
                                </Suspense>
                            </RouteErrorBoundary>
                        }
                    />
                    <Route
                        path="/tts/obs-dock"
                        element={
                            <RouteErrorBoundary routeName="TTS OBS Dock">
                                <Suspense fallback={<MinimalFallback />}>
                                    <TtsObsDockPage />
                                </Suspense>
                            </RouteErrorBoundary>
                        }
                    />

                    <Route path="/" element={<AuthGuard />}>
                        <Route path="tts-player" element={<Navigate to="/tts/player" replace />} />
                        <Route
                            path="tts/player"
                            element={
                                <RouteErrorBoundary routeName="TTS Player">
                                    <Suspense fallback={<MinimalFallback />}>
                                        <TtsPlayerPage />
                                    </Suspense>
                                </RouteErrorBoundary>
                            }
                        />

                        <Route element={<Layout />}>
                            <Route index element={<Navigate to="/dashboard" replace />} />

                            <Route
                                path="dashboard"
                                element={
                                    <RouteErrorBoundary routeName="Dashboard">
                                        <Suspense fallback={<MinimalFallback />}>
                                            <HomePage />
                                        </Suspense>
                                    </RouteErrorBoundary>
                                }
                            />

                            <Route
                                path="dashboard/tts"
                                element={
                                    <RouteErrorBoundary routeName="TTS">
                                        <Suspense fallback={<MinimalFallback />}>
                                            <TtsMainPage />
                                        </Suspense>
                                    </RouteErrorBoundary>
                                }
                            />
                            <Route
                                path="dashboard/tts/voices"
                                element={
                                    <RouteErrorBoundary routeName="Voice Management">
                                        <Suspense fallback={<MinimalFallback />}>
                                            <VoiceManagementPage />
                                        </Suspense>
                                    </RouteErrorBoundary>
                                }
                            />
                            <Route
                                path="dashboard/tts/local"
                                element={
                                    <RouteErrorBoundary routeName="Local TTS Settings">
                                        <Suspense fallback={<MinimalFallback />}>
                                            <LocalTTSSettingsPage />
                                        </Suspense>
                                    </RouteErrorBoundary>
                                }
                            />

                            <Route
                                path="dashboard/settings"
                                element={
                                    <RouteErrorBoundary routeName="Settings">
                                        <Suspense fallback={<MinimalFallback />}>
                                            <SettingsPage />
                                        </Suspense>
                                    </RouteErrorBoundary>
                                }
                            />

                            <Route
                                path="dashboard/media"
                                element={
                                    <RouteErrorBoundary routeName="Media Requests">
                                        <Suspense fallback={<MinimalFallback />}>
                                            <MediaRequestsPage />
                                        </Suspense>
                                    </RouteErrorBoundary>
                                }
                            />
                            <Route
                                path="dashboard/points"
                                element={
                                    <RouteErrorBoundary routeName="Points">
                                        <Suspense fallback={<MinimalFallback />}>
                                            <PointsManagementPage />
                                        </Suspense>
                                    </RouteErrorBoundary>
                                }
                            />
                            <Route
                                path="dashboard/drops"
                                element={
                                    <RouteErrorBoundary routeName="Drops">
                                        <Suspense fallback={<MinimalFallback />}>
                                            <DropsMainPage />
                                        </Suspense>
                                    </RouteErrorBoundary>
                                }
                            />

                            <Route
                                path="dashboard/chat-analysis"
                                element={
                                    <RouteErrorBoundary routeName="Analytics">
                                        <Suspense fallback={<MinimalFallback />}>
                                            <AnalyticsPage />
                                        </Suspense>
                                    </RouteErrorBoundary>
                                }
                            />
                            <Route
                                path="dashboard/commands"
                                element={
                                    <RouteErrorBoundary routeName="Commands">
                                        <Suspense fallback={<MinimalFallback />}>
                                            <CommandsPage />
                                        </Suspense>
                                    </RouteErrorBoundary>
                                }
                            />

                            <Route
                                path="dashboard/admin/*"
                                element={
                                    <RouteErrorBoundary routeName="Admin">
                                        <Suspense fallback={<MinimalFallback />}>
                                            <AdminPage />
                                        </Suspense>
                                    </RouteErrorBoundary>
                                }
                            />
                        </Route>
                    </Route>
                </Routes>
            </AppErrorBoundary>

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
                    classNames: {
                        toast: 'group-[.toaster]:shadow-2xl',
                        description: 'group-[.toast]:text-muted-foreground',
                        actionButton: 'group-[.toast]:bg-primary group-[.toast]:text-primary-foreground',
                        cancelButton: 'group-[.toast]:bg-muted group-[.toast]:text-muted-foreground',
                    },
                }}
            />
        </>
    );
};

export default App;
