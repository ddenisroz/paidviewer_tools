import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import api from '../services/api';
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"


const VoiceManager = () => {
  const [voices, setVoices] = useState([]);
  const [uploadInfo, setUploadInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const fileInputRef = useRef(null);

  // Загружаем голоса и информацию об ограничениях
  useEffect(() => {
    Promise.all([loadVoices(), loadUploadInfo()]);
  }, []);

  const loadVoices = async () => {
    try {
      setLoading(true);
      const response = await api.get('/api/voices');
      setVoices(response.data.voices || []);
    } catch (error) {
      setError('Ошибка загрузки списка голосов');
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
      console.error('Error loading upload info:', error);
    }
  };

  const handleFileSelect = (files) => {
    if (files.length === 0) return;
    
    const file = files[0];
    uploadFile(file);
  };

  const uploadFile = async (file) => {
    if (!uploadInfo) return;

    // Валидация размера
    const sizeMB = file.size / (1024 * 1024);
    if (sizeMB > uploadInfo.max_file_size_mb) {
      setError(`Файл слишком большой! Максимальный размер: ${uploadInfo.max_file_size_mb}МБ`);
      return;
    }

    // Валидация формата
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
        headers: {
          'Content-Type': 'multipart/form-data'
        },
        onUploadProgress: (progressEvent) => {
          const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setUploadProgress(progress);
        }
      });

      setSuccess(`Голос "${response.data.voice_name}" успешно загружен!`);
      
      // Показываем информацию об обработке
      const info = response.data.info;
      if (info?.was_trimmed) {
        setSuccess(prev => prev + ` Файл был обрезан с ${info.original_duration}с до ${info.final_duration}с.`);
      }

      await loadVoices(); // Перезагружаем список

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

  // Drag & Drop handlers
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
    <Card>
        <CardHeader className="flex flex-row items-center justify-between">
            <div className="space-y-1">
                <CardTitle>Управление голосами</CardTitle>
                <CardDescription>Загрузите свои собственные голоса для TTS.</CardDescription>
            </div>
            <div className="text-sm text-muted-foreground bg-secondary px-3 py-1 rounded-md">
                {voices.length} {voices.length === 1 ? 'голос' : 'голосов'}
            </div>
        </CardHeader>
        <CardContent className="space-y-6">
            {/* Информация об ограничениях */}
            {uploadInfo && (
                <div className="bg-secondary rounded-md p-4 text-sm text-secondary-foreground">
                    <div className="font-medium mb-2">Требования к файлам:</div>
                    <ul className="space-y-1 list-disc list-inside text-muted-foreground">
                        <li>Максимальный размер: {uploadInfo.max_file_size_mb}МБ</li>
                        <li>Максимальная длительность: {uploadInfo.max_duration_seconds}с (файл будет обрезан)</li>
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
            
            {/* Сообщения об ошибках и успехе */}
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

            {/* Список голосов */}
            <div>
                <h3 className="text-lg font-semibold mb-4">Загруженные голоса</h3>
                
                {loading && !uploading ? (
                    <div className="text-center py-8 text-muted-foreground">
                        Загрузка...
                    </div>
                ) : voices.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                        Голоса не найдены. Загрузите первый голос!
                    </div>
                ) : (
                    <div className="space-y-3">
                        {voices.map((voice, index) => (
                            <div key={index} className="bg-secondary rounded-md p-4 flex items-center justify-between">
                                <div>
                                    <div className="font-medium">{voice.name}</div>
                                    <div className="text-sm text-muted-foreground">
                                        {voice.size_kb}КБ • {formatDuration(voice.duration)}
                                    </div>
                                </div>
                                <Button
                                    variant="destructive"
                                    size="sm"
                                    onClick={() => deleteVoice(voice.name)}
                                    disabled={loading}
                                >
                                    Удалить
                                </Button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </CardContent>
        <CardFooter>
            <div className="w-full bg-secondary/50 rounded-md p-4">
                <div className="font-medium text-foreground mb-2">💡 Как использовать:</div>
                <div className="text-sm text-muted-foreground">
                Загруженные голоса можно использовать в чате командой: <code className="bg-background px-1.5 py-0.5 rounded">!voice название_голоса</code>
                </div>
            </div>
        </CardFooter>
    </Card>
  );
};

export default VoiceManager;

