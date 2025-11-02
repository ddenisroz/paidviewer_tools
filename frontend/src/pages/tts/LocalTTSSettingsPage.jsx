// frontend/src/pages/tts/LocalTTSSettingsPage.jsx
import React, { useState, useEffect } from 'react';
import { 
    Server, 
    CheckCircle, 
    XCircle, 
    Loader2, 
    Copy, 
    ExternalLink, 
    AlertTriangle,
    Cpu,
    HardDrive,
    Zap,
    RefreshCw,
    Mic,
    Upload,
    Trash2,
    Play,
    Plus
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Badge } from '../../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '../../components/ui/dialog';
import { toast } from 'sonner';
import { botService } from '../../services/microservices';
import axios from 'axios';
import { logger } from '../../utils/prodLogger';

const LocalTTSSettingsPage = () => {
    const [config, setConfig] = useState({
        endpoint_url: 'http://localhost:8001',
        api_key: '',
        use_local: false
    });
    
    const [testing, setTesting] = useState(false);
    const [saving, setSaving] = useState(false);
    const [testResult, setTestResult] = useState(null);
    const [healthData, setHealthData] = useState(null);
    const [statusData, setStatusData] = useState(null);
    const [loading, setLoading] = useState(true);
    
    // Voice management states
    const [voices, setVoices] = useState([]);
    const [loadingVoices, setLoadingVoices] = useState(false);
    const [isCreateVoiceDialogOpen, setIsCreateVoiceDialogOpen] = useState(false);
    const [newVoice, setNewVoice] = useState({ name: '', language: 'ru', description: '' });
    const [selectedVoice, setSelectedVoice] = useState(null);
    const [uploadingFile, setUploadingFile] = useState(false);
    const [currentTab, setCurrentTab] = useState('connection');
    const [isWhitelisted, setIsWhitelisted] = useState(false);
    const [whitelistChecked, setWhitelistChecked] = useState(false);

    useEffect(() => {
        loadConfig();
        checkWhitelist();
    }, []);

    const checkWhitelist = async () => {
        try {
            const response = await botService.get('/api/voices/whitelist-status').catch(() => ({ data: { is_whitelisted: false } }));
            setIsWhitelisted(response.data?.is_whitelisted || false);
            setWhitelistChecked(true);
        } catch (error) {
            logger.error('Error checking whitelist:', error);
            setIsWhitelisted(false);
            setWhitelistChecked(true);
        }
    };

    const loadConfig = async () => {
        try {
            setLoading(true);
            const response = await botService.get('/api/local-tts/config');
            
            // Проверяем whitelist из ответа
            if (response.data.can_manage_voices === false && !response.data.configured) {
                setIsWhitelisted(false);
                setWhitelistChecked(true);
            }
            
            if (response.data.config) {
                setConfig({
                    endpoint_url: response.data.config.endpoint_url || 'http://localhost:8001',
                    api_key: response.data.config.api_key || '',
                    use_local: response.data.config.use_local || false
                });
            }
        } catch (error) {
            logger.error('Error loading config:', error);
            // Если ошибка 403 - пользователь не в whitelist
            if (error.response?.status === 403) {
                setIsWhitelisted(false);
                setWhitelistChecked(true);
            }
        } finally {
            setLoading(false);
        }
    };

    const testConnection = async () => {
        try {
            setTesting(true);
            setTestResult(null);
            setHealthData(null);
            setStatusData(null);

            const response = await botService.post('/api/local-tts/test-connection', {
                endpoint_url: config.endpoint_url,
                api_key: config.api_key
            });

            if (response.data.success) {
                setTestResult({ success: true, message: 'Соединение успешно!' });
                setHealthData(response.data.health_data);
                setStatusData(response.data.status_data);
                toast.success('✅ Соединение установлено!');
            } else {
                setTestResult({ 
                    success: false, 
                    message: response.data.error || 'Не удалось подключиться' 
                });
                toast.error('❌ Ошибка подключения');
            }
        } catch (error) {
            setTestResult({ 
                success: false, 
                message: error.response?.data?.detail || 'Ошибка подключения к серверу' 
            });
            toast.error('❌ Ошибка подключения');
        } finally {
            setTesting(false);
        }
    };

    const saveConfig = async () => {
        if (!isWhitelisted) {
            toast.error('Сохранение конфигурации локального TTS доступно только для пользователей из whitelist');
            return;
        }
        
        try {
            setSaving(true);

            const response = await botService.post('/api/local-tts/config', {
                endpoint_url: config.endpoint_url,
                api_key: config.api_key,
                use_local: config.use_local
            });

            if (response.data.success) {
                toast.success('✅ Настройки сохранены!');
                await loadConfig(); // Перезагружаем конфиг
            }
        } catch (error) {
            logger.error('Error saving config:', error);
            toast.error('❌ Ошибка сохранения');
        } finally {
            setSaving(false);
        }
    };

    const toggleService = async () => {
        try {
            const response = await botService.post('/api/local-tts/toggle');
            
            if (response.data.success) {
                setConfig(prev => ({ ...prev, use_local: response.data.use_local }));
                toast.success(response.data.message);
            } else {
                toast.error(response.data.message);
            }
        } catch (error) {
            logger.error('Error toggling service:', error);
            toast.error('❌ Ошибка переключения сервиса');
        }
    };

    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text);
        toast.success('📋 Скопировано в буфер обмена');
    };

    // Voice Management Functions
    const loadVoices = async () => {
        if (!config.endpoint_url) return;
        
        try {
            setLoadingVoices(true);
            const response = await axios.get(`${config.endpoint_url}/api/voices/list`);
            setVoices(response.data.voices || []);
        } catch (error) {
            logger.error('Error loading voices:', error);
            toast.error('Ошибка загрузки голосов');
        } finally {
            setLoadingVoices(false);
        }
    };

    const createVoice = async () => {
        if (!newVoice.name.trim()) {
            toast.error('Введите название голоса');
            return;
        }

        try {
            const formData = new FormData();
            formData.append('name', newVoice.name);
            formData.append('language', newVoice.language);
            formData.append('description', newVoice.description);

            const response = await axios.post(
                `${config.endpoint_url}/api/voices/create`,
                formData
            );

            toast.success('✅ Голос создан! Загрузите референсные аудио.');
            setIsCreateVoiceDialogOpen(false);
            setNewVoice({ name: '', language: 'ru', description: '' });
            loadVoices();
        } catch (error) {
            logger.error('Error creating voice:', error);
            toast.error(error.response?.data?.detail || 'Ошибка создания голоса');
        }
    };

    const [sampleDialogOpen, setSampleDialogOpen] = useState(false);
    const [currentSampleVoiceId, setCurrentSampleVoiceId] = useState(null);
    const [sampleText, setSampleText] = useState('');
    const [sampleFile, setSampleFile] = useState(null);
    const [isTranscribing, setIsTranscribing] = useState(false);

    const uploadSample = async (voiceId, file, text) => {
        try {
            setUploadingFile(true);
            const formData = new FormData();
            formData.append('file', file);
            if (text) {
                formData.append('sample_text', text);
            }

            const response = await axios.post(
                `${config.endpoint_url}/api/voices/${voiceId}/upload`,
                formData
            );

            toast.success(
                response.data.transcription 
                    ? '✅ Сэмпл загружен и транскрибирован'
                    : '✅ Сэмпл загружен'
            );
            
            loadVoices();
            setSampleDialogOpen(false);
            setSampleText('');
            setSampleFile(null);
        } catch (error) {
            logger.error('Error uploading sample:', error);
            toast.error(error.response?.data?.detail || 'Ошибка загрузки сэмпла');
        } finally {
            setUploadingFile(false);
        }
    };

    const openSampleDialog = (voiceId) => {
        setCurrentSampleVoiceId(voiceId);
        setSampleText('');
        setSampleFile(null);
        setSampleDialogOpen(true);
    };

    const handleSampleUpload = () => {
        if (!sampleFile) {
            toast.error('Выберите файл');
            return;
        }
        uploadSample(currentSampleVoiceId, sampleFile, sampleText);
    };

    const deleteVoice = async (voiceId) => {
        if (!confirm('Удалить голос со всеми сэмплами?')) return;

        try {
            await axios.delete(`${config.endpoint_url}/api/voices/${voiceId}`);
            toast.success('🗑️ Голос удалён');
            loadVoices();
        } catch (error) {
            logger.error('Error deleting voice:', error);
            toast.error('Ошибка удаления голоса');
        }
    };

    // Load voices when connected
    useEffect(() => {
        if (testResult?.success && currentTab === 'voices') {
            loadVoices();
        }
    }, [testResult, currentTab]);

    if (loading) {
        return (
            <div className="container mx-auto p-6 flex items-center justify-center min-h-screen">
                <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            </div>
        );
    }

    return (
        <div className="container mx-auto p-6 space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                        <Server className="w-8 h-8" />
                        Локальный TTS сервис
                    </h1>
                </div>
            </div>

            {/* Уведомление для пользователей без whitelist */}
            {whitelistChecked && !isWhitelisted && (
                <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-4 flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                        <h3 className="text-red-300 font-semibold mb-1">Доступ к локальному TTS ограничен</h3>
                        <p className="text-red-200/80 text-sm">
                            Локальный TTS доступен только для пользователей из whitelist. 
                            Для получения доступа обратитесь к администратору системы.
                        </p>
                        <p className="text-red-200/60 text-xs mt-2">
                            💡 Вам доступна только базовая озвучка (gTTS) через основные настройки TTS.
                        </p>
                    </div>
                </div>
            )}

            {/* Tabs для Connection и Voices */}
            <Tabs value={currentTab} onValueChange={setCurrentTab} className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="connection" className="flex items-center gap-2">
                        <Server className="w-4 h-4" />
                        Подключение
                    </TabsTrigger>
                    <TabsTrigger value="voices" className="flex items-center gap-2" disabled={!testResult?.success}>
                        <Mic className="w-4 h-4" />
                        Управление голосами
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="connection" className="space-y-6 mt-6">
            {/* Инструкция по установке */}
            <Card className="bg-blue-500/10 border-blue-500/30">
                <CardHeader>
                    <CardTitle className="text-blue-400 flex items-center gap-2">
                        <ExternalLink className="w-5 h-5" />
                        Как установить локальный TTS сервис?
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-3 text-sm">
                        <div className="flex items-start gap-3">
                            <span className="bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0">1</span>
                            <div>
                                <p className="font-medium">Перейдите в папку проекта:</p>
                                <code className="block bg-gray-800 p-2 rounded mt-1">
                                    cd tts_service_simple
                                </code>
                            </div>
                        </div>

                        <div className="flex items-start gap-3">
                            <span className="bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0">2</span>
                            <div>
                                <p className="font-medium">Установите зависимости:</p>
                                <code className="block bg-gray-800 p-2 rounded mt-1">
                                    python install.py
                                </code>
                            </div>
                        </div>

                        <div className="flex items-start gap-3">
                            <span className="bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0">3</span>
                            <div>
                                <p className="font-medium">Запустите сервис:</p>
                                <code className="block bg-gray-800 p-2 rounded mt-1">
                                    start.bat  # Windows<br/>
                                    ./start.sh # Linux/Mac
                                </code>
                            </div>
                        </div>

                        <div className="flex items-start gap-3">
                            <span className="bg-blue-500 text-white rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0">4</span>
                            <div>
                                <p className="font-medium">Найдите API ключ в файле <code>config.json</code></p>
                                <p className="text-muted-foreground text-xs mt-1">
                                    Откройте файл и скопируйте значение поля "api_key"
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-yellow-500/10 border border-yellow-500/30 rounded p-3 flex items-start gap-2">
                        <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                        <div className="text-sm text-yellow-200">
                            <p className="font-medium">Системные требования:</p>
                            <ul className="list-disc list-inside mt-1 space-y-1 text-xs text-yellow-200/80">
                                <li>Python 3.8+</li>
                                <li>NVIDIA GPU с VRAM ≥ 6GB (рекомендуется)</li>
                                <li>8GB RAM (16GB рекомендуется)</li>
                            </ul>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Настройки подключения */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Server className="w-5 h-5" />
                        Настройки подключения
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="endpoint_url">URL сервиса</Label>
                        <Input
                            id="endpoint_url"
                            value={config.endpoint_url}
                            onChange={(e) => setConfig({ ...config, endpoint_url: e.target.value })}
                            placeholder="http://localhost:8001"
                        />
                        <p className="text-xs text-muted-foreground">
                            По умолчанию: http://localhost:8001
                        </p>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="api_key">API ключ</Label>
                        <div className="flex gap-2">
                            <Input
                                id="api_key"
                                type="password"
                                value={config.api_key}
                                onChange={(e) => setConfig({ ...config, api_key: e.target.value })}
                                placeholder="Введите API ключ из config.json"
                            />
                            {config.api_key && (
                                <Button
                                    variant="outline"
                                    size="icon"
                                    onClick={() => copyToClipboard(config.api_key)}
                                >
                                    <Copy className="w-4 h-4" />
                                </Button>
                            )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Найдите в файле tts_service_simple/config.json
                        </p>
                    </div>

                    <div className="flex gap-2">
                        <Button
                            onClick={testConnection}
                            disabled={testing || !config.endpoint_url || !config.api_key}
                            className="flex-1"
                        >
                            {testing ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Проверка...
                                </>
                            ) : (
                                <>
                                    <CheckCircle className="w-4 h-4 mr-2" />
                                    Тест соединения
                                </>
                            )}
                        </Button>

                        <Button
                            onClick={saveConfig}
                            disabled={saving || !config.endpoint_url || !config.api_key}
                            className="flex-1 bg-green-600 hover:bg-green-700"
                        >
                            {saving ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Сохранение...
                                </>
                            ) : (
                                'Сохранить'
                            )}
                        </Button>
                    </div>

                    {/* Результат теста */}
                    {testResult && (
                        <div className={`p-4 rounded-lg flex items-center gap-3 ${
                            testResult.success 
                                ? 'bg-green-500/10 border border-green-500/30' 
                                : 'bg-red-500/10 border border-red-500/30'
                        }`}>
                            {testResult.success ? (
                                <CheckCircle className="w-5 h-5 text-green-400" />
                            ) : (
                                <XCircle className="w-5 h-5 text-red-400" />
                            )}
                            <span className={testResult.success ? 'text-green-300' : 'text-red-300'}>
                                {testResult.message}
                            </span>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Статус сервиса */}
            {healthData && (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Zap className="w-5 h-5" />
                            Статус сервиса
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <p className="text-sm text-muted-foreground">Статус</p>
                                <p className="text-lg font-semibold flex items-center gap-2">
                                    <CheckCircle className="w-5 h-5 text-green-400" />
                                    {healthData.status === 'healthy' ? 'Работает' : 'Ошибка'}
                                </p>
                            </div>

                            <div className="space-y-2">
                                <p className="text-sm text-muted-foreground">Версия</p>
                                <p className="text-lg font-semibold">{healthData.version}</p>
                            </div>

                            {healthData.gpu_info && (
                                <>
                                    <div className="space-y-2">
                                        <p className="text-sm text-muted-foreground flex items-center gap-2">
                                            <Cpu className="w-4 h-4" />
                                            GPU
                                        </p>
                                        <p className="text-lg font-semibold">{healthData.gpu_info.name}</p>
                                    </div>

                                    <div className="space-y-2">
                                        <p className="text-sm text-muted-foreground flex items-center gap-2">
                                            <HardDrive className="w-4 h-4" />
                                            VRAM
                                        </p>
                                        <p className="text-lg font-semibold">
                                            {(healthData.gpu_info.memory_total / 1024).toFixed(1)} GB
                                        </p>
                                    </div>
                                </>
                            )}

                            <div className="space-y-2">
                                <p className="text-sm text-muted-foreground">Uptime</p>
                                <p className="text-lg font-semibold">
                                    {Math.floor(healthData.uptime / 3600)}ч {Math.floor((healthData.uptime % 3600) / 60)}м
                                </p>
                            </div>
                        </div>

                        {statusData && (
                            <div className="mt-4 pt-4 border-t border-gray-700">
                                <h4 className="text-sm font-medium mb-3">Статистика</h4>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    <div>
                                        <p className="text-xs text-muted-foreground">Всего запросов</p>
                                        <p className="text-lg font-semibold">{statusData.stats.total_requests}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-muted-foreground">Успешных</p>
                                        <p className="text-lg font-semibold text-green-400">
                                            {statusData.stats.successful_requests}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-muted-foreground">Ошибок</p>
                                        <p className="text-lg font-semibold text-red-400">
                                            {statusData.stats.failed_requests}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-muted-foreground">Среднее время</p>
                                        <p className="text-lg font-semibold">
                                            {statusData.stats.average_processing_time.toFixed(2)}с
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}

                        <Button
                            variant="outline"
                            onClick={testConnection}
                            className="mt-4 w-full"
                        >
                            <RefreshCw className="w-4 h-4 mr-2" />
                            Обновить статус
                        </Button>
                    </CardContent>
                </Card>
            )}

            {/* Переключатель использования */}
            {testResult?.success && (
                <Card>
                    <CardHeader>
                        <CardTitle>Использование локального TTS</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center justify-between p-4 bg-gray-800 rounded-lg">
                            <div>
                                <p className="font-medium">Использовать локальный TTS</p>
                                <p className="text-sm text-muted-foreground">
                                    {config.use_local 
                                        ? 'Бот использует локальный сервис для генерации озвучки'
                                        : 'Бот использует облачный сервис (если доступен)'
                                    }
                                </p>
                            </div>
                            <Button
                                onClick={toggleService}
                                variant={config.use_local ? 'default' : 'outline'}
                            >
                                {config.use_local ? 'Включено' : 'Выключено'}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}
                </TabsContent>

                {/* Voice Management Tab */}
                <TabsContent value="voices" className="space-y-6 mt-6">
                    <Card>
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle className="flex items-center gap-2">
                                        <Mic className="w-5 h-5" />
                                        Управление голосами
                                    </CardTitle>
                                    <p className="text-sm text-muted-foreground mt-1">
                                        Создавайте и загружайте собственные голоса для клонирования
                                    </p>
                                </div>
                                <Dialog open={isCreateVoiceDialogOpen} onOpenChange={setIsCreateVoiceDialogOpen}>
                                    <DialogTrigger asChild>
                                        <Button className="flex items-center gap-2">
                                            <Plus className="w-4 h-4" />
                                            Создать голос
                                        </Button>
                                    </DialogTrigger>
                                    <DialogContent>
                                        <DialogHeader>
                                            <DialogTitle>Создать новый голос</DialogTitle>
                                        </DialogHeader>
                                        <div className="space-y-4">
                                            <div>
                                                <Label>Название голоса *</Label>
                                                <Input
                                                    value={newVoice.name}
                                                    onChange={(e) => setNewVoice({ ...newVoice, name: e.target.value })}
                                                    placeholder="Например: Мой голос"
                                                />
                                            </div>
                                            <div>
                                                <Label>Язык</Label>
                                                <select
                                                    className="w-full p-2 bg-gray-800 border border-gray-700 rounded"
                                                    value={newVoice.language}
                                                    onChange={(e) => setNewVoice({ ...newVoice, language: e.target.value })}
                                                >
                                                    <option value="ru">Русский</option>
                                                    <option value="en">English</option>
                                                </select>
                                            </div>
                                            <div>
                                                <Label>Описание (опционально)</Label>
                                                <Input
                                                    value={newVoice.description}
                                                    onChange={(e) => setNewVoice({ ...newVoice, description: e.target.value })}
                                                    placeholder="Описание голоса"
                                                />
                                            </div>
                                        </div>
                                        <DialogFooter>
                                            <Button variant="outline" onClick={() => setIsCreateVoiceDialogOpen(false)}>
                                                Отмена
                                            </Button>
                                            <Button onClick={createVoice}>
                                                Создать
                                            </Button>
                                        </DialogFooter>
                                    </DialogContent>
                                </Dialog>
                            </div>
                        </CardHeader>
                        <CardContent>
                            {loadingVoices ? (
                                <div className="flex items-center justify-center py-8">
                                    <Loader2 className="w-6 h-6 animate-spin" />
                                </div>
                            ) : voices.length === 0 ? (
                                <div className="text-center py-8 text-muted-foreground">
                                    <Mic className="w-12 h-12 mx-auto mb-4 opacity-50" />
                                    <p>Нет созданных голосов</p>
                                    <p className="text-sm mt-2">Создайте первый голос, чтобы начать</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {voices.map((voice) => (
                                        <Card key={voice.id} className="overflow-hidden">
                                            <CardHeader className="pb-3">
                                                <div className="flex items-start justify-between">
                                                    <div className="flex-1">
                                                        <CardTitle className="text-base flex items-center gap-2">
                                                            {voice.name}
                                                            <Badge variant={voice.type === 'base' ? 'default' : 'secondary'}>
                                                                {voice.type === 'base' ? 'Базовый' : 'Свой'}
                                                            </Badge>
                                                        </CardTitle>
                                                        <p className="text-xs text-muted-foreground mt-1">
                                                            {voice.language === 'ru' ? '🇷🇺 Русский' : '🇬🇧 English'}
                                                        </p>
                                                    </div>
                                                    {voice.type === 'custom' && (
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={() => deleteVoice(voice.id)}
                                                            className="h-8 w-8 p-0"
                                                        >
                                                            <Trash2 className="w-4 h-4 text-red-400" />
                                                        </Button>
                                                    )}
                                                </div>
                                            </CardHeader>
                                            <CardContent>
                                                {voice.type === 'custom' && (
                                                    <>
                                                        <div className="flex items-center justify-between mb-3">
                                                            <span className="text-sm text-muted-foreground">
                                                                Сэмплов: {voice.samples_count || 0}
                                                            </span>
                                                        </div>
                                                        <Button
                                                            onClick={() => openSampleDialog(voice.id)}
                                                            variant="outline"
                                                            className="w-full"
                                                            disabled={uploadingFile}
                                                        >
                                                            <Upload className="h-4 w-4 mr-2" />
                                                            Загрузить сэмпл
                                                        </Button>
                                                    </>
                                                )}
                                                {voice.type === 'base' && (
                                                    <p className="text-sm text-muted-foreground">
                                                        Предустановленный голос
                                                    </p>
                                                )}
                                            </CardContent>
                                        </Card>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Рекомендации */}
                    <Card className="bg-blue-500/10 border-blue-500/30">
                        <CardHeader>
                            <CardTitle className="text-blue-400 text-sm">
                                💡 Рекомендации по записи
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2 text-sm">
                            <p>• <strong>Формат:</strong> WAV 16-bit, 48000 Hz (лучшее качество)</p>
                            <p>• <strong>Длительность:</strong> 3-10 секунд на сэмпл</p>
                            <p>• <strong>Количество:</strong> Минимум 3, рекомендуется 5-10 сэмплов</p>
                            <p>• <strong>Качество:</strong> Чистая речь без фонового шума и музыки</p>
                            <p>• <strong>Интонация:</strong> Нейтральная, естественная</p>
                            <p>• <strong>Разнообразие:</strong> Используйте разные фразы</p>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            {/* Диалог настройки сэмпла */}
            <Dialog open={sampleDialogOpen} onOpenChange={setSampleDialogOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Загрузить аудио сэмпл</DialogTitle>
                        <DialogDescription>
                            Загрузите аудио файл с референсным текстом для клонирования голоса
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div>
                            <Label htmlFor="sample-text">Референсный текст (опционально)</Label>
                            <Textarea
                                id="sample-text"
                                value={sampleText}
                                onChange={(e) => setSampleText(e.target.value)}
                                placeholder="Что произносится в аудио? (если не указать, будет автотранскрибировано)"
                                className="mt-1"
                                rows={3}
                            />
                            <p className="text-xs text-muted-foreground mt-1">
                                💡 Если оставить пустым, текст будет извлечён автоматически через Whisper
                            </p>
                        </div>

                        <div>
                            <Label>Аудио файл</Label>
                            <Input
                                type="file"
                                accept=".wav,.mp3,.flac,.ogg,.m4a,.aac,.wma,.aiff,.au"
                                onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                        setSampleFile(file);
                                    }
                                }}
                                className="mt-1"
                            />
                            {sampleFile && (
                                <p className="text-xs text-green-400 mt-1">
                                    ✓ Выбран: {sampleFile.name}
                                </p>
                            )}
                            <p className="text-xs text-muted-foreground mt-1">
                                Поддерживаемые форматы: WAV, MP3, FLAC, OGG, M4A, AAC, WMA, AIFF, AU
                            </p>
                            <p className="text-xs text-muted-foreground">
                                Будет автоматически конвертировано в WAV 48kHz Mono 16-bit
                            </p>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setSampleDialogOpen(false)}
                        >
                            Отмена
                        </Button>
                        <Button
                            onClick={handleSampleUpload}
                            disabled={!sampleFile || uploadingFile}
                        >
                            {uploadingFile ? 'Загрузка...' : 'Загрузить'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default LocalTTSSettingsPage;
