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

type TabType = 'voices' | 'users' | 'bots' | 'tickets' | 'storage' | 'logs' | 'errors' | 'monitoring' | 'blocked-channels';

interface LoadedTabs {
  [key: string]: boolean;
}

const AdminPage: React.FC = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    
    const [activeTab, setActiveTab] = useState<TabType>('voices');
    const [loadedTabs, setLoadedTabs] = useState<LoadedTabs>({ voices: true });

    useEffect(() => {
        if (!loadedTabs[activeTab]) {
            setLoadedTabs(prev => ({ ...prev, [activeTab]: true }));
        }
    }, [activeTab, loadedTabs]);

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
                        variant={activeTab === 'errors' ? 'default' : 'ghost'}
                        onClick={() => setActiveTab('errors')}
                        className={`whitespace-nowrap flex-shrink-0 ${activeTab === 'errors' ? 'bg-purple-600' : 'text-slate-300 hover:text-white'}`}
                    >
                        <AlertTriangle className="h-4 w-4 mr-1 sm:mr-2" />
                        <span className="hidden sm:inline">Ошибки</span>
                        <span className="sm:hidden">Ошибки</span>
                    </Button>
                    <Button
                        variant={activeTab === 'monitoring' ? 'default' : 'ghost'}
                        onClick={() => setActiveTab('monitoring')}
                        className={`whitespace-nowrap flex-shrink-0 ${activeTab === 'monitoring' ? 'bg-purple-600' : 'text-slate-300 hover:text-white'}`}
                    >
                        <Zap className="h-4 w-4 mr-1 sm:mr-2" />
                        <span className="hidden sm:inline">Мониторинг</span>
                        <span className="sm:hidden">Мониторинг</span>
                    </Button>
                    <Button
                        variant={activeTab === 'blocked-channels' ? 'default' : 'ghost'}
                        onClick={() => setActiveTab('blocked-channels')}
                        className={`whitespace-nowrap flex-shrink-0 ${activeTab === 'blocked-channels' ? 'bg-purple-600' : 'text-slate-300 hover:text-white'}`}
                    >
                        <Shield className="h-4 w-4 mr-1 sm:mr-2" />
                        <span className="hidden sm:inline">Заблокированные</span>
                        <span className="sm:hidden">Заблокированные</span>
                    </Button>
                </div>

                {loadedTabs[activeTab] && (
                    <>
                        {activeTab === 'voices' && <VoiceManagement />}
                        {activeTab === 'users' && <UserManagementPage />}
                        {activeTab === 'bots' && <BotManagementPage />}
                        {activeTab === 'tickets' && <SupportTicketsPage />}
                        {activeTab === 'storage' && <StorageManagementPage />}
                        {activeTab === 'logs' && <SystemLogsPage />}
                        {activeTab === 'errors' && <ErrorLogsPage />}
                        {activeTab === 'monitoring' && (
                            <div className="text-center py-8 text-gray-400">
                                <p>Мониторинг системы</p>
                            </div>
                        )}
                        {activeTab === 'blocked-channels' && (
                            <div className="text-center py-8 text-gray-400">
                                <p>Заблокированные каналы</p>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

export default AdminPage;

