import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Gift, Trophy, Star, Coins, Calendar, MessageSquare, TrendingUp, Check, X, Settings, BarChart3, Plus, Sparkles } from 'lucide-react';
import { lootboxService } from '../services/api/services/lootboxService';
import { logger } from '../utils/prodLogger';
import { CardSkeleton } from './ui/skeleton';
import ImageLootbox from './ImageLootbox';
import {
    createLootboxImageConfig,
    createMockLootboxes,
    animateLootboxOpening,
    createSparkleEffect
} from '../utils/lootboxImages';

const LootboxSystem = ({ channelName }) => {
    const [, setProgression] = useState(null);
    const [, setLootboxes] = useState([]);
    const [recentOpenings, setRecentOpenings] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [, setOpeningLootbox] = useState(null);
    const [selectedPlatform, setSelectedPlatform] = useState('twitch'); // 'twitch' или 'vk'
    const [, ] = useState({});
    const [, ] = useState([]);
    const [, ] = useState([]);
    const [lootboxSettings] = useState({
        rarityRates: {
            common: 60,
            rare: 25,
            epic: 12,
            legendary: 3
        },
        categories: ['coins', 'items', 'special', 'exclusive']
    });

    // Состояние для анимированных лутбоксов
    const [imageLootboxes, setImageLootboxes] = useState([]);
    const [openingLootboxId, setOpeningLootboxId] = useState(null);
    
    // Состояние для модального окна результата
    const [showResultModal, setShowResultModal] = useState(false);
    const [lootboxResult, setLootboxResult] = useState(null);

    // Данные для игрового поля
    const [gameFieldData, setGameFieldData] = useState(() => {
        // Инициализируем 30 дней с моковыми данными
        return Array.from({ length: 30 }, (_, i) => {
            const dayNumber = i + 1;
            const viewers = [
                'Player1', 'Gamer2', 'Streamer3', 'Viewer4', 'Fan5',
                'User6', 'Watcher7', 'Supporter8', 'Follower9', 'Subscriber10',
                'StreamFan', 'GameLover', 'ChatMaster', 'ViewerPro', 'StreamSupporter'
            ];
            const hasViewer = Math.random() > 0.6;
            const viewerName = hasViewer ? viewers[Math.floor(Math.random() * viewers.length)] : null;
            const isActive = hasViewer && Math.random() > 0.5;

            return {
                day: dayNumber,
                viewerName,
                isActive,
                hasViewer
            };
        });
    });

    useEffect(() => {
        loadData();
        initializeImageLootboxes();
    }, [channelName]);

    // Инициализация лутбоксов с картинками
    const initializeImageLootboxes = () => {
        const mockLootboxes = createMockLootboxes();
        setImageLootboxes(mockLootboxes);
    };

    // Функция для обновления данных дня
    const updateDayData = (dayNumber, viewerName, isActive) => {
        setGameFieldData(prev => prev.map(day =>
            day.day === dayNumber
                ? {
                    ...day,
                    viewerName: viewerName || null,
                    isActive: isActive || false,
                    hasViewer: !!viewerName
                  }
                : day
        ));
    };

    // Функция для добавления зрителя в день
    const addViewerToDay = (dayNumber, viewerName) => {
        updateDayData(dayNumber, viewerName, true);
    };

    // Функция для удаления зрителя из дня
    const removeViewerFromDay = (dayNumber) => {
        updateDayData(dayNumber, null, false);
    };

    const loadData = async () => {
        try {
            setIsLoading(true);
            const [progressionRes, lootboxesRes, openingsRes] = await Promise.all([
                lootboxService.getProgression(channelName),
                lootboxService.getLootboxes(channelName),
                lootboxService.getRecentOpenings(channelName, { limit: 5 })
            ]);

            setProgression(progressionRes.data.progression);
            setLootboxes(lootboxesRes.data.lootboxes);
            setRecentOpenings(openingsRes.data.openings);
        } catch (error) {
            logger.error('Error loading lootbox data:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const _openLootbox = async (lootboxId) => {
        try {
            setOpeningLootbox(lootboxId);
            const response = await lootboxService.openLootbox({ lootbox_id: lootboxId });

            if (response.data.success) {
                // Показываем результат
                showLootboxResult(response.data.result);
                // Обновляем данные
                loadData();
            }
        } catch (error) {
            logger.error('Error opening lootbox:', error);
        } finally {
            setOpeningLootbox(null);
        }
    };

    const showLootboxResult = (result) => {
        // Показываем модальное окно с результатом
        setLootboxResult(result);
        setShowResultModal(true);
        
        // Автоматически закрываем через 5 секунд
        setTimeout(() => {
            setShowResultModal(false);
        }, 5000);
    };
    
    // Функция для получения цвета по редкости
    const getRarityColor = (rarity) => {
        const colors = {
            common: 'text-gray-500',
            rare: 'text-blue-500',
            epic: 'text-purple-500',
            legendary: 'text-yellow-500',
            mythical: 'text-pink-500'
        };
        return colors[rarity] || 'text-gray-500';
    };
    
    // Функция для получения иконки по типу награды
    const getRewardIcon = (rewardType) => {
        const icons = {
            coins: Coins,
            items: Gift,
            special: Star,
            exclusive: Trophy
        };
        return icons[rewardType] || Gift;
    };

    // Функции для управления анимированными лутбоксами
    const handleLootboxOpen = (lootboxId) => {
        setOpeningLootboxId(lootboxId);

        // Создаем эффект блеска
        const element = document.getElementById(`image-lootbox-${lootboxId}`);
        if (element) {
            createSparkleEffect(element);
        }

        // Сбрасываем состояние через 3 секунды (время анимации)
        setTimeout(() => {
            setOpeningLootboxId(null);
        }, 3000);
    };

    const openImageLootbox = (lootboxId) => {
        const element = document.getElementById(`image-lootbox-${lootboxId}`);
        if (element) {
            animateLootboxOpening(element, () => {
                // Image lootbox opened
                // Здесь можно добавить логику открытия лутбокса
            });
        }
    };

    if (isLoading) {
        return (
            <div className="space-y-8 p-6">
                <div className="space-y-4">
                    <div className="h-8 w-48 bg-muted animate-pulse rounded"></div>
                    <div className="h-4 w-96 bg-muted animate-pulse rounded"></div>
                </div>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    <CardSkeleton />
                    <CardSkeleton />
                    <CardSkeleton />
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-8 p-6">
            {/* Заголовок */}
            <div className="text-center space-y-4">
                <h2 className="text-3xl font-bold text-white">🎁 Система Лутбоксов</h2>
                <p className="text-gray-400 text-lg">Зарабатывайте награды за активность!</p>

                {/* Переключатель платформ */}
                <div className="flex justify-center">
                    <div className="bg-gray-800 rounded-lg p-1 flex">
                        <button
                            onClick={() => setSelectedPlatform('twitch')}
                            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                                selectedPlatform === 'twitch'
                                    ? 'bg-purple-600 text-white'
                                    : 'text-gray-400 hover:text-white'
                            }`}
                        >
                            Twitch
                        </button>
                        <button
                            onClick={() => setSelectedPlatform('vk')}
                            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                                selectedPlatform === 'vk'
                                    ? 'bg-blue-600 text-white'
                                    : 'text-gray-400 hover:text-white'
                            }`}
                        >
                            VK Live
                        </button>
                    </div>
                </div>
            </div>

            <Tabs defaultValue="image-lootboxes" className="w-full">
                <TabsList className="grid w-full grid-cols-6">
                    <TabsTrigger value="image-lootboxes">🎨 Анимированные лутбоксы</TabsTrigger>
                    <TabsTrigger value="calendar">📅 Календарь</TabsTrigger>
                    <TabsTrigger value="donation-lootboxes">💰 Донатные лутбоксы</TabsTrigger>
                    <TabsTrigger value="achievement-lootboxes">🏆 Лутбоксы за ачивки</TabsTrigger>
                    <TabsTrigger value="settings">⚙️ Настройки</TabsTrigger>
                    <TabsTrigger value="history">📜 История</TabsTrigger>
                </TabsList>

                {/* Анимированные лутбоксы с картинками */}
                <TabsContent value="image-lootboxes" className="space-y-6">
                    <div className="bg-gray-800 rounded-lg p-6">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold text-white">Анимированные лутбоксы</h3>
                            <div className="flex gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                        // Открыть все лутбоксы одновременно
                                        imageLootboxes.forEach(lootbox => {
                                            handleLootboxOpen(lootbox.id);
                                        });
                                    }}
                                >
                                    <Gift className="w-4 h-4 mr-2" />
                                    Открыть все
                                </Button>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                        // Сбросить все анимации
                                        setOpeningLootboxId(null);
                                    }}
                                >
                                    <X className="w-4 h-4 mr-2" />
                                    Сбросить
                                </Button>
                            </div>
                        </div>

                        <div className="mb-6">
                            <p className="text-gray-400 text-sm">
                                Нажмите на лутбокс, чтобы увидеть анимацию открытия. Картинки будут сменяться, создавая эффект открытия.
                            </p>
                        </div>

                        {/* Сетка анимированных лутбоксов */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                            {imageLootboxes.map((lootbox) => {
                                const config = createLootboxImageConfig(lootbox, 'grid');
                                return (
                                    <div
                                        key={lootbox.id}
                                        id={`image-lootbox-${lootbox.id}`}
                                        className="animate-lootbox-appear"
                                    >
                                        <ImageLootbox
                                            images={config.images}
                                            title={config.title}
                                            rarity={config.rarity}
                                            size={config.size}
                                            isOpening={openingLootboxId === lootbox.id}
                                            onOpen={() => handleLootboxOpen(lootbox.id)}
                                            className={`${config.effects} cursor-pointer`}
                                        />

                                        {/* Дополнительная кнопка для анимации открытия */}
                                        <div className="mt-2 text-center">
                                            <Button
                                                onClick={() => openImageLootbox(lootbox.id)}
                                                className="w-full bg-purple-600 hover:bg-purple-700"
                                                size="sm"
                                                variant="outline"
                                            >
                                                <Star className="w-4 h-4 mr-2" />
                                                Анимация открытия
                                            </Button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Информация о системе */}
                        <div className="mt-8 p-4 bg-gray-700 rounded-lg">
                            <h4 className="text-sm font-semibold text-white mb-2">ℹ️ О системе анимации</h4>
                            <p className="text-sm text-gray-300">
                                Система использует смену картинок для создания эффекта открытия лутбокса.
                                Каждый лутбокс имеет набор картинок: закрытый → этапы открытия → открытый.
                                Добавьте свои картинки в папку <code className="bg-gray-800 px-1 rounded">/src/images/lootboxes/</code>
                            </p>
                        </div>
                    </div>
                </TabsContent>

                {/* Календарь */}
                <TabsContent value="calendar" className="space-y-6">
                    <div className="bg-gray-800 rounded-lg p-6">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold text-white">Игровое поле активности</h3>
                            <div className="flex gap-2">
                                <Button variant="outline" size="sm">
                                    <Settings className="w-4 h-4 mr-2" />
                                    Настройки
                                </Button>
                                <Button variant="outline" size="sm">
                                    <BarChart3 className="w-4 h-4 mr-2" />
                                    Статистика
                                </Button>
                            </div>
                        </div>

                        {/* Простое игровое поле 6x5 = 30 ячеек */}
                        <div className="grid grid-cols-6 gap-2">
                            {gameFieldData.map((dayData) => (
                                <div
                                    key={dayData.day}
                                    className={`
                                        aspect-square flex flex-col items-center justify-center text-sm rounded-lg cursor-pointer transition-all duration-200 border-2
                                        ${dayData.hasViewer
                                            ? dayData.isActive
                                                ? 'bg-green-600 text-white border-green-500 hover:bg-green-700'
                                                : 'bg-blue-600 text-white border-blue-500 hover:bg-blue-700'
                                            : 'bg-gray-700 text-gray-400 border-gray-600 hover:bg-gray-600'
                                        }
                                    `}
                                    title={dayData.viewerName ? `День ${dayData.day}: ${dayData.viewerName}` : `День ${dayData.day}: Нет зрителей`}
                                    onClick={() => {
                                        // Обработчик клика для редактирования дня
                                        const newViewerName = prompt(
                                            `Редактировать день ${dayData.day}:\nВведите никнейм зрителя (или оставьте пустым для удаления):`,
                                            dayData.viewerName || ''
                                        );

                                        if (newViewerName !== null) {
                                            if (newViewerName.trim() === '') {
                                                removeViewerFromDay(dayData.day);
                                            } else {
                                                addViewerToDay(dayData.day, newViewerName.trim());
                                            }
                                        }
                                    }}
                                >
                                    <div className="text-xs font-bold">{dayData.day}</div>
                                    {dayData.viewerName && (
                                        <div className="text-xs truncate w-full text-center px-1">
                                            {dayData.viewerName}
                                        </div>
                                    )}
                                    {dayData.hasViewer && dayData.isActive && (
                                        <Check className="w-3 h-3 mt-1" />
                                    )}
                                </div>
                            ))}
                        </div>

                        {/* Статистика */}
                        <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
                            <div className="bg-gray-700 rounded-lg p-3 text-center">
                                <div className="text-2xl font-bold text-green-400">
                                    {gameFieldData.filter(day => day.isActive).length}
                                </div>
                                <div className="text-xs text-gray-300">Активные дни</div>
                            </div>
                            <div className="bg-gray-700 rounded-lg p-3 text-center">
                                <div className="text-2xl font-bold text-blue-400">
                                    {gameFieldData.filter(day => day.hasViewer).length}
                                </div>
                                <div className="text-xs text-gray-300">Дни с зрителями</div>
                            </div>
                            <div className="bg-gray-700 rounded-lg p-3 text-center">
                                <div className="text-2xl font-bold text-yellow-400">
                                    {new Set(gameFieldData.filter(day => day.viewerName).map(day => day.viewerName)).size}
                                </div>
                                <div className="text-xs text-gray-300">Уникальных зрителей</div>
                            </div>
                            <div className="bg-gray-700 rounded-lg p-3 text-center">
                                <div className="text-2xl font-bold text-purple-400">
                                    {(() => {
                                        let maxStreak = 0;
                                        let currentStreak = 0;
                                        gameFieldData.forEach(day => {
                                            if (day.isActive) {
                                                currentStreak++;
                                                maxStreak = Math.max(maxStreak, currentStreak);
                                            } else {
                                                currentStreak = 0;
                                            }
                                        });
                                        return maxStreak;
                                    })()}
                                </div>
                                <div className="text-xs text-gray-300">Макс. дней подряд</div>
                            </div>
                        </div>

                        {/* Легенда */}
                        <div className="flex gap-6 mt-6 text-sm">
                            <div className="flex items-center gap-2">
                                <div className="w-4 h-4 bg-green-600 rounded border border-green-500"></div>
                                <span className="text-gray-300">Активный зритель</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-4 h-4 bg-blue-600 rounded border border-blue-500"></div>
                                <span className="text-gray-300">Есть зритель</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="w-4 h-4 bg-gray-700 rounded border border-gray-600"></div>
                                <span className="text-gray-300">Нет зрителей</span>
                            </div>
                        </div>
                    </div>
                </TabsContent>

                {/* Донатные лутбоксы */}
                <TabsContent value="donation-lootboxes" className="space-y-6">
                    <div className="bg-gray-800 rounded-lg p-6">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold text-white">Настройка донатных лутбоксов</h3>
                            <Button className="bg-green-600 hover:bg-green-700">
                                <Plus className="w-4 h-4 mr-2" />
                                Добавить лутбокс
                            </Button>
                        </div>

                        {/* Прогресс-бар общей суммы донатов */}
                        <div className="mb-8">
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-gray-300">Общая сумма донатов</span>
                                <span className="text-white font-bold">1,250 ₽ / 5,000 ₽</span>
                            </div>
                            <Progress value={25} className="h-3 mb-2" />
                            <div className="flex justify-between text-sm text-gray-400">
                                <span>Малый лутбокс (500₽)</span>
                                <span>Средний лутбокс (2,000₽)</span>
                                <span>Большой лутбокс (5,000₽)</span>
                                <span className="text-yellow-400">МЕГА лутбокс (10,000₽)</span>
                            </div>
                        </div>

                        {/* Список лутбоксов по суммам */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {[
                                { id: 1, name: 'Малый лутбокс', price: 500, current: 1250, max: 500, rarity: 'common', rewards: ['50 монет', 'Обычный предмет'] },
                                { id: 2, name: 'Средний лутбокс', price: 2000, current: 1250, max: 2000, rarity: 'rare', rewards: ['200 монет', 'Редкий предмет', 'Скидка 10%'] },
                                { id: 3, name: 'Большой лутбокс', price: 5000, current: 1250, max: 5000, rarity: 'epic', rewards: ['500 монет', 'Эпический предмет', 'Эксклюзивный контент'] },
                                { id: 4, name: 'МЕГА лутбокс', price: 10000, current: 1250, max: 10000, rarity: 'legendary', rewards: ['1000 монет', 'Легендарный предмет', 'VIP статус', 'Персональная награда'] }
                            ].map((lootbox) => (
                                <Card key={lootbox.id} className="bg-gray-700 border-gray-600">
                                    <CardHeader>
                                        <CardTitle className="text-white flex items-center justify-between">
                                            <span className="flex items-center">
                                                <Gift className="w-5 h-5 mr-2" />
                                                {lootbox.name}
                                            </span>
                                            <Badge variant={
                                                lootbox.rarity === 'common' ? 'default' :
                                                lootbox.rarity === 'rare' ? 'secondary' :
                                                lootbox.rarity === 'epic' ? 'destructive' : 'outline'
                                            }>
                                                {lootbox.rarity === 'common' ? 'Обычный' :
                                                 lootbox.rarity === 'rare' ? 'Редкий' :
                                                 lootbox.rarity === 'epic' ? 'Эпический' : 'Легендарный'}
                                            </Badge>
                                        </CardTitle>
                                        <CardDescription className="text-gray-400">
                                            {lootbox.price} ₽
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="space-y-4">
                                            <div className="space-y-2">
                                                <div className="flex justify-between text-sm">
                                                    <span className="text-gray-400">Прогресс</span>
                                                    <span className="text-white">{Math.round((lootbox.current / lootbox.max) * 100)}%</span>
                                                </div>
                                                <Progress value={(lootbox.current / lootbox.max) * 100} className="h-2" />
                                            </div>

                                            <div className="space-y-1">
                                                <span className="text-sm text-gray-300">Награды:</span>
                                                {lootbox.rewards.map((reward, idx) => (
                                                    <div key={idx} className="text-xs text-gray-400 flex items-center">
                                                        <Star className="w-3 h-3 mr-1" />
                                                        {reward}
                                                    </div>
                                                ))}
                                            </div>

                                            <Button
                                                className="w-full"
                                                disabled={lootbox.current < lootbox.max}
                                                variant={lootbox.current >= lootbox.max ? "default" : "outline"}
                                            >
                                                {lootbox.current >= lootbox.max ? 'Открыть!' : `Нужно еще ${lootbox.max - lootbox.current} ₽`}
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    </div>
                </TabsContent>

                {/* Достижения */}
                <TabsContent value="achievement-lootboxes" className="space-y-6">
                    <div className="bg-gray-800 rounded-lg p-6">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold text-white">Лутбоксы за достижения</h3>
                            <Button className="bg-green-600 hover:bg-green-700">
                                <Plus className="w-4 h-4 mr-2" />
                                Добавить достижение
                            </Button>
                        </div>

                        {/* Список достижений из чата */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {[
                                {
                                    id: 1,
                                    name: 'Автор топ-клипа',
                                    description: 'Создать самый просматриваемый клип недели',
                                    type: 'clip',
                                    reward: 'Эксклюзивный лутбокс',
                                    progress: 85,
                                    max: 100,
                                    rarity: 'epic'
                                },
                                {
                                    id: 2,
                                    name: 'Чат-машина',
                                    description: 'Написать 1000 сообщений в чате',
                                    type: 'messages',
                                    reward: 'Редкий лутбокс',
                                    progress: 750,
                                    max: 1000,
                                    rarity: 'rare'
                                },
                                {
                                    id: 3,
                                    name: 'Первая кровь',
                                    description: 'Написать первое сообщение в стриме',
                                    type: 'first_message',
                                    reward: 'Обычный лутбокс',
                                    progress: 100,
                                    max: 100,
                                    rarity: 'common',
                                    completed: true
                                },
                                {
                                    id: 4,
                                    name: 'Подписчик года',
                                    description: 'Подписаться на канал на год',
                                    type: 'subscription',
                                    reward: 'Легендарный лутбокс',
                                    progress: 30,
                                    max: 365,
                                    rarity: 'legendary'
                                },
                                {
                                    id: 5,
                                    name: 'Модератор чата',
                                    description: 'Помочь модерировать чат 50 раз',
                                    type: 'moderation',
                                    reward: 'Эпический лутбокс',
                                    progress: 25,
                                    max: 50,
                                    rarity: 'epic'
                                },
                                {
                                    id: 6,
                                    name: 'Стример-друг',
                                    description: 'Быть в топ-10 зрителей 30 дней подряд',
                                    type: 'viewer',
                                    reward: 'МЕГА лутбокс',
                                    progress: 15,
                                    max: 30,
                                    rarity: 'legendary'
                                }
                            ].map((achievement) => (
                                <Card key={achievement.id} className="bg-gray-700 border-gray-600">
                                    <CardHeader>
                                        <CardTitle className="text-white flex items-center justify-between">
                                            <span className="flex items-center">
                                                <Trophy className="w-5 h-5 mr-2 text-yellow-400" />
                                                {achievement.name}
                                            </span>
                                            <Badge variant={
                                                achievement.rarity === 'common' ? 'default' :
                                                achievement.rarity === 'rare' ? 'secondary' :
                                                achievement.rarity === 'epic' ? 'destructive' : 'outline'
                                            }>
                                                {achievement.rarity === 'common' ? 'Обычный' :
                                                 achievement.rarity === 'rare' ? 'Редкий' :
                                                 achievement.rarity === 'epic' ? 'Эпический' : 'Легендарный'}
                                            </Badge>
                                        </CardTitle>
                                        <CardDescription className="text-gray-400">
                                            {achievement.description}
                                        </CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="space-y-4">
                                            <div className="space-y-2">
                                                <div className="flex justify-between text-sm">
                                                    <span className="text-gray-400">Прогресс</span>
                                                    <span className="text-white">
                                                        {achievement.completed ? '100%' : `${achievement.progress}/${achievement.max}`}
                                                    </span>
                                                </div>
                                                <Progress
                                                    value={achievement.completed ? 100 : (achievement.progress / achievement.max) * 100}
                                                    className="h-2"
                                                />
                                            </div>

                                            <div className="flex items-center justify-between">
                                                <span className="text-sm text-gray-300">
                                                    Награда: {achievement.reward}
                                                </span>
                                                {achievement.completed && (
                                                    <Check className="w-5 h-5 text-green-400" />
                                                )}
                                            </div>

                                            <Button
                                                className="w-full"
                                                disabled={!achievement.completed}
                                                variant={achievement.completed ? "default" : "outline"}
                                            >
                                                {achievement.completed ? 'Получить награду!' : 'В процессе...'}
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    </div>
                </TabsContent>

                {/* Настройки */}
                <TabsContent value="settings" className="space-y-6">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Настройки шансов выпадения */}
                        <Card className="bg-gray-800 border-gray-700">
                            <CardHeader>
                                <CardTitle className="text-white flex items-center">
                                    <BarChart3 className="w-5 h-5 mr-2" />
                                    Шансы выпадения лутбоксов
                                </CardTitle>
                                <CardDescription className="text-gray-400">
                                    Настройте редкость и категории лутбоксов
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div>
                                    <h4 className="text-lg font-semibold text-white mb-4">Редкость лутбоксов</h4>
                                    <div className="space-y-4">
                                        {Object.entries(lootboxSettings.rarityRates).map(([rarity, rate]) => (
                                            <div key={rarity} className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <div className={`w-4 h-4 rounded ${
                                                        rarity === 'common' ? 'bg-gray-400' :
                                                        rarity === 'rare' ? 'bg-blue-400' :
                                                        rarity === 'epic' ? 'bg-purple-400' : 'bg-yellow-400'
                                                    }`}></div>
                                                    <span className="text-gray-300 capitalize">
                                                        {rarity === 'common' ? 'Обычный' :
                                                         rarity === 'rare' ? 'Редкий' :
                                                         rarity === 'epic' ? 'Эпический' : 'Легендарный'}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <input
                                                        type="range"
                                                        min="0"
                                                        max="100"
                                                        value={rate}
                                                        className="w-24"
                                                    />
                                                    <span className="text-white w-8">{rate}%</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <h4 className="text-lg font-semibold text-white mb-4">Категории наград</h4>
                                    <div className="space-y-2">
                                        {lootboxSettings.categories.map((category, index) => (
                                            <div key={index} className="flex items-center justify-between p-2 bg-gray-700 rounded">
                                                <span className="text-gray-300 capitalize">
                                                    {category === 'coins' ? 'Монеты' :
                                                     category === 'items' ? 'Предметы' :
                                                     category === 'special' ? 'Особые' : 'Эксклюзивные'}
                                                </span>
                                                <Button size="sm" variant="outline">
                                                    <X className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        ))}
                                        <Button size="sm" variant="outline" className="w-full">
                                            <Plus className="w-4 h-4 mr-2" />
                                            Добавить категорию
                                        </Button>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Настройки календаря и активности */}
                        <Card className="bg-gray-800 border-gray-700">
                            <CardHeader>
                                <CardTitle className="text-white flex items-center">
                                    <Calendar className="w-5 h-5 mr-2" />
                                    Настройки активности
                                </CardTitle>
                                <CardDescription className="text-gray-400">
                                    Настройте правила получения лутбоксов
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div>
                                    <label className="text-sm text-gray-300">Дней для получения лутбокса</label>
                                    <input
                                        type="number"
                                        min="1"
                                        max="30"
                                        defaultValue="7"
                                        className="w-full mt-2 px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white"
                                    />
                                </div>
                                <div>
                                    <label className="text-sm text-gray-300">Минимум сообщений в день</label>
                                    <input
                                        type="number"
                                        min="1"
                                        max="100"
                                        defaultValue="5"
                                        className="w-full mt-2 px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white"
                                    />
                                </div>
                                <div>
                                    <label className="text-sm text-gray-300">Минимум времени в стриме (минуты)</label>
                                    <input
                                        type="number"
                                        min="1"
                                        max="480"
                                        defaultValue="30"
                                        className="w-full mt-2 px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white"
                                    />
                                </div>
                                <div>
                                    <label className="text-sm text-gray-300">Платформа</label>
                                    <select className="w-full mt-2 px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white">
                                        <option value="twitch">Twitch</option>
                                        <option value="vk">VK Live</option>
                                        <option value="both">Обе платформы</option>
                                    </select>
                                </div>
                            </CardContent>
                        </Card>

                        {/* OBS интеграция */}
                        <Card className="bg-gray-800 border-gray-700 lg:col-span-2">
                            <CardHeader>
                                <CardTitle className="text-white flex items-center">
                                    <Gift className="w-5 h-5 mr-2" />
                                    OBS интеграция
                                </CardTitle>
                                <CardDescription className="text-gray-400">
                                    Ссылка для показа анимации получения лутбокса
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div>
                                    <label className="text-sm text-gray-300">URL для OBS</label>
                                    <div className="flex gap-2 mt-2">
                                        <input
                                            type="text"
                                            value={`https://yourchy.com/lootbox/obs/${channelName || 'Yourchy'}`}
                                            readOnly
                                            className="flex-1 px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white text-sm"
                                        />
                                        <Button size="sm" variant="outline">
                                            Копировать
                                        </Button>
                                    </div>
                                </div>
                                <div className="p-4 bg-gray-700 rounded-lg">
                                    <h4 className="text-sm font-semibold text-white mb-2">Инструкция для OBS:</h4>
                                    <ol className="text-sm text-gray-300 space-y-1 list-decimal list-inside">
                                        <li>Добавьте источник "Browser Source" в OBS</li>
                                        <li>Вставьте URL выше в поле URL</li>
                                        <li>Установите размер 1920x1080</li>
                                        <li>Включите "Shutdown source when not visible"</li>
                                    </ol>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </TabsContent>

                {/* История открытий */}
                <TabsContent value="history" className="space-y-6">
                    <div className="bg-gray-800 rounded-lg p-6">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold text-white">История получения наград</h3>
                            <div className="flex gap-2">
                                <Button variant="outline" size="sm">
                                    <BarChart3 className="w-4 h-4 mr-2" />
                                    Статистика
                                </Button>
                                <Button variant="outline" size="sm">
                                    <Settings className="w-4 h-4 mr-2" />
                                    Фильтры
                                </Button>
                            </div>
                        </div>

                        {recentOpenings.length > 0 ? (
                            <div className="space-y-3">
                                {[
                                    { id: 1, user_name: 'Player1', reward_name: '100 монет', lootbox_type: 'donation', rarity: 'common', opened_at: new Date().toISOString() },
                                    { id: 2, user_name: 'Player2', reward_name: 'Редкий предмет', lootbox_type: 'achievement', rarity: 'rare', opened_at: new Date(Date.now() - 3600000).toISOString() },
                                    { id: 3, user_name: 'Player3', reward_name: 'Эксклюзивный контент', lootbox_type: 'donation', rarity: 'epic', opened_at: new Date(Date.now() - 7200000).toISOString() },
                                    { id: 4, user_name: 'Player4', reward_name: 'VIP статус', lootbox_type: 'achievement', rarity: 'legendary', opened_at: new Date(Date.now() - 10800000).toISOString() }
                                ].map((opening) => (
                                    <Card key={opening.id} className="bg-gray-700 border-gray-600">
                                        <CardContent className="p-4">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center space-x-3">
                                                    <div className={`p-2 rounded-lg ${
                                                        opening.rarity === 'common' ? 'bg-gray-600' :
                                                        opening.rarity === 'rare' ? 'bg-blue-600' :
                                                        opening.rarity === 'epic' ? 'bg-purple-600' : 'bg-yellow-600'
                                                    }`}>
                                                        <Gift className="w-5 h-5 text-white" />
                                                    </div>
                                                    <div>
                                                        <p className="text-white font-medium">{opening.user_name}</p>
                                                        <p className="text-sm text-gray-300">{opening.reward_name}</p>
                                                        <div className="flex items-center gap-2 mt-1">
                                                            <Badge variant="outline" className="text-xs">
                                                                {opening.lootbox_type === 'donation' ? 'Донат' : 'Достижение'}
                                                            </Badge>
                                                            <Badge variant={
                                                                opening.rarity === 'common' ? 'default' :
                                                                opening.rarity === 'rare' ? 'secondary' :
                                                                opening.rarity === 'epic' ? 'destructive' : 'outline'
                                                            } className="text-xs">
                                                                {opening.rarity === 'common' ? 'Обычный' :
                                                                 opening.rarity === 'rare' ? 'Редкий' :
                                                                 opening.rarity === 'epic' ? 'Эпический' : 'Легендарный'}
                                                            </Badge>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-xs text-gray-400">
                                                        {new Date(opening.opened_at).toLocaleString()}
                                                    </p>
                                                    <div className="flex items-center gap-1 mt-1">
                                                        <Badge variant="outline" className="text-xs">
                                                            OBS
                                                        </Badge>
                                                        <Check className="w-3 h-3 text-green-400" />
                                                    </div>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        ) : (
                            <Card className="bg-gray-700 border-gray-600">
                                <CardContent className="p-8 text-center">
                                    <Gift className="w-16 h-16 text-gray-500 mx-auto mb-4" />
                                    <h4 className="text-lg font-semibold text-gray-300 mb-2">Пока нет истории открытий</h4>
                                    <p className="text-gray-400 mb-4">Откройте свой первый лутбокс!</p>
                                    <Button className="bg-purple-600 hover:bg-purple-700">
                                        <Gift className="w-4 h-4 mr-2" />
                                        Открыть лутбокс
                                    </Button>
                                </CardContent>
                            </Card>
                        )}
                    </div>
                </TabsContent>
            </Tabs>
            
            {/* Модальное окно с результатом открытия лутбокса */}
            <Dialog open={showResultModal} onOpenChange={setShowResultModal}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Sparkles className="h-5 w-5 text-yellow-500 animate-pulse" />
                            Поздравляем!
                        </DialogTitle>
                        <DialogDescription>
                            Вы получили награду из лутбокса
                        </DialogDescription>
                    </DialogHeader>
                    
                    {lootboxResult && (
                        <div className="space-y-4 py-4">
                            {/* Визуализация редкости */}
                            <div className="flex flex-col items-center justify-center space-y-3">
                                <div className={`text-6xl ${getRarityColor(lootboxResult.rarity)}`}>
                                    {React.createElement(getRewardIcon(lootboxResult.type), { 
                                        className: "w-20 h-20 animate-bounce" 
                                    })}
                                </div>
                                
                                <Badge 
                                    variant="outline" 
                                    className={`text-lg px-4 py-1 ${getRarityColor(lootboxResult.rarity)}`}
                                >
                                    {lootboxResult.rarity?.toUpperCase()}
                                </Badge>
                            </div>
                            
                            {/* Информация о награде */}
                            <div className="bg-muted p-4 rounded-lg space-y-2">
                                <h3 className="font-semibold text-lg text-center">
                                    {lootboxResult.name || 'Неизвестная награда'}
                                </h3>
                                
                                {lootboxResult.description && (
                                    <p className="text-sm text-muted-foreground text-center">
                                        {lootboxResult.description}
                                    </p>
                                )}
                                
                                {lootboxResult.value && (
                                    <div className="flex items-center justify-center gap-2 text-sm">
                                        <Coins className="h-4 w-4 text-yellow-500" />
                                        <span className="font-medium">
                                            {lootboxResult.value} монет
                                        </span>
                                    </div>
                                )}
                            </div>
                            
                            {/* Кнопка закрытия */}
                            <Button 
                                className="w-full" 
                                onClick={() => setShowResultModal(false)}
                            >
                                Отлично!
                            </Button>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default LootboxSystem;
