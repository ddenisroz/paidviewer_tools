// src/components/widgets/ChatConfigurator.tsx
import React, { useState } from 'react';

import { chatboxService } from '@/services/api/services/chatboxService';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { Slider } from '@/shared/components/ui/slider';
import { Switch } from '@/shared/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/shared/components/ui/tabs';
import { toast } from '@/utils/toastManager';

interface WidgetConfig {
    width: number;
    height: number;
    backgroundColor: string;
    backgroundImage: string;
    borderRadius: number;
    borderColor: string;
    borderWidth: number;
    messageBg: string;
    messageBorderRadius: number;
    messageMargin: number;
    messagePadding: number;
    fontFamily: string;
    fontSize: number;
    fontWeight: string;
    textColor: string;
    animationDuration: number;
    animationType: string;
    maxMessages: number;
    showTimestamps: boolean;
    showUserRoles: boolean;
    platforms: {
        twitch: boolean;
        vk: boolean;
        combined: boolean;
    };
    platformFilter: string;
    colors: {
        moderator: string;
        vip: string;
        subscriber: string;
        normal: string;
    };
}

const ChatConfigurator: React.FC = () => {
    const [config, setConfig] = useState<WidgetConfig>({
        width: 400,
        height: 300,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        backgroundImage: 'none',
        borderRadius: 8,
        borderColor: '#333',
        borderWidth: 2,
        messageBg: 'rgba(255, 255, 255, 0.1)',
        messageBorderRadius: 4,
        messageMargin: 4,
        messagePadding: 8,
        fontFamily: 'Arial, sans-serif',
        fontSize: 14,
        fontWeight: 'normal',
        textColor: '#ffffff',
        animationDuration: 0.3,
        animationType: 'slide-in',
        maxMessages: 50,
        showTimestamps: false,
        showUserRoles: true,
        platforms: {
            twitch: true,
            vk: true,
            combined: true,
        },
        platformFilter: 'combined', // 'twitch', 'vk', 'combined'
        colors: {
            moderator: '#00ff00',
            vip: '#ff6b6b',
            subscriber: '#4ecdc4',
            normal: '#ffffff',
        },
    });

    const [previewUrl, setPreviewUrl] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const updateConfig = (key: keyof WidgetConfig, value: unknown) => {
        setConfig((prev) => ({
            ...prev,
            [key]: value,
        }));
    };

    const updateNestedConfig = (parent: 'platforms' | 'colors', key: string, value: unknown) => {
        setConfig((prev) => ({
            ...prev,
            [parent]: {
                ...prev[parent],
                [key]: value,
            },
        }));
    };

    const saveConfig = async () => {
        setIsLoading(true);
        try {
            const response = await chatboxService.saveWidgetConfig(config as unknown as Record<string, unknown>);
            const responseData = response.data as { data?: { url?: string }; url?: string };
            const data = responseData.data || responseData;
            // URL теперь включает user_id
            setPreviewUrl(data.url || '');
            toast.success('Конфигурация сохранена');
        } catch {
            toast.error('Ошибка при сохранении конфигурации');
        } finally {
            setIsLoading(false);
        }
    };

    const exportConfig = () => {
        const configJson = JSON.stringify(config, null, 2);
        const blob = new Blob([configJson], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'chat-widget-config.json';
        a.click();
        URL.revokeObjectURL(url);
    };

    const importConfig = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const importedConfig = JSON.parse(e.target?.result as string) as WidgetConfig;
                    setConfig(importedConfig);
                } catch {
                    toast.error('Ошибка при импорте конфигурации');
                }
            };
            reader.readAsText(file);
        }
    };

    return (
        <div className="container mx-auto p-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Настройки */}
                <div className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Настройки виджета чата</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Tabs defaultValue="appearance" className="w-full">
                                <TabsList className="grid w-full grid-cols-3">
                                    <TabsTrigger value="appearance">Внешний вид</TabsTrigger>
                                    <TabsTrigger value="messages">Сообщения</TabsTrigger>
                                    <TabsTrigger value="colors">Цвета</TabsTrigger>
                                </TabsList>

                                <TabsContent value="appearance" className="space-y-4">
                                    <div className="space-y-5">
                                        <div>
                                            <h4 className="text-sm font-medium mb-3 text-muted-foreground">Размеры</h4>
                                            <div className="space-y-4">
                                                <div className="space-y-2">
                                                    <div className="flex items-center justify-between">
                                                        <Label htmlFor="width" className="text-sm">
                                                            Ширина
                                                        </Label>
                                                        <span className="text-sm text-muted-foreground font-mono">
                                                            {config.width}px
                                                        </span>
                                                    </div>
                                                    <Slider
                                                        id="width"
                                                        value={[config.width]}
                                                        onValueChange={([value]) => updateConfig('width', value)}
                                                        min={200}
                                                        max={1200}
                                                        step={10}
                                                    />
                                                    <div className="flex justify-between text-xs text-muted-foreground/60">
                                                        <span>200</span>
                                                        <span>1200</span>
                                                    </div>
                                                </div>

                                                <div className="space-y-2">
                                                    <div className="flex items-center justify-between">
                                                        <Label htmlFor="height" className="text-sm">
                                                            Высота
                                                        </Label>
                                                        <span className="text-sm text-muted-foreground font-mono">
                                                            {config.height}px
                                                        </span>
                                                    </div>
                                                    <Slider
                                                        id="height"
                                                        value={[config.height]}
                                                        onValueChange={([value]) => updateConfig('height', value)}
                                                        min={100}
                                                        max={800}
                                                        step={10}
                                                    />
                                                    <div className="flex justify-between text-xs text-muted-foreground/60">
                                                        <span>100</span>
                                                        <span>800</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div>
                                        <Label htmlFor="backgroundColor">Цвет фона</Label>
                                        <Input
                                            id="backgroundColor"
                                            type="text"
                                            value={config.backgroundColor}
                                            onChange={(e) => updateConfig('backgroundColor', e.target.value)}
                                            placeholder="rgba(0, 0, 0, 0.8)"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <Label htmlFor="borderRadius" className="text-sm">
                                                Скругление углов
                                            </Label>
                                            <span className="text-sm text-muted-foreground font-mono">
                                                {config.borderRadius}px
                                            </span>
                                        </div>
                                        <Slider
                                            id="borderRadius"
                                            value={[config.borderRadius]}
                                            onValueChange={([value]) => updateConfig('borderRadius', value)}
                                            min={0}
                                            max={20}
                                            step={1}
                                        />
                                        <div className="flex justify-between text-xs text-muted-foreground/60">
                                            <span>0</span>
                                            <span>20</span>
                                        </div>
                                    </div>

                                    <div>
                                        <Label htmlFor="fontFamily">Шрифт</Label>
                                        <Select
                                            value={config.fontFamily}
                                            onValueChange={(value) => updateConfig('fontFamily', value)}
                                        >
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="Arial, sans-serif">Arial</SelectItem>
                                                <SelectItem value="Helvetica, sans-serif">Helvetica</SelectItem>
                                                <SelectItem value="Georgia, serif">Georgia</SelectItem>
                                                <SelectItem value="Times New Roman, serif">Times New Roman</SelectItem>
                                                <SelectItem value="Courier New, monospace">Courier New</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <Label htmlFor="fontSize" className="text-sm">
                                                Размер шрифта
                                            </Label>
                                            <span className="text-sm text-muted-foreground font-mono">
                                                {config.fontSize}px
                                            </span>
                                        </div>
                                        <Slider
                                            id="fontSize"
                                            value={[config.fontSize]}
                                            onValueChange={([value]) => updateConfig('fontSize', value)}
                                            min={8}
                                            max={24}
                                            step={1}
                                        />
                                        <div className="flex justify-between text-xs text-muted-foreground/60">
                                            <span>8</span>
                                            <span>24</span>
                                        </div>
                                    </div>
                                </TabsContent>

                                <TabsContent value="messages" className="space-y-4">
                                    <div>
                                        <div className="flex items-center justify-between">
                                            <Label htmlFor="maxMessages" className="text-sm">
                                                Максимум сообщений
                                            </Label>
                                            <span className="text-sm text-muted-foreground font-mono">
                                                {config.maxMessages}
                                            </span>
                                        </div>
                                        <Slider
                                            id="maxMessages"
                                            value={[config.maxMessages]}
                                            onValueChange={([value]) => updateConfig('maxMessages', value)}
                                            min={10}
                                            max={100}
                                            step={5}
                                        />
                                        <div className="flex justify-between text-xs text-muted-foreground/60">
                                            <span>10</span>
                                            <span>100</span>
                                        </div>
                                    </div>

                                    <div>
                                        <Label>Платформы чата</Label>
                                        <div className="space-y-2 mt-2">
                                            <div className="flex items-center space-x-2">
                                                <Switch
                                                    id="platform-twitch"
                                                    checked={config.platforms.twitch}
                                                    onCheckedChange={(checked) =>
                                                        updateNestedConfig('platforms', 'twitch', checked)
                                                    }
                                                />
                                                <Label htmlFor="platform-twitch">Twitch</Label>
                                            </div>
                                            <div className="flex items-center space-x-2">
                                                <Switch
                                                    id="platform-vk"
                                                    checked={config.platforms.vk}
                                                    onCheckedChange={(checked) =>
                                                        updateNestedConfig('platforms', 'vk', checked)
                                                    }
                                                />
                                                <Label htmlFor="platform-vk">VK Live</Label>
                                            </div>
                                            <div className="flex items-center space-x-2">
                                                <Switch
                                                    id="platform-combined"
                                                    checked={config.platforms.combined}
                                                    onCheckedChange={(checked) =>
                                                        updateNestedConfig('platforms', 'combined', checked)
                                                    }
                                                />
                                                <Label htmlFor="platform-combined">Объединенный</Label>
                                            </div>
                                        </div>
                                    </div>

                                    <div>
                                        <Label htmlFor="platformFilter">Фильтр платформ</Label>
                                        <Select
                                            value={config.platformFilter}
                                            onValueChange={(value) => updateConfig('platformFilter', value)}
                                        >
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="twitch">Только Twitch</SelectItem>
                                                <SelectItem value="vk">Только VK Live</SelectItem>
                                                <SelectItem value="combined">Объединенный</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div>
                                        <Label htmlFor="animationType">Тип анимации</Label>
                                        <Select
                                            value={config.animationType}
                                            onValueChange={(value) => updateConfig('animationType', value)}
                                        >
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="slide-in">Слайд</SelectItem>
                                                <SelectItem value="fade-in">Появление</SelectItem>
                                                <SelectItem value="bounce-in">Отскок</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div>
                                        <div className="flex items-center justify-between">
                                            <Label htmlFor="animationDuration" className="text-sm">
                                                Скорость анимации
                                            </Label>
                                            <span className="text-sm text-muted-foreground font-mono">
                                                {config.animationDuration.toFixed(1)}с
                                            </span>
                                        </div>
                                        <Slider
                                            id="animationDuration"
                                            value={[config.animationDuration]}
                                            onValueChange={([value]) => updateConfig('animationDuration', value)}
                                            min={0.1}
                                            max={2}
                                            step={0.1}
                                        />
                                        <div className="flex justify-between text-xs text-muted-foreground/60">
                                            <span>0.1</span>
                                            <span>2.0</span>
                                        </div>
                                    </div>

                                    <div className="flex items-center space-x-2">
                                        <Switch
                                            id="showTimestamps"
                                            checked={config.showTimestamps}
                                            onCheckedChange={(checked) => updateConfig('showTimestamps', checked)}
                                        />
                                        <Label htmlFor="showTimestamps">Показывать время</Label>
                                    </div>

                                    <div className="flex items-center space-x-2">
                                        <Switch
                                            id="showUserRoles"
                                            checked={config.showUserRoles}
                                            onCheckedChange={(checked) => updateConfig('showUserRoles', checked)}
                                        />
                                        <Label htmlFor="showUserRoles">Показывать роли</Label>
                                    </div>
                                </TabsContent>

                                <TabsContent value="colors" className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <Label>Модератор</Label>
                                            <Input
                                                type="color"
                                                value={config.colors.moderator}
                                                onChange={(e) =>
                                                    updateNestedConfig('colors', 'moderator', e.target.value)
                                                }
                                                className="w-full h-10"
                                            />
                                        </div>
                                        <div>
                                            <Label>VIP</Label>
                                            <Input
                                                type="color"
                                                value={config.colors.vip}
                                                onChange={(e) => updateNestedConfig('colors', 'vip', e.target.value)}
                                                className="w-full h-10"
                                            />
                                        </div>
                                        <div>
                                            <Label>Подписчик</Label>
                                            <Input
                                                type="color"
                                                value={config.colors.subscriber}
                                                onChange={(e) =>
                                                    updateNestedConfig('colors', 'subscriber', e.target.value)
                                                }
                                                className="w-full h-10"
                                            />
                                        </div>
                                        <div>
                                            <Label>Обычный</Label>
                                            <Input
                                                type="color"
                                                value={config.colors.normal}
                                                onChange={(e) => updateNestedConfig('colors', 'normal', e.target.value)}
                                                className="w-full h-10"
                                            />
                                        </div>
                                    </div>
                                </TabsContent>
                            </Tabs>
                        </CardContent>
                    </Card>

                    <div className="flex space-x-2">
                        <Button onClick={saveConfig} disabled={isLoading}>
                            {isLoading ? 'Сохранение...' : 'Сохранить'}
                        </Button>
                        <Button onClick={exportConfig} variant="outline">
                            Экспорт
                        </Button>
                        <Button onClick={() => document.getElementById('import')?.click()} variant="outline">
                            Импорт
                        </Button>
                        <input id="import" type="file" accept=".json" onChange={importConfig} className="hidden" />
                    </div>
                </div>

                {/* Предварительный просмотр */}
                <div>
                    <Card>
                        <CardHeader>
                            <CardTitle>Предварительный просмотр</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {previewUrl ? (
                                <iframe
                                    src={previewUrl}
                                    width="100%"
                                    height="400"
                                    className="border rounded"
                                    title="Chat Widget Preview"
                                />
                            ) : (
                                <div className="text-center text-gray-500 py-8">
                                    Сохраните конфигурацию для предварительного просмотра
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <Card className="mt-4">
                        <CardHeader>
                            <CardTitle>Инструкция для OBS</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-2 text-sm">
                                <p>
                                    1. Добавьте <strong>Browser Source</strong> в OBS
                                </p>
                                <p>
                                    2. URL:{' '}
                                    <code className="bg-gray-100 px-1 rounded">
                                        {previewUrl || 'URL появится после сохранения'}
                                    </code>
                                </p>
                                <p>
                                    3. Ширина: <code className="bg-gray-100 px-1 rounded">{config.width}px</code>
                                </p>
                                <p>
                                    4. Высота: <code className="bg-gray-100 px-1 rounded">{config.height}px</code>
                                </p>
                                <p>5. Включите "Shutdown source when not visible"</p>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
};

export default ChatConfigurator;
