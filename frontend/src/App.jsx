import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';

import AuthGuard from './components/AuthGuard';
import Layout from './components/Layout';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import GuestPage from './pages/GuestPage';
import AdminPage from './pages/AdminPage';
import SettingsPage from './pages/SettingsPage';
import TtsMainPage from './pages/tts/TtsMainPage';
import VoiceManagementPage from './pages/tts/VoiceManagementPage';
import MediaMainPage from './pages/media/MediaMainPage';
import ChannelPointsPage from './pages/media/ChannelPointsPage';
import YoutubeIntegrationPage from './pages/media/YoutubeIntegrationPage';
import GamblingPage from './pages/GamblingPage';
import AnalyticsPage from './pages/AnalyticsPage';
import CommandsPage from './pages/CommandsPage';
import AuthCallbackPage from './pages/AuthCallbackPage';
import ObsTtsPage from './pages/tts/ObsTtsPage';
import SessionManagementPage from './pages/admin/SessionManagementPage';
import BlockedChannelsPage from './pages/admin/BlockedChannelsPage';


function App() {
    return (
        <>
            <Toaster />
            <Routes>
                {/* Public Routes */}
                <Route path="/login" element={<LoginPage />} />
                <Route path="/guest" element={<GuestPage />} />
                <Route path="/auth/callback" element={<AuthCallbackPage />} />
                <Route path="/auth/vk/callback" element={<AuthCallbackPage />} />
                <Route path="/tts-obs/:token" element={<ObsTtsPage />} />

                {/* Protected Routes with Layout */}
                <Route path="/" element={<AuthGuard />}>
                    <Route element={<Layout />}>
                        <Route index element={<Navigate to="/dashboard" replace />} />
                        <Route path="dashboard" element={<HomePage />} />
                        <Route path="dashboard/tts" element={<TtsMainPage />} />
                        <Route path="dashboard/tts/voices" element={<VoiceManagementPage />} />
                        <Route path="dashboard/settings" element={<SettingsPage />} />
                        <Route path="dashboard/media" element={<MediaMainPage />} />
                        <Route path="dashboard/media/channel-points" element={<ChannelPointsPage />} />
                        <Route path="dashboard/media/youtube" element={<YoutubeIntegrationPage />} />
                        <Route path="dashboard/media/gambling" element={<GamblingPage />} />
                        <Route path="dashboard/chat-analysis" element={<AnalyticsPage />} />
                        <Route path="dashboard/commands" element={<CommandsPage />} />
                        <Route path="dashboard/admin" element={<AdminPage />} />
                        <Route path="dashboard/admin/sessions" element={<SessionManagementPage />} />
                        <Route path="dashboard/admin/blocked-channels" element={<BlockedChannelsPage />} />
                    </Route>
                </Route>
            </Routes>
        </>
    );
}

export default App;
