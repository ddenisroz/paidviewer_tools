import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { logger } from '../../utils/prodLogger';

const ChatConfigurator = () => {
    const [config, setConfig] = useState({
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
            combined: true
        },
        platformFilter: 'combined', // 'twitch', 'vk', 'combined'
        colors: {
            moderator: '#00ff00',
            vip: '#ff6b6b',
            subscriber: '#4ecdc4',
            normal: '#ffffff'
        }
    });

    const [previewUrl, setPreviewUrl] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const updateConfig = (key, value) => {
        setConfig(prev => ({
            ...prev,
            [key]: value
        }));
    };

    const updateNestedConfig = (parent, key, value) => {
        setConfig(prev => ({
            ...prev,
            [parent]: {
                ...prev[parent],
                [key]: value
            }
        }));
    };

    const saveConfig = async () => {
        setIsLoading(true);
        try {
            const response = await fetch('/api/widgets/chat/config', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(config)
            });
            
            const result = await response.json();
            // URL теперь включает user_id
            setPreviewUrl(result.url);
            alert('Конфигурация сохранена!');
        } catch (error) {
            logger.error('Error saving config:', error);
            alert('Ошибка при сохранении конфигурации');
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

    const importConfig = (event) => {
        const file = event.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const importedConfig = JSON.parse(e.target.result);
                    setConfig(importedConfig);
                } catch (error) {
                    alert('Ошибка при импорте конфигурации');
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
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <Label htmlFor="width">Ширина (px)</Label>
                                            <Input
                                                id="width"
                                                type="number"
                                                value={config.width}
                                                onChange={(e) => updateConfig('width', parseInt(e.target.value))}
                                            />
                                        </div>
                                        <div>
                                            <Label htmlFor="height">Высота (px)</Label>
                                            <Input
                                                id="height"
                                                type="number"
                                                value={config.height}
                                                onChange={(e) => updateConfig('height', parseInt(e.target.value))}
                                            />
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
                                    
                                    <div>
                                        <Label htmlFor="borderRadius">Скругление углов (px)</Label>
                                        <Slider
                                            value={[config.borderRadius]}
                                            onValueChange={([value]) => updateConfig('borderRadius', value)}
                                            max={20}
                                            step={1}
                                            className="w-full"
                                        />
                                        <div className="text-sm text-gray-500 mt-1">
                                            {config.borderRadius}px
                                        </div>
                                    </div>
                                    
                                    <div>
                                        <Label htmlFor="fontFamily">Шрифт</Label>
                                        <Select value={config.fontFamily} onValueChange={(value) => updateConfig('fontFamily', value)}>
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
                                    
                                    <div>
                                        <Label htmlFor="fontSize">Размер шрифта (px)</Label>
                                        <Slider
                                            value={[config.fontSize]}
                                            onValueChange={([value]) => updateConfig('fontSize', value)}
                                            max={24}
                                            min={8}
                                            step={1}
                                            className="w-full"
                                        />
                                        <div className="text-sm text-gray-500 mt-1">
                                            {config.fontSize}px
                                        </div>
                                    </div>
                                </TabsContent>
                                
                                        <TabsContent value="messages" className="space-y-4">
                                            <div>
                                                <Label htmlFor="maxMessages">Максимум сообщений</Label>
                                                <Slider
                                                    value={[config.maxMessages]}
                                                    onValueChange={([value]) => updateConfig('maxMessages', value)}
                                                    max={100}
                                                    step={5}
                                                    className="w-full"
                                                />
                                                <div className="text-sm text-gray-500 mt-1">
                                                    {config.maxMessages} сообщений
                                                </div>
                                            </div>
                                            
                                            <div>
                                                <Label>Платформы чата</Label>
                                                <div className="space-y-2 mt-2">
                                                    <div className="flex items-center space-x-2">
                                                        <Switch
                                                            id="platform-twitch"
                                                            checked={config.platforms.twitch}
                                                            onCheckedChange={(checked) => updateNestedConfig('platforms', 'twitch', checked)}
                                                        />
                                                        <Label htmlFor="platform-twitch">Twitch</Label>
                                                    </div>
                                                    <div className="flex items-center space-x-2">
                                                        <Switch
                                                            id="platform-vk"
                                                            checked={config.platforms.vk}
                                                            onCheckedChange={(checked) => updateNestedConfig('platforms', 'vk', checked)}
                                                        />
                                                        <Label htmlFor="platform-vk">VK Live</Label>
                                                    </div>
                                                    <div className="flex items-center space-x-2">
                                                        <Switch
                                                            id="platform-combined"
                                                            checked={config.platforms.combined}
                                                            onCheckedChange={(checked) => updateNestedConfig('platforms', 'combined', checked)}
                                                        />
                                                        <Label htmlFor="platform-combined">Объединенный</Label>
                                                    </div>
                                                </div>
                                            </div>
                                            
                                            <div>
                                                <Label htmlFor="platformFilter">Фильтр платформ</Label>
                                                <Select value={config.platformFilter} onValueChange={(value) => updateConfig('platformFilter', value)}>
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
                                        <Select value={config.animationType} onValueChange={(value) => updateConfig('animationType', value)}>
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
                                        <Label htmlFor="animationDuration">Скорость анимации (сек)</Label>
                                        <Slider
                                            value={[config.animationDuration]}
                                            onValueChange={([value]) => updateConfig('animationDuration', value)}
                                            max={2}
                                            min={0.1}
                                            step={0.1}
                                            className="w-full"
                                        />
                                        <div className="text-sm text-gray-500 mt-1">
                                            {config.animationDuration}с
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
                                                onChange={(e) => updateNestedConfig('colors', 'moderator', e.target.value)}
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
                                                onChange={(e) => updateNestedConfig('colors', 'subscriber', e.target.value)}
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
                        <Button onClick={() => document.getElementById('import').click()} variant="outline">
                            Импорт
                        </Button>
                        <input
                            id="import"
                            type="file"
                            accept=".json"
                            onChange={importConfig}
                            className="hidden"
                        />
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
                                <p>1. Добавьте <strong>Browser Source</strong> в OBS</p>
                                <p>2. URL: <code className="bg-gray-100 px-1 rounded">{previewUrl || 'URL появится после сохранения'}</code></p>
                                <p>3. Ширина: <code className="bg-gray-100 px-1 rounded">{config.width}px</code></p>
                                <p>4. Высота: <code className="bg-gray-100 px-1 rounded">{config.height}px</code></p>
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
