import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Shield, Users, Settings, Mic, MessageCircle, BarChart3, Ban } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import VoiceManagement from '../../components/admin/VoiceManagement';
import UserManagementPage from './UserManagementPage';
import BotManagementPage from './BotManagementPage';
import MonitoringPage from './MonitoringPage';
import SupportTicketsPage from './SupportTicketsPage';
import BlockedChannelsPage from './BlockedChannelsPage';

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
                               className={`flex-1 ${activeTab === 'voices' ? 'bg-purple-600' : 'text-slate-300 hover:text-white'}`}
                           >
                               <Mic className="h-4 w-4 mr-1 sm:mr-2" />
                               <span className="hidden sm:inline">Голоса</span>
                               <span className="sm:hidden">Голоса</span>
                           </Button>
                           <Button
                               variant={activeTab === 'users' ? 'default' : 'ghost'}
                               onClick={() => setActiveTab('users')}
                               className={`flex-1 ${activeTab === 'users' ? 'bg-purple-600' : 'text-slate-300 hover:text-white'}`}
                           >
                               <Users className="h-4 w-4 mr-1 sm:mr-2" />
                               <span className="hidden sm:inline">Пользователи</span>
                               <span className="sm:hidden">Пользователи</span>
                           </Button>
                           <Button
                               variant={activeTab === 'bots' ? 'default' : 'ghost'}
                               onClick={() => setActiveTab('bots')}
                               className={`flex-1 ${activeTab === 'bots' ? 'bg-purple-600' : 'text-slate-300 hover:text-white'}`}
                           >
                               <Settings className="h-4 w-4 mr-1 sm:mr-2" />
                               <span className="hidden sm:inline">Боты</span>
                               <span className="sm:hidden">Боты</span>
                           </Button>
                           <Button
                               variant={activeTab === 'tickets' ? 'default' : 'ghost'}
                               onClick={() => setActiveTab('tickets')}
                               className={`flex-1 ${activeTab === 'tickets' ? 'bg-purple-600' : 'text-slate-300 hover:text-white'}`}
                           >
                               <MessageCircle className="h-4 w-4 mr-1 sm:mr-2" />
                               <span className="hidden sm:inline">Тикеты</span>
                               <span className="sm:hidden">Тикеты</span>
                           </Button>
                           <Button
                               variant={activeTab === 'monitoring' ? 'default' : 'ghost'}
                               onClick={() => setActiveTab('monitoring')}
                               className={`flex-1 ${activeTab === 'monitoring' ? 'bg-purple-600' : 'text-slate-300 hover:text-white'}`}
                           >
                               <BarChart3 className="h-4 w-4 mr-1 sm:mr-2" />
                               <span className="hidden sm:inline">Мониторинг</span>
                               <span className="sm:hidden">Мониторинг</span>
                           </Button>
                           <Button
                               variant={activeTab === 'blocked' ? 'default' : 'ghost'}
                               onClick={() => setActiveTab('blocked')}
                               className={`flex-1 ${activeTab === 'blocked' ? 'bg-purple-600' : 'text-slate-300 hover:text-white'}`}
                           >
                               <Ban className="h-4 w-4 mr-1 sm:mr-2" />
                               <span className="hidden sm:inline">Блокировки</span>
                               <span className="sm:hidden">Блокировки</span>
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
                {loadedTabs.monitoring && (
                    <div style={{ display: activeTab === 'monitoring' ? 'block' : 'none' }}>
                        <MonitoringPage />
                    </div>
                )}
                {loadedTabs.blocked && (
                    <div style={{ display: activeTab === 'blocked' ? 'block' : 'none' }}>
                        <BlockedChannelsPage />
                    </div>
                )}
            </div>
        </div>
    );
};

export default AdminPage;
