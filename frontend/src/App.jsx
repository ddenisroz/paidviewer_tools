import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';

import AuthGuard from './components/AuthGuard';
import Layout from './components/Layout';
import { PlayerProvider } from './context/PlayerContext';
import { DonationAlertsProvider } from './context/DonationAlertsContext';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import GuestPage from './pages/GuestPage';
import AdminPage from './pages/AdminPage';
import SettingsPage from './pages/SettingsPage';
import TtsMainPage from './pages/tts/TtsMainPage';
import VoiceManagementPage from './pages/tts/VoiceManagementPage';
import MediaMainPage from './pages/media/MediaMainPage';
import PointsManagementPage from './pages/PointsManagementPage';
import YoutubeIntegrationPage from './pages/media/YoutubeIntegrationPage';
import YoutubeSettingsPage from './pages/media/YoutubeSettingsPage';
import GamblingPage from './pages/GamblingPage';
import AnalyticsPage from './pages/AnalyticsPage';
import CommandsPage from './pages/CommandsPage';
import AuthCallbackPage from './pages/AuthCallbackPage';
import ObsTtsPage from './pages/tts/ObsTtsPage';
import ObsYoutubePage from './pages/tts/ObsYoutubePage';
import SessionManagementPage from './pages/admin/SessionManagementPage';


function App() {
    return (
        <PlayerProvider>
            <DonationAlertsProvider>
                <Toaster />
                <Routes>
                {/* Public Routes */}
                <Route path="/login" element={<LoginPage />} />
                <Route path="/guest" element={<GuestPage />} />
                <Route path="/auth/callback" element={<AuthCallbackPage />} />
                <Route path="/auth/vk/callback" element={<AuthCallbackPage />} />
                <Route path="/tts-obs/:token" element={<ObsTtsPage />} />
                <Route path="/youtube-obs/:token" element={<ObsYoutubePage />} />

                {/* Protected Routes with Layout */}
                <Route path="/" element={<AuthGuard />}>
                    <Route element={<Layout />}>
                        <Route index element={<Navigate to="/dashboard" replace />} />
                        <Route path="dashboard" element={<HomePage />} />
                        <Route path="dashboard/tts" element={<TtsMainPage />} />
                        <Route path="dashboard/tts/voices" element={<VoiceManagementPage />} />
                        <Route path="dashboard/settings" element={<SettingsPage />} />
                        <Route path="dashboard/media" element={<MediaMainPage />} />
                        <Route path="dashboard/points" element={<PointsManagementPage />} />
                        <Route path="dashboard/media/youtube" element={<YoutubeIntegrationPage />} />
                        <Route path="youtube-settings" element={<YoutubeSettingsPage />} />
                        <Route path="dashboard/gambling" element={<GamblingPage />} />
                        <Route path="dashboard/chat-analysis" element={<AnalyticsPage />} />
                        <Route path="dashboard/commands" element={<CommandsPage />} />
                        <Route path="dashboard/dolbaebadmintts" element={<AdminPage />} />
                        <Route path="dashboard/dolbaebadmintts/sessions" element={<SessionManagementPage />} />
                    </Route>
                </Route>
            </Routes>
            </DonationAlertsProvider>
        </PlayerProvider>
    );
}

export default App;
