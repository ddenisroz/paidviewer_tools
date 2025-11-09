import React, { useState, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, AlertCircle, ChevronDown } from 'lucide-react';
import { useIntegrations } from '../../context/IntegrationsContext';
import { useFilteredWords, useAddFilteredWord, useDeleteFilteredWord } from '../../queries/tts/ttsQueries';

const WordFilterManager = React.memo(() => {
    const [newWord, setNewWord] = useState('');
    const [selectedPlatform, setSelectedPlatform] = useState('all');
    const [isWordFilterExpanded, setIsWordFilterExpanded] = useState(false);
    
    // Используем useCallback для стабильной ссылки на функцию
    const toggleWordFilterExpanded = useCallback(() => {
        setIsWordFilterExpanded(prev => !prev);
    }, []);
    
    const { integrations } = useIntegrations();

    // React Query hooks
    const { data: wordsData, isLoading: loading } = useFilteredWords({
        retry: false, // Не повторяем при ошибке
        refetchOnWindowFocus: false,
    });

    const addWordMutation = useAddFilteredWord({
        onSuccess: () => {
            setNewWord('');
        },
        onError: (error) => {
            // Ошибка уже обработана в hook, но не показываем toast если TTS сервис недоступен
            if (error.code === 'ERR_NETWORK' || error.code === 'ERR_CONNECTION_REFUSED') {
                // Не показываем ошибку если TTS сервис недоступен
            }
        },
    });

    const deleteWordMutation = useDeleteFilteredWord({
        onError: (error) => {
            // Ошибка уже обработана в hook, но не показываем toast если TTS сервис недоступен
            if (error.code === 'ERR_NETWORK' || error.code === 'ERR_CONNECTION_REFUSED') {
                // Не показываем ошибку если TTS сервис недоступен
            }
        },
    });

    const words = wordsData?.data?.filtered_words || wordsData?.data?.words || [];
    const isAdding = addWordMutation.isPending;

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

    // Добавление слова
    const addWord = () => {
        if (!newWord.trim()) {
            return;
        }

        addWordMutation.mutate({
            word: newWord.trim(),
            platform: selectedPlatform
        });
    };

    // Удаление слова
    const removeWord = (wordId) => {
        deleteWordMutation.mutate(wordId);
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
