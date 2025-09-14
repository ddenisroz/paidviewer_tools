import React, { useState, useEffect, useRef } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Upload, Trash2, Play, Settings, Volume2, Gauge, Zap } from 'lucide-react';
import api from '../../services/api';

const VoiceManagementPage = () => {
    const [voices, setVoices] = useState([]);
    const [uploadInfo, setUploadInfo] = useState(null);
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [dragActive, setDragActive] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [selectedVoice, setSelectedVoice] = useState(null);
    const [voiceSettings, setVoiceSettings] = useState({});
    const fileInputRef = useRef(null);

    useEffect(() => {
        Promise.all([loadVoices(), loadUploadInfo()]);
    }, []);

    const loadVoices = async () => {
        try {
            setLoading(true);
            const response = await api.get('/api/voices');
            setVoices(response.data.voices || []);
            setError(''); // Очищаем ошибки при успешной загрузке
        } catch (error) {
            if (error.code === 'ERR_NETWORK' || error.message === 'Network Error') {
                setError('Сервер недоступен. Проверьте, что backend запущен.');
            } else {
                setError('Ошибка загрузки списка голосов');
            }
            console.error('Error loading voices:', error);
        } finally {
            setLoading(false);
        }
    };

    const loadUploadInfo = async () => {
        try {
            const response = await api.get('/api/voices/info');
            setUploadInfo(response.data);
        } catch (error) {
            if (error.code !== 'ERR_NETWORK') {
                console.error('Error loading upload info:', error);
            }
        }
    };

    const handleFileSelect = (files) => {
        if (files.length === 0) return;
        const file = files[0];
        uploadFile(file);
    };

    const uploadFile = async (file) => {
        if (!uploadInfo) return;

        const sizeMB = file.size / (1024 * 1024);
        if (sizeMB > uploadInfo.max_file_size_mb) {
            setError(`Файл слишком большой! Максимальный размер: ${uploadInfo.max_file_size_mb}МБ`);
            return;
        }

        const extension = '.' + file.name.split('.').pop().toLowerCase();
        if (!uploadInfo.supported_formats.includes(extension)) {
            setError(`Неподдерживаемый формат! Поддерживаемые: ${uploadInfo.supported_formats.join(', ')}`);
            return;
        }

        try {
            setUploading(true);
            setUploadProgress(0);
            setError('');
            setSuccess('');

            const formData = new FormData();
            formData.append('file', file);

            const response = await api.post('/api/voices/upload', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
                onUploadProgress: (progressEvent) => {
                    const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                    setUploadProgress(progress);
                }
            });

            setSuccess(`Голос "${response.data.voice_name}" успешно загружен!`);
            await loadVoices();

        } catch (error) {
            console.error('Upload error:', error);
            const message = error.response?.data?.detail || 'Ошибка загрузки файла';
            setError(message);
        } finally {
            setUploading(false);
            setUploadProgress(0);
        }
    };

    const deleteVoice = async (voiceName) => {
        if (!confirm(`Удалить голос "${voiceName}"?`)) return;

        try {
            setLoading(true);
            await api.delete(`/api/voices/${voiceName}`);
            setSuccess(`Голос "${voiceName}" удален`);
            await loadVoices();
        } catch (error) {
            const message = error.response?.data?.detail || 'Ошибка удаления голоса';
            setError(message);
        } finally {
            setLoading(false);
        }
    };

    const handleVoiceSettings = (voice) => {
        setSelectedVoice(voice);
        setVoiceSettings({
            volume: 70,
            speed: 1.0,
            cfg_strength: 2.0,
            nfe_step: 32,
            sway_sampling_coef: 0.0,
            ...voiceSettings[voice.name]
        });
    };

    const saveVoiceSettings = async () => {
        try {
            // В реальной реализации здесь будет API вызов для сохранения настроек
            // await api.put(`/api/voices/${selectedVoice.name}/settings`, voiceSettings);
            setSuccess(`Настройки для голоса "${selectedVoice.name}" сохранены`);
            setSelectedVoice(null);
        } catch (error) {
            setError('Ошибка сохранения настроек');
        }
    };

    const handleDrag = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === 'dragenter' || e.type === 'dragover') {
            setDragActive(true);
        } else if (e.type === 'dragleave') {
            setDragActive(false);
        }
    };

    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setDragActive(false);
        
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            handleFileSelect(e.dataTransfer.files);
        }
    };

    const formatDuration = (seconds) => {
        if (!seconds) return '—';
        return `${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, '0')}`;
    };

    return (
        <div className="container mx-auto p-6 space-y-6">
            <div className="mb-6">
                <h1 className="text-3xl font-bold text-foreground mb-2">Управление голосами</h1>
                <div className="p-4 bg-muted rounded-lg">
                    <div className="font-medium mb-2">💡 Как использовать:</div>
                    <p className="text-sm text-muted-foreground">
                        Загруженные голоса можно использовать командой: <code className="bg-background px-2 py-1 rounded">!voice название_голоса</code>
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                        Нажмите на голос для индивидуальной настройки параметров синтеза
                    </p>
                </div>
            </div>

            {/* Сообщения */}
            {error && (
                <div className="bg-destructive/10 border border-destructive/20 rounded-md p-3 text-destructive-foreground">
                    {error}
                </div>
            )}
            
            {success && (
                <div className="bg-primary/10 border border-primary/20 rounded-md p-3 text-primary-foreground">
                    {success}
                </div>
            )}

            {/* Загруженные голоса */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                        Загруженные голоса
                        <span className="text-sm text-muted-foreground bg-secondary px-3 py-1 rounded-md">
                            {voices.length} {voices.length === 1 ? 'голос' : 'голосов'}
                        </span>
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {loading && !uploading ? (
                        <div className="text-center py-8 text-muted-foreground">Загрузка...</div>
                    ) : voices.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            Голоса не найдены. Загрузите первый голос!
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {voices.map((voice, index) => (
                                <div key={index} className="border rounded-lg p-4 hover:border-primary/50 transition-colors cursor-pointer"
                                     onClick={() => handleVoiceSettings(voice)}>
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="font-medium text-lg">{voice.name}</div>
                                        <Settings className="h-4 w-4 text-muted-foreground" />
                                    </div>
                                    <div className="text-sm text-muted-foreground mb-3">
                                        {voice.size_kb}КБ • {formatDuration(voice.duration)}
                                    </div>
                                    <div className="flex gap-2">
                                        <Button variant="outline" size="sm" className="flex-1">
                                            <Play className="h-3 w-3 mr-1" />
                                            Тест
                                        </Button>
                                        <Button variant="destructive" size="sm"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    deleteVoice(voice.name);
                                                }}
                                                disabled={loading}>
                                            <Trash2 className="h-3 w-3" />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Загрузка файлов */}
            <Card>
                <CardHeader>
                    <CardTitle>Загрузка нового голоса</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    {/* Информация об ограничениях */}
                    {uploadInfo && (
                        <div className="bg-secondary rounded-md p-4 text-sm">
                            <div className="font-medium mb-2">Требования к файлам:</div>
                            <ul className="space-y-1 list-disc list-inside text-muted-foreground">
                                <li>Максимальный размер: {uploadInfo.max_file_size_mb}МБ</li>
                                <li>Максимальная длительность: {uploadInfo.max_duration_seconds}с</li>
                                <li>Поддерживаемые форматы: {uploadInfo.supported_formats.join(', ')}</li>
                                <li>Автоматическая конвертация в WAV, моно, 22kHz</li>
                            </ul>
                        </div>
                    )}

                    {/* Зона загрузки */}
                    <div
                        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                        dragActive 
                            ? 'border-primary bg-primary/10' 
                            : 'border-border hover:border-muted-foreground'
                        } ${uploading ? 'pointer-events-none opacity-50' : ''}`}
                        onDragEnter={handleDrag}
                        onDragLeave={handleDrag}
                        onDragOver={handleDrag}
                        onDrop={handleDrop}
                    >
                        <input
                            ref={fileInputRef}
                            type="file"
                            accept={uploadInfo?.supported_formats.join(',')}
                            onChange={(e) => handleFileSelect(e.target.files)}
                            className="hidden"
                        />

                        {uploading ? (
                            <div className="space-y-2">
                                <div className="font-medium">Загрузка...</div>
                                <Progress value={uploadProgress} className="w-full" />
                                <div className="text-sm text-muted-foreground">{uploadProgress}%</div>
                            </div>
                        ) : (
                            <>
                                <div className="text-4xl mb-4">🎤</div>
                                <div className="font-medium mb-2">
                                Перетащите аудио файл сюда или{' '}
                                <Button 
                                    variant="link" 
                                    className="p-0 h-auto text-base"
                                    onClick={() => fileInputRef.current?.click()}
                                >
                                    выберите файл
                                </Button>
                                </div>
                                <div className="text-sm text-muted-foreground">
                                Файл будет автоматически конвертирован в подходящий формат
                                </div>
                            </>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Диалог настроек голоса */}
            <Dialog open={!!selectedVoice} onOpenChange={(open) => !open && setSelectedVoice(null)}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Настройки голоса: {selectedVoice?.name}</DialogTitle>
                    </DialogHeader>
                    
                    {selectedVoice && (
                        <div className="space-y-6 py-4">
                            {/* Аудио плеер */}
                            <div className="p-4 bg-muted rounded-lg">
                                <div className="text-sm font-medium mb-2">Предпросмотр голоса</div>
                                <div className="flex items-center gap-2">
                                    <Button size="sm">
                                        <Play className="h-3 w-3 mr-1" />
                                        Прослушать
                                    </Button>
                                    <div className="text-xs text-muted-foreground">
                                        {formatDuration(selectedVoice.duration)}
                                    </div>
                                </div>
                            </div>

                            {/* Настройки */}
                            <div className="space-y-4">
                                <div>
                                    <Label className="flex items-center gap-2 mb-2">
                                        <Volume2 className="h-4 w-4" />
                                        Громкость: {voiceSettings.volume}%
                                    </Label>
                                    <Slider
                                        value={[voiceSettings.volume]}
                                        onValueChange={([value]) => setVoiceSettings(prev => ({...prev, volume: value}))}
                                        max={100}
                                        step={1}
                                        className="w-full"
                                    />
                                </div>

                                <div>
                                    <Label className="flex items-center gap-2 mb-2">
                                        <Gauge className="h-4 w-4" />
                                        Скорость: {voiceSettings.speed}x
                                    </Label>
                                    <Slider
                                        value={[voiceSettings.speed]}
                                        onValueChange={([value]) => setVoiceSettings(prev => ({...prev, speed: value}))}
                                        min={0.5}
                                        max={2.0}
                                        step={0.1}
                                        className="w-full"
                                    />
                                </div>

                                <div>
                                    <Label className="flex items-center gap-2 mb-2">
                                        <Zap className="h-4 w-4" />
                                        CFG Strength: {voiceSettings.cfg_strength}
                                    </Label>
                                    <Slider
                                        value={[voiceSettings.cfg_strength]}
                                        onValueChange={([value]) => setVoiceSettings(prev => ({...prev, cfg_strength: value}))}
                                        min={1.0}
                                        max={5.0}
                                        step={0.1}
                                        className="w-full"
                                    />
                                </div>

                                <div>
                                    <Label className="mb-2 block">NFE Steps: {voiceSettings.nfe_step}</Label>
                                    <Slider
                                        value={[voiceSettings.nfe_step]}
                                        onValueChange={([value]) => setVoiceSettings(prev => ({...prev, nfe_step: value}))}
                                        min={16}
                                        max={64}
                                        step={8}
                                        className="w-full"
                                    />
                                </div>
                            </div>

                            <div className="flex gap-2 pt-4">
                                <Button onClick={saveVoiceSettings} className="flex-1">
                                    Применить
                                </Button>
                                <Button variant="outline" onClick={() => setSelectedVoice(null)}>
                                    Отмена
                                </Button>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default VoiceManagementPage;
