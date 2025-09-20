import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import LoginPage from './pages/LoginPage';
import AuthCallbackPage from './pages/AuthCallbackPage';
import Layout from './components/Layout';
import HomePage from './pages/HomePage';
import TtsMainPage from './pages/tts/TtsMainPage';
import VoiceManagementPage from './pages/tts/VoiceManagementPage';
import SettingsPage from './pages/SettingsPage';
import AdminPage from './pages/AdminPage';
import AuthGuard from './components/AuthGuard'; // Импортируем нашего защитника
import { Toaster } from 'sonner';
import './App.css';
import MediaMainPage from './pages/media/MediaMainPage';
import ChannelPointsPage from './pages/media/ChannelPointsPage';
import YoutubeIntegrationPage from './pages/media/YoutubeIntegrationPage';
import CommandsPage from './pages/CommandsPage';
import AnalyticsPage from './pages/AnalyticsPage';
import ObsTtsPage from './pages/tts/ObsTtsPage';
import ViewersPage from './pages/ViewersPage';

function App() {
  const { loading, userMode } = useAuth();

  // Пока идет проверка аутентификации, ничего не рендерим (или показываем лоадер)
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <p>Загрузка приложения...</p>
      </div>
    );
  }

  return (
    <>
      <Toaster position="bottom-right" richColors />
      <Routes>
        {/* Главная страница редиректит в зависимости от статуса */}
        <Route path="/" element={
          userMode ? <Navigate to="/dashboard" replace /> : <Navigate to="/login" replace />
        } />
        
        {/* Публичные роуты */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/auth/callback" element={<AuthCallbackPage />} />
        <Route path="/tts-obs/:token" element={<ObsTtsPage />} />
        
        {/* Защищенные роуты, обернутые в AuthGuard */}
        <Route element={<AuthGuard />}>
          <Route path="/dashboard" element={<Layout />}>
            <Route index element={<HomePage />} />
            <Route path="tts" element={<TtsMainPage />} />
            <Route path="tts/voices" element={<VoiceManagementPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="media" element={<MediaMainPage />} />
            <Route path="media/channel-points" element={<ChannelPointsPage />} />
            <Route path="media/youtube" element={<YoutubeIntegrationPage />} />
            <Route path="commands" element={<CommandsPage />} />
            <Route path="analytics" element={<AnalyticsPage />} />
          </Route>
        </Route>

        {/* Секретная админка (можно тоже защитить дополнительно) */}
        <Route path="/dolbaeb-admin-secure-panel" element={<AdminPage />} />

        {/* Если ни один роут не подошел, редирект на главную */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}

export default App;
