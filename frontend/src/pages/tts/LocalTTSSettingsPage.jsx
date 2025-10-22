import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
    Server, 
    Home, 
    CheckCircle, 
    XCircle, 
    AlertCircle,
    RefreshCw,
    Save,
    Trash2,
    ExternalLink,
    Download,
    Search,
    Zap
} from 'lucide-react';
import { toast } from 'sonner';
import { API_BASE_URL } from '../../constants';

const LocalTTSSettingsPage = () => {
    const [config, setConfig] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [testing, setTesting] = useState(false);
    const [autoSearching, setAutoSearching] = useState(false);
    const [downloading, setDownloading] = useState(false);
    
    const [formData, setFormData] = useState({
        endpoint_url: 'http://localhost:8001',
        api_key: '',
        use_local: false
    });

    // Загрузка конфигурации
    const loadConfig = async () => {
        try {
            setLoading(true);
            const response = await fetch(`${API_BASE_URL}/api/local-tts/config`, {
                credentials: 'include'
            });
            
            if (response.ok) {
                const data = await response.json();
                if (data.success && data.config) {
                    setConfig(data.config);
                    setFormData({
                        endpoint_url: data.config.endpoint_url,
                        api_key: '',
                        use_local: data.config.use_local
                    });
                }
            }
        } catch (error) {
            console.error('Error loading local TTS config:', error);
            toast.error('Ошибка загрузки конфигурации');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadConfig();
    }, []);

    // Автопоиск локального TTS
    const autoSearchTTS = async () => {
        try {
            setAutoSearching(true);
            
            // Пробуем стандартные порты
            const ports = [8001, 8002, 8003, 8004, 8005];
            const foundEndpoints = [];
            
            for (const port of ports) {
                try {
                    const response = await fetch(`http://localhost:${port}/health`, {
                        method: 'GET',
                        timeout: 2000
                    });
                    
                    if (response.ok) {
                        const data = await response.json();
                        if (data.status === 'healthy') {
                            foundEndpoints.push({
                                url: `http://localhost:${port}`,
                                version: data.version,
                                gpu: data.gpu_info?.name || 'Unknown'
                            });
                        }
                    }
                } catch (error) {
                    // Порт недоступен, продолжаем поиск
                }
            }
            
            if (foundEndpoints.length > 0) {
                const endpoint = foundEndpoints[0]; // Берем первый найденный
                setFormData(prev => ({
                    ...prev,
                    endpoint_url: endpoint.url
                }));
                
                toast.success('Локальный TTS найден!', {
                    description: `${endpoint.gpu} - ${endpoint.url}`
                });
                
                // Автоматически тестируем подключение
                await testConnection();
            } else {
                toast.info('Локальный TTS не найден', {
                    description: 'Скачайте и установите TTS F5 Simple'
                });
            }
        } catch (error) {
            console.error('Error auto-searching TTS:', error);
            toast.error('Ошибка автопоиска');
        } finally {
            setAutoSearching(false);
        }
    };

    // Скачивание TTS F5 Simple
    const downloadTTSF5Simple = async () => {
        try {
            setDownloading(true);
            
            // Создаем ссылку для скачивания
            const downloadUrl = `${API_BASE_URL}/api/local-tts/download-simple`;
            
            // Открываем ссылку в новом окне
            window.open(downloadUrl, '_blank');
            
            toast.success('Скачивание началось!', {
                description: 'Следуйте инструкциям в скачанном архиве'
            });
            
        } catch (error) {
            console.error('Error downloading TTS F5 Simple:', error);
            toast.error('Ошибка скачивания');
        } finally {
            setDownloading(false);
        }
    };

    // Тест подключения
    const testConnection = async () => {
        if (!formData.endpoint_url) {
            toast.error('Укажите URL локального TTS');
            return;
        }

        try {
            setTesting(true);
            const response = await fetch(`${API_BASE_URL}/api/local-tts/test-connection`, {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    endpoint_url: formData.endpoint_url,
                    api_key: formData.api_key || null
                })
            });

            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    toast.success('Подключение успешно!', {
                        description: `Версия: ${data.version || 'N/A'}`
                    });
                } else {
                    toast.error('Не удалось подключиться', {
                        description: data.message
                    });
                }
            } else {
                toast.error('Ошибка тестирования подключения');
            }
        } catch (error) {
            console.error('Error testing connection:', error);
            toast.error('Ошибка тестирования подключения');
        } finally {
            setTesting(false);
        }
    };

    // Сохранение конфигурации
    const saveConfig = async () => {
        if (!formData.endpoint_url) {
            toast.error('Укажите URL локального TTS');
            return;
        }

        try {
            setSaving(true);
            const response = await fetch(`${API_BASE_URL}/api/local-tts/config`, {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    endpoint_url: formData.endpoint_url,
                    api_key: formData.api_key || null,
                    use_local: formData.use_local
                })
            });

            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    toast.success(data.message);
                    await loadConfig();
                } else {
                    toast.error(data.message || 'Ошибка сохранения');
                }
            } else {
                const errorData = await response.json();
                toast.error(errorData.detail || 'Ошибка сохранения конфигурации');
            }
        } catch (error) {
            console.error('Error saving config:', error);
            toast.error('Ошибка сохранения конфигурации');
        } finally {
            setSaving(false);
        }
    };

    // Переключение использования локального TTS
    const toggleLocal = async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/api/local-tts/toggle`, {
                method: 'POST',
                credentials: 'include'
            });

            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    toast.success(data.message);
                    setFormData(prev => ({ ...prev, use_local: data.use_local }));
                    await loadConfig();
                } else {
                    toast.error(data.message || 'Ошибка переключения');
                }
            } else {
                const errorData = await response.json();
                toast.error(errorData.detail || 'Ошибка переключения');
            }
        } catch (error) {
            console.error('Error toggling local TTS:', error);
            toast.error('Ошибка переключения');
        }
    };

    // Удаление конфигурации
    const deleteConfig = async () => {
        if (!window.confirm('Вы уверены, что хотите удалить конфигурацию локального TTS?')) {
            return;
        }

        try {
            const response = await fetch(`${API_BASE_URL}/api/local-tts/config`, {
                method: 'DELETE',
                credentials: 'include'
            });

            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    toast.success(data.message);
                    setConfig(null);
                    setFormData({
                        endpoint_url: 'http://localhost:8001',
                        api_key: '',
                        use_local: false
                    });
                }
            } else {
                toast.error('Ошибка удаления конфигурации');
            }
        } catch (error) {
            console.error('Error deleting config:', error);
            toast.error('Ошибка удаления конфигурации');
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="text-center">
                    <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2" />
                    <p className="text-muted-foreground">Загрузка...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6 max-w-3xl">
            <div>
                <h1 className="text-2xl font-bold mb-1">Локальный TTS F5</h1>
                <p className="text-sm text-muted-foreground">
                    Настройте локальный движок для генерации озвучки на вашей видеокарте
                </p>
            </div>

            {/* Быстрый старт */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">Быстрый старт</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                        <Button 
                            onClick={autoSearchTTS}
                            disabled={autoSearching}
                            variant="outline"
                            className="h-16 flex flex-col gap-1"
                        >
                            {autoSearching ? (
                                <>
                                    <RefreshCw className="w-5 h-5 animate-spin" />
                                    <span className="text-sm">Поиск...</span>
                                </>
                            ) : (
                                <>
                                    <Search className="w-5 h-5" />
                                    <span className="text-sm">Автопоиск TTS</span>
                                </>
                            )}
                        </Button>
                        
                        <Button 
                            onClick={downloadTTSF5Simple}
                            disabled={downloading}
                            className="h-16 flex flex-col gap-1"
                        >
                            {downloading ? (
                                <>
                                    <RefreshCw className="w-5 h-5 animate-spin" />
                                    <span className="text-sm">Скачивание...</span>
                                </>
                            ) : (
                                <>
                                    <Download className="w-5 h-5" />
                                    <span className="text-sm">Скачать TTS F5</span>
                                </>
                            )}
                        </Button>
                    </div>
                    
                    <div className="text-xs text-muted-foreground text-center py-2 border-t">
                        💡 Сначала скачайте TTS F5, затем используйте автопоиск
                    </div>
                </CardContent>
            </Card>

            {/* Статус конфигурации */}
            {config && (
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                            {config.is_healthy ? (
                                <CheckCircle className="w-5 h-5 text-green-500" />
                            ) : (
                                <XCircle className="w-5 h-5 text-red-500" />
                            )}
                            Статус: <span className={config.is_healthy ? 'text-green-500' : 'text-red-500'}>
                                {config.is_healthy ? 'Работает' : 'Недоступен'}
                            </span>
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        <div className="text-sm">
                            <span className="text-muted-foreground">Endpoint: </span>
                            <span className="font-mono">{config.endpoint_url}</span>
                        </div>
                        {config.tts_version && (
                            <div className="text-sm">
                                <span className="text-muted-foreground">Версия: </span>
                                <span>{config.tts_version}</span>
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* Настройки */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">Настройки подключения</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="endpoint_url" className="text-sm">URL локального TTS</Label>
                        <Input
                            id="endpoint_url"
                            type="url"
                            placeholder="http://localhost:8001"
                            value={formData.endpoint_url}
                            onChange={(e) => setFormData(prev => ({
                                ...prev,
                                endpoint_url: e.target.value
                            }))}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="api_key" className="text-sm">API ключ (опционально)</Label>
                        <Input
                            id="api_key"
                            type="password"
                            placeholder="Оставьте пустым"
                            value={formData.api_key}
                            onChange={(e) => setFormData(prev => ({
                                ...prev,
                                api_key: e.target.value
                            }))}
                        />
                    </div>

                    <div className="flex gap-2 pt-2">
                        <Button 
                            onClick={testConnection} 
                            variant="outline"
                            disabled={testing}
                            className="flex-1"
                        >
                            {testing ? (
                                <>
                                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                                    Тест...
                                </>
                            ) : (
                                <>
                                    <CheckCircle className="w-4 h-4 mr-2" />
                                    Тест
                                </>
                            )}
                        </Button>

                        <Button 
                            onClick={saveConfig} 
                            disabled={saving}
                            className="flex-1"
                        >
                            {saving ? (
                                <>
                                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                                    Сохранение...
                                </>
                            ) : (
                                <>
                                    <Save className="w-4 h-4 mr-2" />
                                    Сохранить
                                </>
                            )}
                        </Button>

                        {config && (
                            <Button 
                                onClick={deleteConfig} 
                                variant="destructive"
                            >
                                <Trash2 className="w-4 h-4" />
                            </Button>
                        )}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

export default LocalTTSSettingsPage;

