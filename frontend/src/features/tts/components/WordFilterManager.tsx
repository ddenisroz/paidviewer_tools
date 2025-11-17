import React, { useState, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, AlertCircle, ChevronDown } from 'lucide-react';
import { useIntegrations } from '../../../context/IntegrationsContext';
import { useFilteredWords, useAddFilteredWord, useDeleteFilteredWord } from '../../../queries/tts/ttsQueries';

interface FilteredWord {
    id: number;
    word: string;
    platform: string;
}

const WordFilterManager: React.FC = React.memo(() => {
    const [newWord, setNewWord] = useState('');
    const [selectedPlatform, setSelectedPlatform] = useState<string>('all');
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
        onError: (error: any) => {
            // Ошибка уже обработана в hook, но не показываем toast если TTS сервис недоступен
            if (error.code === 'ERR_NETWORK' || error.code === 'ERR_CONNECTION_REFUSED') {
                // Не показываем ошибку если TTS сервис недоступен
            }
        },
    });

    const deleteWordMutation = useDeleteFilteredWord({
        onError: (error: any) => {
            // Ошибка уже обработана в hook, но не показываем toast если TTS сервис недоступен
            if (error.code === 'ERR_NETWORK' || error.code === 'ERR_CONNECTION_REFUSED') {
                // Не показываем ошибку если TTS сервис недоступен
            }
        },
    });

    const words: FilteredWord[] = Array.isArray(wordsData) ? wordsData : (wordsData as any)?.data?.filtered_words || (wordsData as any)?.data?.words || [];
    const isAdding = addWordMutation.isPending;

    // Получаем доступные платформы из интеграций
    const getAvailablePlatforms = (): string[] => {
        const platforms: string[] = [];
        if (integrations?.twitch?.enabled) platforms.push('twitch');
        if (integrations?.vk?.enabled) platforms.push('vk');
        return platforms;
    };

    // Получаем иконку для платформы
    const getPlatformIcon = (platform: string): string => {
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
            word: newWord.trim()
        });
    };

    // Удаление слова
    const removeWord = (wordId: number) => {
        deleteWordMutation.mutate(wordId);
    };

    // Получение цвета для платформы
    const getPlatformColor = (platform: string): string => {
        switch (platform) {
            case 'twitch': return 'bg-purple-600';
            case 'vk': return 'bg-blue-600';
            case 'all': return 'bg-gray-600';
            default: return 'bg-gray-600';
        }
    };

    // Получение лейбла для платформы
    const getPlatformLabel = (platform: string): string => {
        switch (platform) {
            case 'twitch': return '🟣 Twitch';
            case 'vk': return '🔵 VK Live';
            case 'all': return '🌐 Все платформы';
            default: return platform;
        }
    };

    const availablePlatforms = getAvailablePlatforms();
    const hasPlatforms = availablePlatforms.length > 0;

    // Фильтруем слова по выбранной платформе
    const filteredWords = selectedPlatform === 'all' 
        ? words 
        : words.filter(word => word.platform === selectedPlatform);

    if (!hasPlatforms) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <AlertCircle className="h-5 w-5 text-yellow-500" />
                        Фильтр слов
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-muted-foreground">
                        Подключите хотя бы одну платформу (Twitch или VK Live) для использования фильтра слов
                    </p>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                        Фильтр слов
                    </CardTitle>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={toggleWordFilterExpanded}
                        className="gap-2"
                    >
                        <ChevronDown className={`h-4 w-4 transition-transform ${isWordFilterExpanded ? 'rotate-180' : ''}`} />
                    </Button>
                </div>
            </CardHeader>
            {isWordFilterExpanded && (
                <CardContent className="space-y-4">
                    {/* Добавление слова */}
                    <div className="space-y-2">
                        <Label>Добавить слово</Label>
                        <div className="flex gap-2">
                            <Input
                                value={newWord}
                                onChange={(e) => setNewWord(e.target.value)}
                                placeholder="Введите слово для фильтрации"
                                onKeyPress={(e) => {
                                    if (e.key === 'Enter') {
                                        addWord();
                                    }
                                }}
                                className="flex-1"
                            />
                            <Select value={selectedPlatform} onValueChange={setSelectedPlatform}>
                                <SelectTrigger className="w-44">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">🌐 Все</SelectItem>
                                    {availablePlatforms.includes('twitch') && (
                                        <SelectItem value="twitch">🟣 Twitch</SelectItem>
                                    )}
                                    {availablePlatforms.includes('vk') && (
                                        <SelectItem value="vk">🔵 VK Live</SelectItem>
                                    )}
                                </SelectContent>
                            </Select>
                            <Button
                                onClick={addWord}
                                disabled={isAdding || !newWord.trim()}
                            >
                                <Plus className="h-4 w-4 mr-2" />
                                Добавить
                            </Button>
                        </div>
                    </div>

                    {/* Список слов */}
                    <div className="space-y-2">
                        <Label>Зафильтрованные слова ({filteredWords.length})</Label>
                        {loading ? (
                            <p className="text-sm text-muted-foreground">Загрузка...</p>
                        ) : filteredWords.length === 0 ? (
                            <p className="text-sm text-muted-foreground">Нет зафильтрованных слов</p>
                        ) : (
                            <div className="flex flex-wrap gap-2">
                                {filteredWords.map((word) => (
                                    <Badge
                                        key={word.id}
                                        variant="secondary"
                                        className="flex items-center gap-2"
                                    >
                                        <span>{word.word}</span>
                                        <span className={`px-2 py-0.5 rounded text-xs ${getPlatformColor(word.platform)} text-white`}>
                                            {getPlatformIcon(word.platform)}
                                        </span>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-4 w-4 p-0 hover:bg-destructive hover:text-destructive-foreground"
                                            onClick={() => removeWord(word.id)}
                                        >
                                            <Trash2 className="h-3 w-3" />
                                        </Button>
                                    </Badge>
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



