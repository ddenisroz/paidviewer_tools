// src/components/chat/ChatSettings.tsx
import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Settings, MessageCircle, Copy } from 'lucide-react';
import { toast } from 'sonner';

interface ObsSettings {
    width: number;
    height: number;
    fontFamily: string;
    fontSize: number;
    backgroundColor: string;
    textColor: string;
}

interface ChatSettingsProps {
    showObsSettings: boolean;
    setShowObsSettings: (show: boolean) => void;
    obsSettings: ObsSettings;
    setObsSettings: React.Dispatch<React.SetStateAction<ObsSettings>>;
    twitchEnabled: boolean;
    vkEnabled: boolean;
    generateObsUrl: () => string;
}

const ChatSettings: React.FC<ChatSettingsProps> = ({
    showObsSettings,
    setShowObsSettings,
    obsSettings,
    setObsSettings,
    generateObsUrl
}) => {
    if (!showObsSettings) {
        return null;
    }

    return (
        <Card>
            <CardHeader>
                <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                        <Settings className="h-6 w-6" />
                        Настройки виджета чата для OBS
                    </CardTitle>
                    <Button
                        variant="default"
                        size="sm"
                        onClick={() => setShowObsSettings(false)}
                        className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-4 py-2"
                    >
                        ← Назад
                    </Button>
                </div>
            </CardHeader>
            <CardContent className="space-y-6">
                {/* Размеры */}
                <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Размеры</h3>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Ширина (px)</Label>
                            <input
                                type="number"
                                value={obsSettings.width}
                                onChange={(e) => setObsSettings(prev => ({
                                    ...prev,
                                    width: parseInt(e.target.value) || 400
                                }))}
                                className="w-full px-3 py-2 border border-gray-600 rounded-md bg-gray-800 text-white"
                                min="200"
                                max="1920"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Высота (px)</Label>
                            <input
                                type="number"
                                value={obsSettings.height}
                                onChange={(e) => setObsSettings(prev => ({
                                    ...prev,
                                    height: parseInt(e.target.value) || 600
                                }))}
                                className="w-full px-3 py-2 border border-gray-600 rounded-md bg-gray-800 text-white"
                                min="200"
                                max="1080"
                            />
                        </div>
                    </div>
                </div>

                <Separator />

                {/* Внешний вид */}
                <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Внешний вид</h3>
                    
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Шрифт</Label>
                            <select
                                value={obsSettings.fontFamily}
                                onChange={(e) => setObsSettings(prev => ({
                                    ...prev,
                                    fontFamily: e.target.value
                                }))}
                                className="w-full px-3 py-2 border border-gray-600 rounded-md bg-gray-800 text-white"
                            >
                                <option value="Arial">Arial</option>
                                <option value="Helvetica">Helvetica</option>
                                <option value="Times New Roman">Times New Roman</option>
                                <option value="Courier New">Courier New</option>
                                <option value="Verdana">Verdana</option>
                                <option value="Georgia">Georgia</option>
                            </select>
                        </div>
                        
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label>Размер шрифта</Label>
                                <span className="text-sm text-muted-foreground">{obsSettings.fontSize}px</span>
                            </div>
                            <input
                                type="range"
                                min="10"
                                max="48"
                                value={obsSettings.fontSize}
                                onChange={(e) => setObsSettings(prev => ({
                                    ...prev,
                                    fontSize: parseInt(e.target.value)
                                }))}
                                className="w-full"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Цвет фона</Label>
                            <input
                                type="color"
                                value={obsSettings.backgroundColor}
                                onChange={(e) => setObsSettings(prev => ({
                                    ...prev,
                                    backgroundColor: e.target.value
                                }))}
                                className="w-full h-10 border border-gray-600 rounded-md bg-gray-800"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Цвет текста</Label>
                            <input
                                type="color"
                                value={obsSettings.textColor}
                                onChange={(e) => setObsSettings(prev => ({
                                    ...prev,
                                    textColor: e.target.value
                                }))}
                                className="w-full h-10 border border-gray-600 rounded-md bg-gray-800"
                            />
                        </div>
                    </div>
                </div>

                <Separator />

                {/* URL для OBS */}
                <div className="space-y-4">
                    <h3 className="text-lg font-semibold">URL для OBS</h3>
                    
                    {/* Универсальный URL с автоматической фильтрацией */}
                    <div className="space-y-2 p-3 border rounded-lg bg-blue-500/10">
                        <div className="flex items-center gap-2 mb-2">
                            <MessageCircle className="h-4 w-4 text-blue-500" />
                            <span className="font-medium text-sm">Универсальный чат</span>
                            <span className="text-xs text-muted-foreground">
                                (автоматически фильтрует по включенным платформам)
                            </span>
                        </div>
                        <div className="flex gap-2">
                            <Button
                                size="sm"
                                onClick={() => {
                                    const url = generateObsUrl();
                                    navigator.clipboard.writeText(url);
                                    toast.success('URL скопирован в буфер обмена');
                                }}
                            >
                                <Copy className="h-4 w-4 mr-1" />
                                Сгенерировать и скопировать URL
                            </Button>
                        </div>
                        <div className="text-xs text-muted-foreground italic">
                            Нажмите кнопку выше чтобы сгенерировать URL с текущими настройками
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};

export default ChatSettings;

