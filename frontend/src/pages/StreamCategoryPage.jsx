// src/pages/StreamCategoryPage.jsx
import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tag, Save, RefreshCw, CheckCircle, XCircle, Search } from 'lucide-react';
import api from '../services/api';
import { toast } from 'sonner';

const StreamCategoryPage = () => {
    const [twitchCategory, setTwitchCategory] = useState('');
    const [twitchSearch, setTwitchSearch] = useState('');
    const [vkCategory, setVkCategory] = useState('');
    const [vkSearch, setVkSearch] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [lastUpdate, setLastUpdate] = useState(null);
    const [status, setStatus] = useState({ twitch: 'idle', vk: 'idle' });
    const [twitchCategories, setTwitchCategories] = useState([]);
    const [vkCategories, setVkCategories] = useState([]);
    const [currentStreamInfo, setCurrentStreamInfo] = useState({});

    // Загружаем данные при монтировании
    useEffect(() => {
        loadStreamInfo();
        loadTwitchCategories();
        loadVkCategories();
    }, []);

    // Загружаем информацию о текущем стриме
    const loadStreamInfo = async () => {
        try {
            const response = await api.get('/api/twitch/stream-info');
            const data = response.data;
            setCurrentStreamInfo(data);
            if (data.category_id) {
                setTwitchCategory(data.category_id);
            }
        } catch (error) {
            console.error('Error loading stream info:', error);
        }
    };

    // Загружаем категории Twitch
    const loadTwitchCategories = async (search = '') => {
        try {
            const response = await api.get(`/api/twitch/categories?search=${search}`);
            setTwitchCategories(response.data);
        } catch (error) {
            console.error('Error loading Twitch categories:', error);
            // Fallback на моковые данные
            setTwitchCategories([
                { id: '509658', name: 'Just Chatting', viewers: 0 },
                { id: '509670', name: 'Minecraft', viewers: 0 },
                { id: '509660', name: 'Fortnite', viewers: 0 },
                { id: '509661', name: 'Call of Duty: Warzone', viewers: 0 },
                { id: '509662', name: 'Valorant', viewers: 0 },
            ]);
        }
    };

    // Загружаем категории VK Live (пока моковые)
    const loadVkCategories = async () => {
        // Пока используем моковые данные для VK
        setVkCategories([
            { id: '1', name: 'Игры', viewers: 15000 },
            { id: '2', name: 'Общение', viewers: 12000 },
            { id: '3', name: 'Музыка', viewers: 8000 },
            { id: '4', name: 'Спорт', viewers: 6000 },
            { id: '5', name: 'Образование', viewers: 4000 },
            { id: '6', name: 'Новости', viewers: 3000 },
            { id: '7', name: 'Развлечения', viewers: 2000 },
            { id: '8', name: 'Технологии', viewers: 1500 },
        ]);
    };

    const updateTwitchCategory = async () => {
        console.log('🚀 Начинаем обновление категории:', twitchCategory);
        setIsLoading(true);
        setStatus(prev => ({ ...prev, twitch: 'loading' }));
        
        try {
            console.log('📡 Отправляем API запрос с category_id:', twitchCategory);
            const response = await api.post('/api/twitch/stream/category', {
                category_id: twitchCategory
            });
            
            console.log('✅ Получен ответ от API:', response.data);
            
            if (response.data.success) {
                setStatus(prev => ({ ...prev, twitch: 'success' }));
                setLastUpdate(new Date());
                toast.success(response.data.message);
                console.log('🎉 Категория успешно обновлена!');
                
                // Обновляем информацию о стриме
                await loadStreamInfo();
            } else {
                throw new Error(response.data.message || response.data.error);
            }
            
            setTimeout(() => {
                setStatus(prev => ({ ...prev, twitch: 'idle' }));
            }, 3000);
        } catch (error) {
            console.error('❌ Ошибка обновления категории:', error);
            console.error('📄 Детали ошибки:', error.response?.data);
            setStatus(prev => ({ ...prev, twitch: 'error' }));
            
            const errorMessage = error.response?.data?.detail || 
                               error.response?.data?.message || 
                               error.message || 
                               'Неизвестная ошибка обновления категории';
            
            toast.error(errorMessage);
        } finally {
            setIsLoading(false);
        }
    };

    const updateVkCategory = async () => {
        setIsLoading(true);
        setStatus(prev => ({ ...prev, vk: 'loading' }));
        
        try {
            // Здесь будет реальный API вызов к VK Live API
            await new Promise(resolve => setTimeout(resolve, 1500));
            setStatus(prev => ({ ...prev, vk: 'success' }));
            setLastUpdate(new Date());
            
            setTimeout(() => {
                setStatus(prev => ({ ...prev, vk: 'idle' }));
            }, 3000);
        } catch (error) {
            console.error('Error updating VK category:', error);
            setStatus(prev => ({ ...prev, vk: 'error' }));
        } finally {
            setIsLoading(false);
        }
    };

    const getStatusIcon = (platform) => {
        const statusValue = status[platform];
        switch (statusValue) {
            case 'loading':
                return <RefreshCw className="h-4 w-4 animate-spin text-blue-500" />;
            case 'success':
                return <CheckCircle className="h-4 w-4 text-green-500" />;
            case 'error':
                return <XCircle className="h-4 w-4 text-red-500" />;
            default:
                return null;
        }
    };

    const getStatusText = (platform) => {
        const statusValue = status[platform];
        switch (statusValue) {
            case 'loading':
                return 'Обновление...';
            case 'success':
                return 'Успешно обновлено';
            case 'error':
                return 'Ошибка обновления';
            default:
                return 'Готово к обновлению';
        }
    };

    // Обработка поиска Twitch категорий
    const handleTwitchSearch = (search) => {
        setTwitchSearch(search);
        loadTwitchCategories(search);
    };

    const filteredTwitchCategories = twitchCategories.filter(cat => 
        cat.name.toLowerCase().includes(twitchSearch.toLowerCase())
    );

    const filteredVkCategories = vkCategories.filter(cat => 
        cat.name.toLowerCase().includes(vkSearch.toLowerCase())
    );

    const getCurrentTwitchCategory = () => {
        return twitchCategories.find(cat => cat.id === twitchCategory);
    };

    const getCurrentVkCategory = () => {
        return vkCategories.find(cat => cat.id === vkCategory);
    };

    return (
        <div className="container mx-auto p-6 space-y-6">
            {/* Заголовок */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold mb-6 text-foreground">Смена категории стрима</h1>
                    <p className="text-muted-foreground">
                        Управление категорией стрима на Twitch и VK Live
                    </p>
                </div>
                {lastUpdate && (
                    <p className="text-sm text-muted-foreground">
                        Последнее обновление: {lastUpdate.toLocaleTimeString()}
                    </p>
                )}
            </div>

            {/* Twitch */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <div className="w-6 h-6 bg-purple-600 rounded flex items-center justify-center">
                            <span className="text-white font-bold text-xs">T</span>
                        </div>
                        Twitch
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="twitch-search">Поиск категории</Label>
                        <div className="relative">
                            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                            <Input
                                id="twitch-search"
                                value={twitchSearch}
                                onChange={(e) => handleTwitchSearch(e.target.value)}
                                placeholder="Поиск категории..."
                                className="pl-10"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>Выберите категорию</Label>
                        <Select value={twitchCategory} onValueChange={setTwitchCategory}>
                            <SelectTrigger>
                                <SelectValue placeholder="Выберите категорию" />
                            </SelectTrigger>
                            <SelectContent>
                                {filteredTwitchCategories.map((category) => (
                                    <SelectItem key={category.id} value={category.id}>
                                        <div className="flex items-center justify-between w-full">
                                            <span>{category.name}</span>
                                            <Badge variant="secondary" className="ml-2">
                                                {category.viewers.toLocaleString()} зрителей
                                            </Badge>
                                        </div>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {(getCurrentTwitchCategory() || currentStreamInfo.category_name) && (
                        <div className="p-3 bg-muted rounded-lg">
                            <p className="font-medium">
                                {getCurrentTwitchCategory()?.name || currentStreamInfo.category_name || 'Не выбрана'}
                            </p>
                            <p className="text-sm text-muted-foreground">
                                {getCurrentTwitchCategory()?.viewers ? 
                                    `${getCurrentTwitchCategory().viewers.toLocaleString()} зрителей сейчас` :
                                    'Текущая категория стрима'
                                }
                            </p>
                        </div>
                    )}

                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            {getStatusIcon('twitch')}
                            <span className="text-sm">{getStatusText('twitch')}</span>
                        </div>
                        <Button 
                            onClick={updateTwitchCategory}
                            disabled={isLoading || !twitchCategory}
                            className="flex items-center gap-2"
                        >
                            <Save className="h-4 w-4" />
                            Обновить на Twitch
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* VK Live */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <div className="w-6 h-6 bg-blue-600 rounded flex items-center justify-center">
                            <span className="text-white font-bold text-xs">V</span>
                        </div>
                        VK Live
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="vk-search">Поиск категории</Label>
                        <div className="relative">
                            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                            <Input
                                id="vk-search"
                                value={vkSearch}
                                onChange={(e) => setVkSearch(e.target.value)}
                                placeholder="Поиск категории..."
                                className="pl-10"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>Выберите категорию</Label>
                        <Select value={vkCategory} onValueChange={setVkCategory}>
                            <SelectTrigger>
                                <SelectValue placeholder="Выберите категорию" />
                            </SelectTrigger>
                            <SelectContent>
                                {filteredVkCategories.map((category) => (
                                    <SelectItem key={category.id} value={category.id}>
                                        <div className="flex items-center justify-between w-full">
                                            <span>{category.name}</span>
                                            <Badge variant="secondary" className="ml-2">
                                                {category.viewers.toLocaleString()} зрителей
                                            </Badge>
                                        </div>
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {getCurrentVkCategory() && (
                        <div className="p-3 bg-muted rounded-lg">
                            <p className="font-medium">{getCurrentVkCategory().name}</p>
                            <p className="text-sm text-muted-foreground">
                                {getCurrentVkCategory().viewers.toLocaleString()} зрителей сейчас
                            </p>
                        </div>
                    )}

                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            {getStatusIcon('vk')}
                            <span className="text-sm">{getStatusText('vk')}</span>
                        </div>
                        <Button 
                            onClick={updateVkCategory}
                            disabled={isLoading || !vkCategory}
                            className="flex items-center gap-2"
                        >
                            <Save className="h-4 w-4" />
                            Обновить на VK Live
                        </Button>
                    </div>
                </CardContent>
            </Card>

            {/* Популярные категории */}
            <Card>
                <CardHeader>
                    <CardTitle>Популярные категории</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div>
                        <h4 className="font-medium mb-2">Twitch</h4>
                        <div className="flex flex-wrap gap-2">
                            {twitchCategories.slice(0, 4).map((category) => (
                                <Button
                                    key={category.id}
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setTwitchCategory(category.id)}
                                    className="flex items-center gap-2"
                                >
                                    <Tag className="h-3 w-3" />
                                    {category.name}
                                </Button>
                            ))}
                        </div>
                    </div>
                    
                    <div>
                        <h4 className="font-medium mb-2">VK Live</h4>
                        <div className="flex flex-wrap gap-2">
                            {vkCategories.slice(0, 4).map((category) => (
                                <Button
                                    key={category.id}
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setVkCategory(category.id)}
                                    className="flex items-center gap-2"
                                >
                                    <Tag className="h-3 w-3" />
                                    {category.name}
                                </Button>
                            ))}
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

export default StreamCategoryPage;
