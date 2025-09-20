import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { Slider } from './ui/slider';
import { Separator } from './ui/separator';
import { Badge } from './ui/badge';
import { Settings, Save, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { getTtsConfig, updateTtsConfig } from '../services/microservices';

const TtsConfigPanel = () => {
    const [config, setConfig] = useState({
        cfg_strength: 2.0,
        target_rms: 0.4,
        cross_fade_duration: 0.15,
        silence_duration_ms: 100,
        sway_sampling_coef: -1.0
    });
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        loadConfig();
    }, []);

    const loadConfig = async () => {
        try {
            setLoading(true);
            const response = await getTtsConfig();
            setConfig(response.data);
        } catch (error) {
            toast.error('Ошибка загрузки настроек TTS');
            console.error('Error loading TTS config:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        try {
            setSaving(true);
            await updateTtsConfig({
                cfg_strength: config.cfg_strength,
                target_rms: config.target_rms
            });
            toast.success('Настройки TTS сохранены');
        } catch (error) {
            toast.error('Ошибка сохранения настроек TTS');
            console.error('Error saving TTS config:', error);
        } finally {
            setSaving(false);
        }
    };

    const handleReset = () => {
        setConfig(prev => ({
            ...prev,
            cfg_strength: 2.0,
            target_rms: 0.4
        }));
    };

    const handleSliderChange = (value, key) => {
        setConfig(prev => ({
            ...prev,
            [key]: value[0]
        }));
    };

    if (loading) {
        return (
            <Card>
                <CardContent className="p-6">
                    <div className="flex items-center justify-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                        <span className="ml-2">Загрузка настроек...</span>
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Settings className="h-5 w-5" />
                    Настройки TTS
                </CardTitle>
                <CardDescription>
                    Управление параметрами синтеза речи F5-TTS
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                {/* Настраиваемые параметры */}
                <div className="space-y-4">
                    <h4 className="text-sm font-medium text-green-600">Настраиваемые параметры</h4>
                    
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label htmlFor="cfg-strength">CFG Strength</Label>
                                <Badge variant="outline">{config.cfg_strength.toFixed(1)}</Badge>
                            </div>
                            <Slider
                                id="cfg-strength"
                                value={[config.cfg_strength]}
                                onValueChange={(v) => handleSliderChange(v, 'cfg_strength')}
                                min={0.1}
                                max={10.0}
                                step={0.1}
                                className="w-full"
                            />
                            <p className="text-xs text-muted-foreground">
                                Контролирует качество синтеза (0.1-10.0)
                            </p>
                        </div>

                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label htmlFor="target-rms">Target RMS</Label>
                                <Badge variant="outline">{config.target_rms.toFixed(2)}</Badge>
                            </div>
                            <Slider
                                id="target-rms"
                                value={[config.target_rms]}
                                onValueChange={(v) => handleSliderChange(v, 'target_rms')}
                                min={0.01}
                                max={1.0}
                                step={0.01}
                                className="w-full"
                            />
                            <p className="text-xs text-muted-foreground">
                                Нормализация громкости (0.01-1.0)
                            </p>
                        </div>
                    </div>
                </div>

                <Separator />

                {/* Фиксированные параметры */}
                <div className="space-y-4">
                    <h4 className="text-sm font-medium text-gray-500">Фиксированные параметры</h4>
                    
                    <div className="grid grid-cols-2 gap-4 text-sm">
                        <div className="space-y-1">
                            <Label className="text-muted-foreground">Cross Fade Duration</Label>
                            <Badge variant="secondary">{config.cross_fade_duration}s</Badge>
                        </div>
                        <div className="space-y-1">
                            <Label className="text-muted-foreground">Silence Duration</Label>
                            <Badge variant="secondary">{config.silence_duration_ms}ms</Badge>
                        </div>
                        <div className="space-y-1">
                            <Label className="text-muted-foreground">Sway Sampling Coef</Label>
                            <Badge variant="secondary">{config.sway_sampling_coef}</Badge>
                        </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                        Эти параметры зафиксированы и не могут быть изменены
                    </p>
                </div>

                <Separator />

                {/* Кнопки управления */}
                <div className="flex gap-2">
                    <Button 
                        onClick={handleSave} 
                        disabled={saving}
                        className="flex-1"
                    >
                        <Save className="h-4 w-4 mr-2" />
                        {saving ? 'Сохранение...' : 'Сохранить'}
                    </Button>
                    <Button 
                        onClick={handleReset} 
                        variant="outline"
                        disabled={saving}
                    >
                        <RotateCcw className="h-4 w-4 mr-2" />
                        Сброс
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
};

export default TtsConfigPanel;
