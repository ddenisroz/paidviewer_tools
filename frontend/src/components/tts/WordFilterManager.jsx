import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, AlertCircle, ChevronDown } from 'lucide-react';
import { botService } from '../../services/microservices';
import { toast } from 'sonner';
import { useIntegrations } from '../../context/IntegrationsContext';

const WordFilterManager = React.memo(() => {
    const [words, setWords] = useState([]);
    const [loading, setLoading] = useState(false);
    const [newWord, setNewWord] = useState('');
    const [selectedPlatform, setSelectedPlatform] = useState('all');
    const [isAdding, setIsAdding] = useState(false);
    const [isWordFilterExpanded, setIsWordFilterExpanded] = useState(false);
    
    // Используем useCallback для стабильной ссылки на функцию
    const toggleWordFilterExpanded = useCallback(() => {
        setIsWordFilterExpanded(prev => !prev);
    }, []);
    
    const { integrations } = useIntegrations();

    // Получаем доступные платформы из интеграций
    const getAvailablePlatforms = () => {
        const platforms = [];
        if (integrations?.twitch?.enabled) platforms.push('twitch');
        if (integrations?.vk?.enabled) platforms.push('vk');
        return platforms;
    };

    // Получаем иконку для платформы
    const getPlatformIcon = (platform) => {
        if (platform === 'twitch') return '🟣';
        if (platform === 'vk') return '🔵';
        if (platform === 'all') return '🌐';
        return '❓';
    };

    // Загрузка списка слов
    const loadWords = async () => {
        try {
            setLoading(true);
            const response = await botService.get('/api/tts/filtered-words');
            if (response.data.success) {
                setWords(response.data.words || []);
            }
        } catch (error) {
            console.error('Error loading filtered words:', error);
            // Не показываем ошибку если TTS сервис недоступен
            if (error.code !== 'ERR_NETWORK' && error.code !== 'ERR_CONNECTION_REFUSED') {
                toast.error('Ошибка загрузки списка слов');
            }
        } finally {
            setLoading(false);
        }
    };

    // Добавление слова
    const addWord = async () => {
        if (!newWord.trim()) {
            toast.error('Введите слово');
            return;
        }

        try {
            setIsAdding(true);
            const response = await botService.post('/api/tts/filtered-words', {
                word: newWord.trim(),
                platform: selectedPlatform
            });

            if (response.data.success) {
                setWords(prev => [...prev, response.data.word]);
                setNewWord('');
                toast.success('Слово добавлено');
            } else {
                toast.error(response.data.message || 'Ошибка добавления слова');
            }
        } catch (error) {
            console.error('Error adding word:', error);
            // Не показываем ошибку если TTS сервис недоступен
            if (error.code !== 'ERR_NETWORK' && error.code !== 'ERR_CONNECTION_REFUSED') {
                toast.error('Ошибка добавления слова');
            }
        } finally {
            setIsAdding(false);
        }
    };

    // Удаление слова
    const removeWord = async (wordId) => {
        try {
            const response = await botService.delete(`/api/tts/filtered-words/${wordId}`);
            if (response.data.success) {
                setWords(prev => prev.filter(word => word.id !== wordId));
                toast.success('Слово удалено');
            } else {
                toast.error(response.data.message || 'Ошибка удаления слова');
            }
        } catch (error) {
            console.error('Error removing word:', error);
            // Не показываем ошибку если TTS сервис недоступен
            if (error.code !== 'ERR_NETWORK' && error.code !== 'ERR_CONNECTION_REFUSED') {
                toast.error('Ошибка удаления слова');
            }
        }
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
            case 'twitch': return '🟣 Twitch';
            case 'vk': return '🔵 VK Live';
            case 'all': return '🌐 Все';
            default: return '❓ Неизвестно';
        }
    };

    useEffect(() => {
        loadWords();
    }, []);

    return (
        <Card data-testid="word-filter-card">
            <CardHeader 
                className="cursor-pointer hover:bg-gray-800/50 transition-colors pb-4"
                onClick={toggleWordFilterExpanded}
                data-testid="word-filter-header"
            >
                <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                        <AlertCircle className="w-5 h-5" />
                        Управление словарем фильтра
                    </CardTitle>
                    <ChevronDown 
                        className={`w-4 h-4 transition-transform ${isWordFilterExpanded ? 'rotate-180' : ''}`} 
                    />
                </div>
            </CardHeader>
            {isWordFilterExpanded && (
                <CardContent className="space-y-6 pt-4">
                    {/* Добавление нового слова */}
                    <div className="space-y-3">
                        <div className="flex flex-col sm:flex-row gap-3">
                            <Input
                                placeholder="Введите слово для фильтрации..."
                                value={newWord}
                                onChange={(e) => setNewWord(e.target.value)}
                                onKeyPress={(e) => e.key === 'Enter' && addWord()}
                                disabled={isAdding}
                                className="flex-grow bg-gray-800/50 border-gray-700/50 text-white placeholder-gray-500"
                            />
                            {getAvailablePlatforms().length > 0 && (
                                <Select value={selectedPlatform} onValueChange={setSelectedPlatform}>
                                    <SelectTrigger className="w-full sm:w-[180px] bg-gray-800/50 border-gray-700/50 text-white">
                                        <SelectValue placeholder="Платформа" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-gray-800 border-gray-700 text-white">
                                        <SelectItem value="all">{getPlatformIcon('all')} Все платформы</SelectItem>
                                        {getAvailablePlatforms().map(platform => (
                                            <SelectItem key={platform} value={platform}>
                                                {getPlatformIcon(platform)} {platform === 'twitch' ? 'Twitch' : 'VK Live'}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            )}
                            <Button 
                                onClick={addWord} 
                                disabled={isAdding || !newWord.trim()}
                                className="bg-blue-600 hover:bg-blue-700 text-white whitespace-nowrap"
                            >
                                <Plus className="h-4 w-4 mr-2" />
                                {isAdding ? 'Добавление...' : 'Добавить'}
                            </Button>
                        </div>
                        
                        {getAvailablePlatforms().length === 0 && (
                            <p className="text-sm text-gray-400">
                                Подключите хотя бы одну платформу (Twitch или VK Live) чтобы фильтровать слова
                            </p>
                        )}
                    </div>

                    {/* Список слов */}
                    <div className="space-y-4">
                        <Label>Заблокированные слова ({Array.isArray(words) ? words.length : 0})</Label>
                        {loading ? (
                            <div className="text-center py-4 text-gray-400">
                                Загрузка...
                            </div>
                        ) : !Array.isArray(words) || words.length === 0 ? (
                            <div className="text-center py-4 text-gray-400">
                                Слова не добавлены
                            </div>
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
                                            <Trash2 className="w-4 h-4" />
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
});

WordFilterManager.displayName = 'WordFilterManager';

export default WordFilterManager;
