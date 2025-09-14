import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import LoginPage from './pages/LoginPage';
import AuthCallbackPage from './pages/AuthCallbackPage';
import HiddenAuthPage from './pages/HiddenAuthPage';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import HomePage from './pages/HomePage';
import TtsMainPage from './pages/tts/TtsMainPage';
import VoiceManagementPage from './pages/tts/VoiceManagementPage';
import CommandsManagementPage from './pages/tts/CommandsManagementPage';
import CommandsPage from './pages/CommandsPage';
import AnalyticsPage from './pages/AnalyticsPage';
import YoutubeIntegrationPage from './pages/media/YoutubeIntegrationPage';
import ChannelPointsPage from './pages/media/ChannelPointsPage';
import MediaMainPage from './pages/media/MediaMainPage';
import SettingsPage from './pages/SettingsPage';
import ViewersPage from './pages/ViewersPage';
import StreamTitlePage from './pages/StreamTitlePage';
import StreamCategoryPage from './pages/StreamCategoryPage';
import { Toaster } from 'sonner';
import './App.css';

function App() {
  const { isAuthenticated } = useAuth();

  return (
    <>
      <Toaster position="bottom-right" richColors />
      <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/login" element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <LoginPage />} />
        <Route path="/auth/callback" element={<AuthCallbackPage />} />
        <Route path="/auth/hidden" element={<HiddenAuthPage />} />
        <Route path="/commands" element={<CommandsPage />} />
        
        {/* Protected Dashboard Routes */}
        <Route element={<ProtectedRoute />}>
          <Route path="/dashboard" element={<Layout />}>
            <Route index element={<HomePage />} />
            <Route path="tts" element={<TtsMainPage />} />
            <Route path="tts/voices" element={<VoiceManagementPage />} />
            <Route path="commands" element={<CommandsManagementPage />} />
            <Route path="media" element={<MediaMainPage />} />
            <Route path="media/youtube" element={<YoutubeIntegrationPage />} />
            <Route path="media/channel-points" element={<ChannelPointsPage />} />
            <Route path="analytics" element={<AnalyticsPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="viewers" element={<ViewersPage />} />
            <Route path="stream-title" element={<StreamTitlePage />} />
            <Route path="stream-category" element={<StreamCategoryPage />} />
          </Route>
        </Route>
      </Routes>
    </>
  );
}

export default App;
