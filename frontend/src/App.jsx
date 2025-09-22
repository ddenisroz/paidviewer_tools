import { Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import { useAuth } from './context/AuthContext';
import websocketService from './services/websocket';
import { toast } from 'sonner';
import LoginPage from './pages/LoginPage';
import AuthCallbackPage from './pages/AuthCallbackPage';
import Layout from './components/Layout';
import HomePage from './pages/HomePage';
import TtsMainPage from './pages/tts/TtsMainPage';
import VoiceManagementPage from './pages/tts/VoiceManagementPage';
import SettingsPage from './pages/SettingsPage';
import AdminPage from './pages/AdminPage';
import SessionManagementPage from './pages/admin/SessionManagementPage';
import BlockedChannelsPage from './pages/admin/BlockedChannelsPage';
import AuthGuard from './components/AuthGuard'; // Импортируем нашего защитника
import './App.css';
import MediaMainPage from './pages/media/MediaMainPage';
import ChannelPointsPage from './pages/media/ChannelPointsPage';
import YoutubeIntegrationPage from './pages/media/YoutubeIntegrationPage';
import CommandsPage from './pages/CommandsPage';
import AnalyticsPage from './pages/AnalyticsPage';
import ObsTtsPage from './pages/tts/ObsTtsPage';
import ViewersPage from './pages/ViewersPage';
import { TtsProvider } from './context/TtsContext';
import { TtsHealthProvider } from './context/TtsHealthContext';
import { TtsCardProvider } from './context/TtsCardContext';
import { DataProvider } from './context/DataContext';
import { ToastProvider } from './components/ui/toast'; // Импортируем ToastProvider

function App() {
  const { loading, userMode, user } = useAuth();

  // Обработка WebSocket уведомлений
  useEffect(() => {
    const handleSessionConflict = (data) => {
      toast.warning(`⚠️ ${data.message}`, {
        duration: 10000,
        description: 'Кто-то пытается войти в ваш канал в гостевом режиме'
      });
    };

    // Подписываемся на уведомления о конфликтах сессий
    websocketService.on('session_conflict', handleSessionConflict);

    return () => {
      websocketService.off('session_conflict', handleSessionConflict);
    };
  }, []);

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
      <Routes>
        {/* Главная страница редиректит в зависимости от статуса */}
        <Route path="/" element={
          user ? <Navigate to="/dashboard" replace /> : <Navigate to="/login" replace />
        } />
        
        {/* Публичные роуты */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/auth/callback" element={<AuthCallbackPage />} />
        <Route path="/auth/vk/callback" element={<AuthCallbackPage />} />
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
            <Route path="chat-analysis" element={<AnalyticsPage />} />
            <Route path="commands" element={<CommandsPage />} />
          </Route>
        </Route>

        {/* Секретная админка (можно тоже защитить дополнительно) */}
        <Route path="/dolbaeb-admin-secure-panel" element={<AdminPage />} />
        <Route path="/dolbaeb-admin-secure-panel/sessions" element={<SessionManagementPage />} />
        <Route path="/dolbaeb-admin-secure-panel/blocked-channels" element={<BlockedChannelsPage />} />

        {/* Если ни один роут не подошел, редирект на главную */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}

export default App;
