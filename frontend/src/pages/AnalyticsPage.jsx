import React from 'react';
import { Card, CardContent } from '@/components/ui/card';

const AnalyticsPage = () => {
    return (
        <div className="container mx-auto p-6 space-y-8">
            <div className="text-center space-y-6">
                {/* Огромный эмодзи и текст */}
                <div className="space-y-4">
                    <div className="text-9xl">😔</div>
                    <h1 className="text-6xl font-bold text-muted-foreground">
                        В разработке
                    </h1>
                    <p className="text-2xl text-muted-foreground max-w-2xl mx-auto">
                        Раздел анализа и модерации чата находится в активной разработке
                    </p>
                </div>

                {/* Планируемые функции */}
                <Card className="max-w-4xl mx-auto">
                    <CardContent className="p-8">
                        <div className="text-center mb-6">
                            <h2 className="text-2xl font-bold mb-2">Скоро в релизе</h2>
                            <p className="text-muted-foreground">
                                Планируемые функции для анализа и модерации чата
                            </p>
                        </div>
                        
                        <div className="mt-6 text-center">
                            <p className="text-sm text-muted-foreground">
                                Планируемые функции:
                            </p>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4 text-sm">
                                <div className="p-3 bg-muted rounded-lg">
                                    <div className="font-semibold">👤 Анализ поведения пользователя</div>
                                    <div className="text-muted-foreground">Паттерны активности и поведения в чате</div>
                                </div>
                                <div className="p-3 bg-muted rounded-lg">
                                    <div className="font-semibold">📢 Распознавание рекламных сообщений</div>
                                    <div className="text-muted-foreground">Автоматическое выявление спама и рекламы</div>
                                </div>
                                <div className="p-3 bg-muted rounded-lg">
                                    <div className="font-semibold">🔗 Модерация вредоносных ссылок</div>
                                    <div className="text-muted-foreground">Проверка и блокировка опасных URL</div>
                                </div>
                                <div className="p-3 bg-muted rounded-lg">
                                    <div className="font-semibold">🎮 Автоматическая смена категории</div>
                                    <div className="text-muted-foreground">Определение игры и смена категории стрима</div>
                                </div>
                                <div className="p-3 bg-muted rounded-lg">
                                    <div className="font-semibold">🏆 Интеграция с аукционами</div>
                                    <div className="text-muted-foreground">Управление донатными аукционами и лотами</div>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

export default AnalyticsPage;
