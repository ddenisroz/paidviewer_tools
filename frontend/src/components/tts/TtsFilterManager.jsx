// src/components/tts/TtsFilterManager.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { X, Plus, UserX, ChevronDown, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { botService } from '../../services/microservices';
import { useIntegrations } from '../../context/IntegrationsContext';
import { useAuth } from '../../context/AuthContext';
import { logger } from '../../utils/prodLogger';

const TtsFilterManager = React.memo(() => {
    // Общие состояния
    const [isExpanded, setIsExpanded] = useState(false);
    const { integrations } = useIntegrations();
    const { user } = useAuth();

    // Состояния для черного списка
    const [blacklist, setBlacklist] = useState([]);
    const [newUsername, setNewUsername] = useState('');
    const [addingUser, setAddingUser] = useState(false);
    const [loadingUsers, setLoadingUsers] = useState(false);
    const [selectedUserPlatform, setSelectedUserPlatform] = useState('twitch');

    // Состояния для словаря фильтра
    const [words, setWords] = useState([]);
    const [newWord, setNewWord] = useState('');
    const [addingWord, setAddingWord] = useState(false);
    const [loadingWords, setLoadingWords] = useState(false);
    const [selectedWordPlatform, setSelectedWordPlatform] = useState('all');

    // Функция переключения спойлера
    const toggleExpanded = useCallback(() => {
        setIsExpanded(prev => !prev);
    }, []);

    // Получаем доступные платформы из интеграций
    const getAvailablePlatforms = () => {
        const platforms = [];
        if (integrations?.twitch?.enabled) platforms.push('twitch');
        if (integrations?.vk?.enabled) platforms.push('vk');
        return platforms;
    };

    // Получаем имя канала для платформы
    const getChannelName = (platform) => {
        if (platform === 'twitch') return user?.twitch_username || '';
        if (platform === 'vk') return user?.vk_username || user?.vk_channel_name || '';
        return '';
    };

    // Получаем иконку для платформы
    const getPlatformIcon = (platform) => {
        if (platform === 'twitch') return '';
        if (platform === 'vk') return '';
        if (platform === 'all') return '';
        return '';
    };

    // Получение цвета для платформы
    const getPlatformColor = (platform) => {
        switch (platform) {
            case 'twitch': return 'bg-purple-600';
            case 'vk': return 'bg-blue-600';
            case 'all': return 'bg-gray-600';
            default: return 'bg-gray-600';
        }
    };

    // Получение лейбла для платформы
    const getPlatformLabel = (platform) => {
        switch (platform) {
            case 'twitch': return 'Twitch';
            case 'vk': return 'VK Live';
            case 'all': return 'Все';
            default: return 'Неизвестно';
        }
    };

    // ========== ЧЕРНЫЙ СПИСОК ==========

    // Загрузка черного списка
    const loadBlacklist = async () => {
        try {
            setLoadingUsers(true);
            const response = await botService.get('/api/tts/blocked-users');
            if (response.data.success) {
                const allUsers = response.data.blocked_users || [];
                setBlacklist(allUsers);
            } else {
                setBlacklist([]);
            }
        } catch (error) {
            logger.error('Error loading blacklist:', error);
            setBlacklist([]);
        } finally {
            setLoadingUsers(false);
        }
    };

    // Добавление пользователя в черный список
    const addToBlacklist = async () => {
        if (!newUsername.trim()) {
            toast.error('Введите имя пользователя');
            return;
        }

        if (!selectedUserPlatform) {
            toast.error('Выберите платформу');
            return;
        }

        try {
            setAddingUser(true);
            const channelName = getChannelName(selectedUserPlatform);
            
            if (!channelName) {
                toast.error(`Не удалось получить имя канала для платформы ${selectedUserPlatform}`);
                return;
            }

            const response = await botService.post('/api/tts/block', {
                channel_name: channelName,
                platform: selectedUserPlatform,
                username: newUsername.trim()
            });

            if (response.data.success) {
                toast.success(`Пользователь ${newUsername} заглушен на ${selectedUserPlatform === 'twitch' ? 'Twitch' : 'VK Live'}`);
                setNewUsername('');
                loadBlacklist();
            } else {
                toast.error(response.data.message || 'Ошибка при добавлении в черный список');
            }
        } catch (error) {
            logger.error('Error adding to blacklist:', error);
            toast.error('Ошибка при добавлении в черный список');
        } finally {
            setAddingUser(false);
        }
    };

    // Удаление пользователя из черного списка
    const removeFromBlacklist = async (blockedUser) => {
        if (!window.confirm(`Разблокировать пользователя ${blockedUser.username}?`)) {
            return;
        }

        try {
            const response = await botService.post('/api/tts/unblock', {
                channel_name: blockedUser.channel_name,
                platform: blockedUser.platform,
                username: blockedUser.username
            });

            if (response.data.success) {
                toast.success(`Пользователь ${blockedUser.username} разблокирован`);
                loadBlacklist();
            } else {
                toast.error('Ошибка удаления из черного списка');
            }
        } catch (error) {
            logger.error('Error removing from blacklist:', error);
            toast.error('Ошибка удаления из черного списка');
        }
    };

    // ========== СЛОВАРЬ ФИЛЬТРА ==========

    // Загрузка списка слов
    const loadWords = async () => {
        try {
            setLoadingWords(true);
            const response = await botService.get('/api/tts/filtered-words');
            if (response.data.success) {
                setWords(Array.isArray(response.data.words) ? response.data.words : []);
            } else {
                setWords([]);
            }
        } catch (error) {
            logger.error('Error loading words:', error);
            setWords([]);
        } finally {
            setLoadingWords(false);
        }
    };

    // Добавление слова
    const addWord = async () => {
        if (!newWord.trim()) {
            toast.error('Введите слово');
            return;
        }

        try {
            setAddingWord(true);
            const response = await botService.post('/api/tts/filtered-words', {
                word: newWord.trim(),
                platform: selectedWordPlatform
            });

            if (response.data.success) {
                setWords(prev => [...prev, response.data.word]);
                setNewWord('');
                toast.success('Слово добавлено');
            } else {
                toast.error(response.data.message || 'Ошибка добавления слова');
            }
        } catch (error) {
            logger.error('Error adding word:', error);
            toast.error('Ошибка добавления слова');
        } finally {
            setAddingWord(false);
        }
    };

    // Удаление слова
    const removeWord = async (wordId) => {
        try {
            const response = await botService.delete(`/api/tts/filtered-words/${wordId}`);
            if (response.data.success) {
                setWords(prev => prev.filter(w => w.id !== wordId));
                toast.success('Слово удалено');
            } else {
                toast.error('Ошибка удаления слова');
            }
        } catch (error) {
            logger.error('Error removing word:', error);
            toast.error('Ошибка удаления слова');
        }
    };

    // Загрузка данных при монтировании
    useEffect(() => {
        loadBlacklist();
        loadWords();
    }, []);

    const availablePlatforms = getAvailablePlatforms();

    return (
        <Card className="border-gray-700 bg-gray-900/50" data-testid="tts-filter-card">
            <CardHeader 
                className="cursor-pointer hover:bg-gray-800/30 transition-colors"
                onClick={toggleExpanded}
                data-testid="tts-filter-header"
            >
                <div className="flex items-center justify-between">
                    <CardTitle>
                        Фильтрация TTS
                    </CardTitle>
                    <ChevronDown 
                        className={`h-5 w-5 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} 
                    />
                </div>
            </CardHeader>
            {isExpanded && (
                <CardContent className="space-y-6 pt-4">
                    <Tabs defaultValue="blacklist" className="w-full">
                        <TabsList className="grid w-full grid-cols-2 bg-gray-800/50">
                            <TabsTrigger value="blacklist" className="data-[state=active]:bg-gray-700">
                                <UserX className="w-4 h-4 mr-2" />
                                Черный список
                            </TabsTrigger>
                            <TabsTrigger value="words" className="data-[state=active]:bg-gray-700">
                                <AlertCircle className="w-4 h-4 mr-2" />
                                Запрещенные слова
                            </TabsTrigger>
                        </TabsList>

                        {/* ========== ВКЛАДКА: ЧЕРНЫЙ СПИСОК ========== */}
                        <TabsContent value="blacklist" className="space-y-4">
                            {/* Форма добавления пользователя */}
                            <div className="space-y-3">
                                <div className="flex flex-col sm:flex-row gap-3">
                                    <Input
                                        placeholder="Введите имя пользователя"
                                        value={newUsername}
                                        onChange={(e) => setNewUsername(e.target.value)}
                                        onKeyPress={(e) => e.key === 'Enter' && addToBlacklist()}
                                        disabled={addingUser || availablePlatforms.length === 0}
                                        className="flex-grow bg-gray-800/50 border-gray-700/50 text-white placeholder-gray-500"
                                    />
                                    {availablePlatforms.length > 0 && (
                                        <Select value={selectedUserPlatform} onValueChange={setSelectedUserPlatform}>
                                            <SelectTrigger className="w-full sm:w-[140px] bg-gray-800/50 border-gray-700/50 text-white">
                                                <SelectValue placeholder="Платформа" />
                                            </SelectTrigger>
                                            <SelectContent className="bg-gray-800 border-gray-700 text-white">
                                                {availablePlatforms.map(platform => (
                                                    <SelectItem key={platform} value={platform}>
                                                        {getPlatformIcon(platform)} {platform === 'twitch' ? 'Twitch' : 'VK Live'}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    )}
                                    <Button
                                        onClick={addToBlacklist}
                                        disabled={addingUser || !newUsername.trim() || !selectedUserPlatform}
                                        className="bg-red-600 hover:bg-red-700 text-white whitespace-nowrap"
                                    >
                                        <Plus className="h-4 w-4 mr-2" />
                                        {addingUser ? 'Добавление...' : 'Заглушить'}
                                    </Button>
                                </div>
                                
                                {availablePlatforms.length === 0 && (
                                    <p className="text-sm text-gray-400">
                                        Подключите хотя бы одну платформу (Twitch или VK Live) чтобы заглушать пользователей
                                    </p>
                                )}
                            </div>

                            {/* Список заглушенных пользователей */}
                            <div className="space-y-4">
                                <Label>Заглушенные пользователи ({blacklist.length})</Label>
                                {loadingUsers ? (
                                    <div className="text-center py-4 text-gray-400">Загрузка...</div>
                                ) : blacklist.length === 0 ? (
                                    <div className="text-center py-4 text-gray-400">Список пуст</div>
                                ) : (
                                    <div className="space-y-2 max-h-60 overflow-y-auto">
                                        {blacklist.map((blockedUser, index) => (
                                            <div
                                                key={`${blockedUser.username}-${blockedUser.platform}-${index}`}
                                                className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <span className="font-medium">{blockedUser.username}</span>
                                                    <Badge className={`${getPlatformColor(blockedUser.platform)} text-white`}>
                                                        {getPlatformLabel(blockedUser.platform)}
                                                    </Badge>
                                                </div>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => removeFromBlacklist(blockedUser)}
                                                    className="text-red-400 hover:text-red-300 hover:bg-red-900/20"
                                                >
                                                    <X className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </TabsContent>

                        {/* ========== ВКЛАДКА: ЗАПРЕЩЕННЫЕ СЛОВА ========== */}
                        <TabsContent value="words" className="space-y-4">
                            {/* Форма добавления слова */}
                            <div className="space-y-3">
                                <div className="flex flex-col sm:flex-row gap-3">
                                    <Input
                                        placeholder="Введите слово для фильтрации..."
                                        value={newWord}
                                        onChange={(e) => setNewWord(e.target.value)}
                                        onKeyPress={(e) => e.key === 'Enter' && addWord()}
                                        disabled={addingWord}
                                        className="flex-grow bg-gray-800/50 border-gray-700/50 text-white placeholder-gray-500"
                                    />
                                    {availablePlatforms.length > 0 && (
                                        <Select value={selectedWordPlatform} onValueChange={setSelectedWordPlatform}>
                                            <SelectTrigger className="w-full sm:w-[180px] bg-gray-800/50 border-gray-700/50 text-white">
                                                <SelectValue placeholder="Платформа" />
                                            </SelectTrigger>
                                            <SelectContent className="bg-gray-800 border-gray-700 text-white">
                                                <SelectItem value="all">{getPlatformIcon('all')} Все платформы</SelectItem>
                                                {availablePlatforms.map(platform => (
                                                    <SelectItem key={platform} value={platform}>
                                                        {getPlatformIcon(platform)} {platform === 'twitch' ? 'Twitch' : 'VK Live'}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    )}
                                    <Button 
                                        onClick={addWord} 
                                        disabled={addingWord || !newWord.trim()}
                                        className="bg-blue-600 hover:bg-blue-700 text-white whitespace-nowrap"
                                    >
                                        <Plus className="h-4 w-4 mr-2" />
                                        {addingWord ? 'Добавление...' : 'Добавить'}
                                    </Button>
                                </div>
                                
                                {availablePlatforms.length === 0 && (
                                    <p className="text-sm text-gray-400">
                                        Подключите хотя бы одну платформу (Twitch или VK Live) чтобы фильтровать слова
                                    </p>
                                )}
                            </div>

                            {/* Список запрещенных слов */}
                            <div className="space-y-4">
                                <Label>Заблокированные слова ({Array.isArray(words) ? words.length : 0})</Label>
                                {loadingWords ? (
                                    <div className="text-center py-4 text-gray-400">Загрузка...</div>
                                ) : !Array.isArray(words) || words.length === 0 ? (
                                    <div className="text-center py-4 text-gray-400">Слова не добавлены</div>
                                ) : (
                                    <div className="space-y-2 max-h-60 overflow-y-auto">
                                        {words.filter(word => word && (word.word || word.text)).map((word) => (
                                            <div
                                                key={word.id}
                                                className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <span className="font-medium">{word.word || word.text || 'Unknown'}</span>
                                                    <Badge className={`${getPlatformColor(word.platform || 'all')} text-white`}>
                                                        {getPlatformLabel(word.platform || 'all')}
                                                    </Badge>
                                                </div>
                                                <Button 
                                                    variant="ghost" 
                                                    size="sm"
                                                    onClick={() => removeWord(word.id)}
                                                    className="text-red-400 hover:text-red-300 hover:bg-red-900/20"
                                                >
                                                    <X className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </TabsContent>
                    </Tabs>
                </CardContent>
            )}
        </Card>
    );
});

TtsFilterManager.displayName = 'TtsFilterManager';

export default TtsFilterManager;

