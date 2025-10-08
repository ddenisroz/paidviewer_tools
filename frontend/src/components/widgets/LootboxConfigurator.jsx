import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';

const LootboxConfigurator = () => {
    const [config, setConfig] = useState({
        width: 400,
        height: 300,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        borderRadius: 8,
        borderColor: '#333',
        borderWidth: 2,
        animationDuration: 2.0,
        showParticles: true,
        showGlow: true,
        soundEnabled: true,
        colors: {
            common: '#9CA3AF',
            rare: '#3B82F6',
            epic: '#8B5CF6',
            legendary: '#F59E0B'
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
            const response = await fetch('/api/widgets/lootbox/config', {
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
            console.error('Error saving config:', error);
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
        a.download = 'lootbox-widget-config.json';
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

    const testAnimation = (rarity) => {
        // Отправляем тестовое событие в iframe
        const iframe = document.querySelector('iframe');
        if (iframe && iframe.contentWindow) {
            iframe.contentWindow.postMessage({
                type: 'test_lootbox',
                data: {
                    username: 'TestUser',
                    rarity: rarity,
                    lootbox_type: rarity
                }
            }, '*');
        }
    };

    return (
        <div className="container mx-auto p-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Настройки */}
                <div className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Настройки виджета лутбокса</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Tabs defaultValue="appearance" className="w-full">
                                <TabsList className="grid w-full grid-cols-3">
                                    <TabsTrigger value="appearance">Внешний вид</TabsTrigger>
                                    <TabsTrigger value="animation">Анимация</TabsTrigger>
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
                                </TabsContent>
                                
                                <TabsContent value="animation" className="space-y-4">
                                    <div>
                                        <Label htmlFor="animationDuration">Длительность анимации (сек)</Label>
                                        <Slider
                                            value={[config.animationDuration]}
                                            onValueChange={([value]) => updateConfig('animationDuration', value)}
                                            max={5}
                                            min={0.5}
                                            step={0.1}
                                            className="w-full"
                                        />
                                        <div className="text-sm text-gray-500 mt-1">
                                            {config.animationDuration}с
                                        </div>
                                    </div>
                                    
                                    <div className="flex items-center space-x-2">
                                        <Switch
                                            id="showParticles"
                                            checked={config.showParticles}
                                            onCheckedChange={(checked) => updateConfig('showParticles', checked)}
                                        />
                                        <Label htmlFor="showParticles">Показывать частицы</Label>
                                    </div>
                                    
                                    <div className="flex items-center space-x-2">
                                        <Switch
                                            id="showGlow"
                                            checked={config.showGlow}
                                            onCheckedChange={(checked) => updateConfig('showGlow', checked)}
                                        />
                                        <Label htmlFor="showGlow">Показывать свечение</Label>
                                    </div>
                                    
                                    <div className="flex items-center space-x-2">
                                        <Switch
                                            id="soundEnabled"
                                            checked={config.soundEnabled}
                                            onCheckedChange={(checked) => updateConfig('soundEnabled', checked)}
                                        />
                                        <Label htmlFor="soundEnabled">Включить звук</Label>
                                    </div>
                                    
                                    <div className="mt-4">
                                        <Label>Тестовые анимации</Label>
                                        <div className="flex gap-2 mt-2">
                                            <Button size="sm" onClick={() => testAnimation('common')}>
                                                Обычный
                                            </Button>
                                            <Button size="sm" onClick={() => testAnimation('rare')}>
                                                Редкий
                                            </Button>
                                            <Button size="sm" onClick={() => testAnimation('epic')}>
                                                Эпический
                                            </Button>
                                            <Button size="sm" onClick={() => testAnimation('legendary')}>
                                                Легендарный
                                            </Button>
                                        </div>
                                    </div>
                                </TabsContent>
                                
                                <TabsContent value="colors" className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <Label>Обычный</Label>
                                            <Input
                                                type="color"
                                                value={config.colors.common}
                                                onChange={(e) => updateNestedConfig('colors', 'common', e.target.value)}
                                                className="w-full h-10"
                                            />
                                        </div>
                                        <div>
                                            <Label>Редкий</Label>
                                            <Input
                                                type="color"
                                                value={config.colors.rare}
                                                onChange={(e) => updateNestedConfig('colors', 'rare', e.target.value)}
                                                className="w-full h-10"
                                            />
                                        </div>
                                        <div>
                                            <Label>Эпический</Label>
                                            <Input
                                                type="color"
                                                value={config.colors.epic}
                                                onChange={(e) => updateNestedConfig('colors', 'epic', e.target.value)}
                                                className="w-full h-10"
                                            />
                                        </div>
                                        <div>
                                            <Label>Легендарный</Label>
                                            <Input
                                                type="color"
                                                value={config.colors.legendary}
                                                onChange={(e) => updateNestedConfig('colors', 'legendary', e.target.value)}
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

export default LootboxConfigurator;
