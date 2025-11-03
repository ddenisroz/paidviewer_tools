import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Shield, Users, Settings, Mic, MessageCircle, HardDrive, History, Zap, AlertTriangle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import VoiceManagement from '../../components/admin/VoiceManagement';
import UserManagementPage from './UserManagementPage';
import BotManagementPage from './BotManagementPage';
import SupportTicketsPage from './SupportTicketsPage';
import StorageManagementPage from './StorageManagementPage';
import SystemLogsPage from './SystemLogsPage';
import ErrorLogsPage from './ErrorLogsPage';

const AdminPage = () => {
    const navigate = useNavigate();
    const { user, isAuthenticated: isTwitchAuthenticated } = useAuth();
    
    const [activeTab, setActiveTab] = useState('voices');
    const [loadedTabs, setLoadedTabs] = useState({ voices: true }); // Загружаем первый таб сразу

    // Отслеживаем переключение табов для lazy loading
    useEffect(() => {
        if (!loadedTabs[activeTab]) {
            setLoadedTabs(prev => ({ ...prev, [activeTab]: true }));
        }
    }, [activeTab, loadedTabs]);

    // Проверяем права администратора
    if (!user?.is_admin) {
        return (
            <div className="min-h-screen p-4 flex items-center justify-center">
                <div className="text-center">
                    <h1 className="text-3xl font-bold text-white mb-4">Доступ запрещен</h1>
                    <p className="text-gray-300 mb-4">У вас нет прав для доступа к админ панели</p>
                    <Button onClick={() => navigate('/dashboard')} variant="outline" className="text-white border-gray-600">
                        Вернуться на главную
                    </Button>
                </div>
            </div>
        );
    }

    
    return (
        <div className="min-h-screen p-4">
            <div className="max-w-6xl mx-auto space-y-4 sm:space-y-6">
                       {/* Заголовок */}
                       <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                           <div>
                               <h1 className="text-2xl sm:text-3xl font-bold text-white flex items-center gap-2 sm:gap-3">
                                   <Shield className="h-8 w-8 text-purple-400" />
                                   <span className="hidden sm:inline">Админ панель</span>
                                   <span className="sm:hidden">Админка</span>
                               </h1>
                           </div>
                       </div>

                       {/* Табы */}
                       <div className="flex flex-wrap gap-1 bg-slate-800/50 p-1 rounded-lg">
                           <Button
                               variant={activeTab === 'voices' ? 'default' : 'ghost'}
                               onClick={() => setActiveTab('voices')}
                               className={`whitespace-nowrap flex-shrink-0 ${activeTab === 'voices' ? 'bg-purple-600' : 'text-slate-300 hover:text-white'}`}
                           >
                               <Mic className="h-4 w-4 mr-1 sm:mr-2" />
                               <span className="hidden sm:inline">Голоса</span>
                               <span className="sm:hidden">Голоса</span>
                           </Button>
                           <Button
                               variant={activeTab === 'users' ? 'default' : 'ghost'}
                               onClick={() => setActiveTab('users')}
                               className={`whitespace-nowrap flex-shrink-0 ${activeTab === 'users' ? 'bg-purple-600' : 'text-slate-300 hover:text-white'}`}
                           >
                               <Users className="h-4 w-4 mr-1 sm:mr-2" />
                               <span className="hidden sm:inline">Пользователи</span>
                               <span className="sm:hidden">Пользователи</span>
                           </Button>
                           <Button
                               variant={activeTab === 'bots' ? 'default' : 'ghost'}
                               onClick={() => setActiveTab('bots')}
                               className={`whitespace-nowrap flex-shrink-0 ${activeTab === 'bots' ? 'bg-purple-600' : 'text-slate-300 hover:text-white'}`}
                           >
                               <Settings className="h-4 w-4 mr-1 sm:mr-2" />
                               <span className="hidden sm:inline">Боты</span>
                               <span className="sm:hidden">Боты</span>
                           </Button>
                           <Button
                               variant={activeTab === 'tickets' ? 'default' : 'ghost'}
                               onClick={() => setActiveTab('tickets')}
                               className={`whitespace-nowrap flex-shrink-0 ${activeTab === 'tickets' ? 'bg-purple-600' : 'text-slate-300 hover:text-white'}`}
                           >
                               <MessageCircle className="h-4 w-4 mr-1 sm:mr-2" />
                               <span className="hidden sm:inline">Тикеты</span>
                               <span className="sm:hidden">Тикеты</span>
                           </Button>
                           <Button
                               variant={activeTab === 'storage' ? 'default' : 'ghost'}
                               onClick={() => setActiveTab('storage')}
                               className={`whitespace-nowrap flex-shrink-0 ${activeTab === 'storage' ? 'bg-purple-600' : 'text-slate-300 hover:text-white'}`}
                           >
                               <HardDrive className="h-4 w-4 mr-1 sm:mr-2" />
                               <span className="hidden sm:inline">Хранилище</span>
                               <span className="sm:hidden">Хранилище</span>
                           </Button>
                           <Button
                               variant={activeTab === 'logs' ? 'default' : 'ghost'}
                               onClick={() => setActiveTab('logs')}
                               className={`whitespace-nowrap flex-shrink-0 ${activeTab === 'logs' ? 'bg-purple-600' : 'text-slate-300 hover:text-white'}`}
                           >
                               <History className="h-4 w-4 mr-1 sm:mr-2" />
                               <span className="hidden sm:inline">Логи</span>
                               <span className="sm:hidden">Логи</span>
                           </Button>
                           <Button
                               variant={activeTab === 'error-logs' ? 'default' : 'ghost'}
                               onClick={() => setActiveTab('error-logs')}
                               className={`whitespace-nowrap flex-shrink-0 ${activeTab === 'error-logs' ? 'bg-purple-600' : 'text-slate-300 hover:text-white'}`}
                           >
                               <AlertTriangle className="h-4 w-4 mr-1 sm:mr-2" />
                               <span className="hidden sm:inline">Ошибки</span>
                               <span className="sm:hidden">Ошибки</span>
                           </Button>
                       </div>

                {/* Контент по табам - lazy loading + кеширование компонентов */}
                {loadedTabs.voices && (
                    <div style={{ display: activeTab === 'voices' ? 'block' : 'none' }}>
                        <VoiceManagement />
                    </div>
                )}
                {loadedTabs.users && (
                    <div style={{ display: activeTab === 'users' ? 'block' : 'none' }}>
                        <UserManagementPage />
                    </div>
                )}
                {loadedTabs.bots && (
                    <div style={{ display: activeTab === 'bots' ? 'block' : 'none' }}>
                        <BotManagementPage />
                    </div>
                )}
                {loadedTabs.tickets && (
                    <div style={{ display: activeTab === 'tickets' ? 'block' : 'none' }}>
                        <SupportTicketsPage />
                    </div>
                )}
                {loadedTabs.storage && (
                    <div style={{ display: activeTab === 'storage' ? 'block' : 'none' }}>
                        <StorageManagementPage />
                    </div>
                )}
                {loadedTabs.logs && (
                    <div style={{ display: activeTab === 'logs' ? 'block' : 'none' }}>
                        <SystemLogsPage />
                    </div>
                )}
                {loadedTabs['error-logs'] && (
                    <div style={{ display: activeTab === 'error-logs' ? 'block' : 'none' }}>
                        <ErrorLogsPage />
                    </div>
                )}
            </div>
        </div>
    );
};

export default AdminPage;
