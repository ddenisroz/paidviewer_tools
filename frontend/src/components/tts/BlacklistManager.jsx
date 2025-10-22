// src/components/tts/BlacklistManager.jsx
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { X, Plus, UserX, UserCheck, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import { botService } from '../../services/microservices';

const BlacklistManager = () => {
    const [blacklist, setBlacklist] = useState([]);
    const [newUsername, setNewUsername] = useState('');
    const [loading, setLoading] = useState(false);
    const [adding, setAdding] = useState(false);
    const [isExpanded, setIsExpanded] = useState(false);

    // Загрузка черного списка
    const loadBlacklist = async () => {
        try {
            setLoading(true);
            // Получаем список заблокированных пользователей для всех каналов
            const response = await botService.get('/api/tts/blocked-users');
            if (response.data.success) {
                // Извлекаем уникальные имена пользователей из всех каналов
                const allUsers = response.data.blocked_users || [];
                const uniqueUsers = [...new Set(allUsers.map(user => user.username))];
                setBlacklist(uniqueUsers);
            } else {
                setBlacklist([]);
            }
        } catch (error) {
            // Не показываем ошибку если TTS сервис недоступен
            if (error.code !== 'ERR_NETWORK' && error.code !== 'ERR_CONNECTION_REFUSED') {
                console.error('Error loading blacklist:', error);
                toast.error('Ошибка загрузки черного списка');
            }
            setBlacklist([]);
        } finally {
            setLoading(false);
        }
    };

    // Добавление пользователя в черный список
    const addToBlacklist = async () => {
        if (!newUsername.trim()) {
            toast.error('Введите имя пользователя');
            return;
        }

        try {
            setAdding(true);
            // Добавляем пользователя для всех каналов и платформ
            // TODO: Получать платформы и каналы из настроек пользователя
            const platforms = ['twitch', 'vk'];
            const channels = ['yourchy']; // Получаем из настроек пользователя
            
            let successCount = 0;
            for (const platform of platforms) {
                for (const channel of channels) {
                    try {
                        const response = await botService.post('/api/tts/block', {
                            channel_name: channel,
                            platform: platform,
                            username: newUsername.trim()
                        });
                        if (response.data.success) {
                            successCount++;
                        }
                    } catch (err) {
                        console.warn(`Failed to block user on ${platform}/${channel}:`, err);
                    }
                }
            }
            
            if (successCount > 0) {
                setBlacklist(prev => [...prev, newUsername.trim()]);
                setNewUsername('');
                toast.success(`Пользователь ${newUsername.trim()} добавлен в черный список`);
                loadBlacklist(); // Перезагружаем список
            } else {
                toast.error('Ошибка добавления в черный список');
            }
        } catch (error) {
            console.error('Error adding to blacklist:', error);
            // Не показываем ошибку если TTS сервис недоступен
            if (error.code !== 'ERR_NETWORK' && error.code !== 'ERR_CONNECTION_REFUSED') {
                toast.error('Ошибка добавления в черный список');
            }
        } finally {
            setAdding(false);
        }
    };

    // Удаление пользователя из черного списка
    const removeFromBlacklist = async (username) => {
        try {
            // Удаляем пользователя со всех каналов и платформ
            // TODO: Получать платформы и каналы из настроек пользователя
            const platforms = ['twitch', 'vk'];
            const channels = ['yourchy']; // Получаем из настроек пользователя
            
            let successCount = 0;
            for (const platform of platforms) {
                for (const channel of channels) {
                    try {
                        const response = await botService.post('/api/tts/unblock', {
                            channel_name: channel,
                            platform: platform,
                            username: username
                        });
                        if (response.data.success) {
                            successCount++;
                        }
                    } catch (err) {
                        console.warn(`Failed to unblock user on ${platform}/${channel}:`, err);
                    }
                }
            }
            
            if (successCount > 0) {
                setBlacklist(prev => prev.filter(user => user !== username));
                toast.success(`Пользователь ${username} удален из черного списка`);
                loadBlacklist(); // Перезагружаем список
            } else {
                toast.error('Ошибка удаления из черного списка');
            }
        } catch (error) {
            console.error('Error removing from blacklist:', error);
            // Не показываем ошибку если TTS сервис недоступен
            if (error.code !== 'ERR_NETWORK' && error.code !== 'ERR_CONNECTION_REFUSED') {
                toast.error('Ошибка удаления из черного списка');
            }
        }
    };

    // Загрузка при монтировании
    useEffect(() => {
        loadBlacklist();
    }, []);

    return (
        <Card className="mt-6">
            <CardHeader 
                className="cursor-pointer hover:bg-gray-800/50 transition-colors"
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                        <UserX className="h-5 w-5" />
                        Черный список пользователей
                    </CardTitle>
                    <ChevronDown 
                        className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} 
                    />
                </div>
            </CardHeader>
            {isExpanded && (
                <CardContent className="space-y-6">
                    {/* Добавление пользователя */}
                    <div className="flex flex-col sm:flex-row gap-3">
                        <Input
                            placeholder="Введите имя пользователя"
                            value={newUsername}
                            onChange={(e) => setNewUsername(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && addToBlacklist()}
                            disabled={adding}
                            className="flex-grow bg-gray-800/50 border-gray-700/50 text-white placeholder-gray-500"
                        />
                        <Button
                            onClick={addToBlacklist}
                            disabled={adding || !newUsername.trim()}
                            className="bg-red-600 hover:bg-red-700 text-white whitespace-nowrap"
                        >
                            <Plus className="h-4 w-4 mr-2" />
                            {adding ? 'Добавление...' : 'Добавить'}
                        </Button>
                    </div>

                    {/* Список пользователей */}
                    <div className="space-y-4">
                        <h4 className="text-sm font-medium text-gray-300">
                            Заблокированные пользователи ({blacklist.length})
                        </h4>
                        
                        {loading ? (
                            <div className="text-center py-4 text-gray-400">
                                Загрузка...
                            </div>
                        ) : blacklist.length === 0 ? (
                            <div className="text-center py-4 text-gray-400">
                                Черный список пуст
                            </div>
                        ) : (
                            <div className="space-y-2 max-h-60 overflow-y-auto">
                                {blacklist.map((username) => (
                                    <div
                                        key={username}
                                        className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg"
                                    >
                                        <div className="flex items-center gap-2">
                                            <UserX className="h-4 w-4 text-red-400" />
                                            <span className="font-medium">{username}</span>
                                        </div>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => removeFromBlacklist(username)}
                                            className="text-red-400 hover:text-red-300 hover:bg-red-900/20"
                                        >
                                            <X className="h-4 w-4" />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </CardContent>
            )}
        </Card>
    );
};

export default BlacklistManager;
