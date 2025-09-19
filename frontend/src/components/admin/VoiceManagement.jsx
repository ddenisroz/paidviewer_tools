import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Upload, Trash2, Edit, Play, Pause, Download, Mic, Users, Globe } from 'lucide-react';
import { toast } from 'sonner';
import api from '../../services/api';

const VoiceManagement = () => {
    const [voices, setVoices] = useState([]);
    const [loading, setLoading] = useState(false);
    const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
    const [editDialogOpen, setEditDialogOpen] = useState(false);
    const [selectedVoice, setSelectedVoice] = useState(null);
    
    // Состояние для загрузки
    const [uploadFile, setUploadFile] = useState(null);
    const [voiceName, setVoiceName] = useState('');
    const [voiceType, setVoiceType] = useState('global');
    const [refText, setRefText] = useState('');
    const [isUploading, setIsUploading] = useState(false);
    
    // Состояние для редактирования
    const [newName, setNewName] = useState('');
    const [newRefText, setNewRefText] = useState('');

    useEffect(() => {
        loadVoices();
    }, []);

    const loadVoices = async () => {
        try {
            setLoading(true);
            const ttsApiUrl = import.meta.env.VITE_TTS_SERVICE_URL || 'http://localhost:8001';
            const response = await fetch(`${ttsApiUrl}/api/admin/voices`);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            setVoices(data.voices || []);
        } catch (error) {
            toast.error('Ошибка загрузки голосов');
            console.error('Error loading voices:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleFileUpload = (event) => {
        const file = event.target.files[0];
        if (file) {
            setUploadFile(file);
            // Автоматически заполняем имя голоса из имени файла
            const nameWithoutExt = file.name.replace(/\.[^/.]+$/, "");
            setVoiceName(nameWithoutExt);
        }
    };

    const handleUpload = async () => {
        if (!uploadFile || !voiceName.trim()) {
            toast.error('Выберите файл и введите имя голоса');
            return;
        }

        setIsUploading(true);
        try {
            const formData = new FormData();
            formData.append('file', uploadFile);
            formData.append('voice_name', voiceName.trim());
            formData.append('voice_type', voiceType);
            formData.append('ref_text', refText.trim());

            const ttsApiUrl = import.meta.env.VITE_TTS_SERVICE_URL || 'http://localhost:8001';
            const response = await fetch(`${ttsApiUrl}/api/admin/voices/upload`, {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Ошибка загрузки голоса');
            }

            const data = await response.json();
            toast.success(data.message);
            setUploadDialogOpen(false);
            setUploadFile(null);
            setVoiceName('');
            setRefText('');
            loadVoices();
        } catch (error) {
            toast.error(error.message || 'Ошибка загрузки голоса');
        } finally {
            setIsUploading(false);
        }
    };

    const handleRename = async (voice) => {
        if (!newName.trim()) {
            toast.error('Введите новое имя');
            return;
        }

        try {
            const formData = new FormData();
            formData.append('new_name', newName.trim());
            formData.append('voice_type', voice.type);

            const ttsApiUrl = import.meta.env.VITE_TTS_SERVICE_URL || 'http://localhost:8001';
            const response = await fetch(`${ttsApiUrl}/api/admin/voices/${voice.name}/rename`, {
                method: 'PUT',
                body: formData
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Ошибка переименования');
            }

            const data = await response.json();
            toast.success(data.message);
            setEditDialogOpen(false);
            setNewName('');
            loadVoices();
        } catch (error) {
            toast.error(error.message || 'Ошибка переименования');
        }
    };

    const handleUpdateRefText = async (voice) => {
        try {
            const formData = new FormData();
            formData.append('ref_text', newRefText.trim());
            formData.append('voice_type', voice.type);

            const ttsApiUrl = import.meta.env.VITE_TTS_SERVICE_URL || 'http://localhost:8001';
            const response = await fetch(`${ttsApiUrl}/api/admin/voices/${voice.name}/ref-text`, {
                method: 'PUT',
                body: formData
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Ошибка обновления текста');
            }

            const data = await response.json();
            toast.success(data.message);
            setEditDialogOpen(false);
            setNewRefText('');
            loadVoices();
        } catch (error) {
            toast.error(error.message || 'Ошибка обновления текста');
        }
    };

    const handleDelete = async (voice) => {
        if (!confirm(`Удалить голос "${voice.name}"?`)) {
            return;
        }

        try {
            const ttsApiUrl = import.meta.env.VITE_TTS_SERVICE_URL || 'http://localhost:8001';
            const response = await fetch(`${ttsApiUrl}/api/admin/voices/${voice.name}?voice_type=${voice.type}`, {
                method: 'DELETE'
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Ошибка удаления голоса');
            }

            const data = await response.json();
            toast.success(data.message);
            loadVoices();
        } catch (error) {
            toast.error(error.message || 'Ошибка удаления голоса');
        }
    };

    const formatFileSize = (bytes) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const formatDate = (timestamp) => {
        return new Date(timestamp * 1000).toLocaleString('ru-RU');
    };

    const openEditDialog = (voice) => {
        setSelectedVoice(voice);
        setNewName(voice.name);
        setNewRefText(voice.ref_text || '');
        setEditDialogOpen(true);
    };

    return (
        <div className="space-y-6">
            {/* Заголовок и кнопка загрузки */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                        <Mic className="h-6 w-6 text-purple-400" />
                        Управление голосами
                    </h2>
                    <p className="text-slate-300 mt-1">Загрузка и управление голосовыми сэмплами</p>
                </div>
                <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
                    <DialogTrigger asChild>
                        <Button className="bg-purple-600 hover:bg-purple-700">
                            <Upload className="h-4 w-4 mr-2" />
                            Загрузить голос
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-md">
                        <DialogHeader>
                            <DialogTitle>Загрузка нового голоса</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                            <div>
                                <Label htmlFor="file">Аудио файл</Label>
                                <Input
                                    id="file"
                                    type="file"
                                    accept=".wav,.mp3,.m4a,.ogg"
                                    onChange={handleFileUpload}
                                    className="mt-1"
                                />
                            </div>
                            <div>
                                <Label htmlFor="voiceName">Имя голоса</Label>
                                <Input
                                    id="voiceName"
                                    value={voiceName}
                                    onChange={(e) => setVoiceName(e.target.value)}
                                    placeholder="Введите имя голоса"
                                    className="mt-1"
                                />
                            </div>
                            <div>
                                <Label htmlFor="voiceType">Тип голоса</Label>
                                <Select value={voiceType} onValueChange={setVoiceType}>
                                    <SelectTrigger className="mt-1">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="global">
                                            <div className="flex items-center gap-2">
                                                <Globe className="h-4 w-4" />
                                                Общий (для всех)
                                            </div>
                                        </SelectItem>
                                        <SelectItem value="user">
                                            <div className="flex items-center gap-2">
                                                <Users className="h-4 w-4" />
                                                Пользовательский
                                            </div>
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label htmlFor="refText">Референсный текст</Label>
                                <Textarea
                                    id="refText"
                                    value={refText}
                                    onChange={(e) => setRefText(e.target.value)}
                                    placeholder="Текст, который будет использоваться как референс для TTS"
                                    className="mt-1"
                                    rows={3}
                                />
                            </div>
                            <div className="flex gap-2">
                                <Button 
                                    onClick={handleUpload} 
                                    disabled={isUploading || !uploadFile || !voiceName.trim()}
                                    className="flex-1"
                                >
                                    {isUploading ? 'Загрузка...' : 'Загрузить'}
                                </Button>
                                <Button 
                                    variant="outline" 
                                    onClick={() => setUploadDialogOpen(false)}
                                >
                                    Отмена
                                </Button>
                            </div>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>

            {/* Список голосов */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {loading ? (
                    <div className="col-span-full text-center py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto"></div>
                        <p className="text-slate-400 mt-2">Загрузка голосов...</p>
                    </div>
                ) : voices.length === 0 ? (
                    <div className="col-span-full text-center py-8">
                        <Mic className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                        <p className="text-slate-400">Нет загруженных голосов</p>
                    </div>
                ) : (
                    voices.map((voice) => (
                        <Card key={`${voice.type}-${voice.name}`} className="bg-slate-800/50 border-slate-700">
                            <CardHeader className="pb-3">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        {voice.type === 'global' ? (
                                            <Globe className="h-4 w-4 text-blue-400" />
                                        ) : (
                                            <Users className="h-4 w-4 text-green-400" />
                                        )}
                                        <CardTitle className="text-white text-lg">{voice.name}</CardTitle>
                                    </div>
                                    <Badge variant="secondary" className={
                                        voice.type === 'global' 
                                            ? 'bg-blue-600/20 text-blue-300' 
                                            : 'bg-green-600/20 text-green-300'
                                    }>
                                        {voice.type === 'global' ? 'Общий' : 'Пользовательский'}
                                    </Badge>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-3">
                                <div className="text-sm text-slate-400">
                                    <p>Размер: {formatFileSize(voice.size)}</p>
                                    <p>Создан: {formatDate(voice.created)}</p>
                                </div>
                                
                                {voice.ref_text && (
                                    <div className="text-sm">
                                        <p className="text-slate-300 font-medium">Референсный текст:</p>
                                        <p className="text-slate-400 italic">"{voice.ref_text}"</p>
                                    </div>
                                )}
                                
                                <div className="flex gap-2">
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => openEditDialog(voice)}
                                        className="flex-1"
                                    >
                                        <Edit className="h-4 w-4 mr-1" />
                                        Редактировать
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="destructive"
                                        onClick={() => handleDelete(voice)}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    ))
                )}
            </div>

            {/* Диалог редактирования */}
            <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Редактирование голоса</DialogTitle>
                    </DialogHeader>
                    {selectedVoice && (
                        <div className="space-y-4">
                            <div>
                                <Label htmlFor="newName">Имя голоса</Label>
                                <Input
                                    id="newName"
                                    value={newName}
                                    onChange={(e) => setNewName(e.target.value)}
                                    className="mt-1"
                                />
                            </div>
                            <div>
                                <Label htmlFor="newRefText">Референсный текст</Label>
                                <Textarea
                                    id="newRefText"
                                    value={newRefText}
                                    onChange={(e) => setNewRefText(e.target.value)}
                                    className="mt-1"
                                    rows={3}
                                />
                            </div>
                            <div className="flex gap-2">
                                <Button 
                                    onClick={() => handleRename(selectedVoice)}
                                    disabled={!newName.trim()}
                                    className="flex-1"
                                >
                                    Переименовать
                                </Button>
                                <Button 
                                    onClick={() => handleUpdateRefText(selectedVoice)}
                                    className="flex-1"
                                >
                                    Обновить текст
                                </Button>
                            </div>
                            <Button 
                                variant="outline" 
                                onClick={() => setEditDialogOpen(false)}
                                className="w-full"
                            >
                                Отмена
                            </Button>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default VoiceManagement;
