import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Upload, Trash2, Edit, Users, Globe, Settings, TestTube2 } from 'lucide-react';
import { Slider } from "@/components/ui/slider"
import { toast } from 'sonner';
import { getAdminVoices, uploadVoice, deleteVoice, updateVoiceSettings, testVoice } from '../../services/unified-api';
import { useAuth } from '../../context/AuthContext';

const VoiceManagement = () => {
    const [voices, setVoices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
    const [editDialogOpen, setEditDialogOpen] = useState(false);
    
    const [currentVoice, setCurrentVoice] = useState(null);
    
    // Состояние для загрузки
    const [uploadFile, setUploadFile] = useState(null);
    const [voiceName, setVoiceName] = useState('');
    const [ownerId, setOwnerId] = useState('');
    const [isUploading, setIsUploading] = useState(false);
    
    const { user } = useAuth();
    let audioContext = null;
    let audioSource = null;

    const loadVoices = useCallback(async () => {
        try {
            setLoading(true);
            const data = await getAdminVoices();
            setVoices(data || []);
        } catch (error) {
            toast.error('Ошибка загрузки голосов');
            console.error('Error loading voices:', error);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadVoices();
    }, [loadVoices]);

    const handleFileUpload = (event) => {
        const file = event.target.files[0];
        if (file) {
            setUploadFile(file);
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
            await uploadVoice(uploadFile, voiceName.trim(), ownerId.trim() || null);
            
            toast.success(`Голос "${voiceName.trim()}" успешно загружен.`);
            setUploadDialogOpen(false);
            setUploadFile(null);
            setVoiceName('');
            setOwnerId('');
            loadVoices();
        } catch (error) {
            toast.error(error.message || 'Ошибка загрузки голоса');
        } finally {
            setIsUploading(false);
        }
    };

    const handleDelete = async (voiceId) => {
        const voiceToDelete = voices.find(v => v.id === voiceId);
        if (!voiceToDelete || !window.confirm(`Вы уверены, что хотите удалить голос "${voiceToDelete.name}"?`)) {
            return;
        }

        try {
            await deleteVoice(voiceId);
            toast.success(`Голос "${voiceToDelete.name}" удален.`);
            loadVoices();
        } catch (error) {
            toast.error(error.message || 'Ошибка удаления голоса');
        }
    };
    
    const handleEdit = (voice) => {
        setCurrentVoice({ ...voice });
        setEditDialogOpen(true);
    };

    const handleUpdateSettings = async () => {
        if (!currentVoice) return;
        try {
            await updateVoiceSettings(currentVoice.id, {
                speed: currentVoice.speed,
                pitch: currentVoice.pitch,
                volume: currentVoice.volume,
            });
            toast.success(`Настройки голоса "${currentVoice.name}" обновлены.`);
            setEditDialogOpen(false);
            loadVoices();
        } catch (error) {
            toast.error(error.message || 'Ошибка обновления настроек');
        }
    };
    
    const playAudio = (buffer) => {
        if (audioSource) {
            audioSource.stop();
        }
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        audioSource = audioContext.createBufferSource();
        audioContext.decodeAudioData(buffer, (decodedBuffer) => {
            audioSource.buffer = decodedBuffer;
            audioSource.connect(audioContext.destination);
            audioSource.start(0);
        }, (error) => {
            console.error('Error decoding audio data', error);
            toast.error('Не удалось воспроизвести аудио');
        });
    };

    const handleTestVoice = async () => {
        if (!currentVoice || !user) return;
        try {
            const audioBlob = await testVoice(
                currentVoice.name,
                user.id,
                currentVoice.speed,
                currentVoice.pitch,
                currentVoice.volume
            );
            const arrayBuffer = await audioBlob.arrayBuffer();
            playAudio(arrayBuffer);
        } catch (error) {
            toast.error(error.message || 'Ошибка тестирования голоса');
        }
    };

    const handleSliderChange = (value, field) => {
        if (currentVoice) {
            setCurrentVoice(prev => ({ ...prev, [field]: value[0] }));
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                        <Mic className="h-6 w-6 text-purple-400" />
                        Управление голосами
                    </h2>
                    <p className="text-slate-300 mt-1">Загрузка и управление всеми голосовыми сэмплами</p>
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
                        <div className="space-y-4 py-4">
                            <div>
                                <Label htmlFor="file">Аудио файл (.wav)</Label>
                                <Input id="file" type="file" accept=".wav" onChange={handleFileUpload} className="mt-1" />
                            </div>
                            <div>
                                <Label htmlFor="voiceName">Имя голоса</Label>
                                <Input id="voiceName" value={voiceName} onChange={(e) => setVoiceName(e.target.value)} placeholder="e.g., speaker1" className="mt-1" />
                            </div>
                            <div>
                                <Label htmlFor="ownerId">ID пользователя (опционально)</Label>
                                <Input id="ownerId" value={ownerId} onChange={(e) => setOwnerId(e.target.value)} placeholder="e.g., 75969278" className="mt-1" />
                                <p className="text-sm text-muted-foreground mt-1">Оставьте пустым для создания общего голоса.</p>
                            </div>
                        </div>
                         <DialogFooter>
                             <Button onClick={() => setUploadDialogOpen(false)} variant="outline">Отмена</Button>
                             <Button onClick={handleUpload} disabled={isUploading || !uploadFile || !voiceName.trim()}>
                                 {isUploading ? 'Загрузка...' : 'Загрузить и транскрибировать'}
                             </Button>
                         </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>

            <Card className="bg-slate-800/50 border-slate-700">
                 <CardHeader>
                    <CardTitle>Список голосов</CardTitle>
                 </CardHeader>
                 <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                         {loading ? (
                             <p>Загрузка...</p>
                         ) : voices.map((voice) => (
                             <Card key={voice.id} className="bg-slate-800 border-slate-700">
                                <CardHeader>
                                    <div className="flex items-center justify-between">
                                        <CardTitle className="text-base font-medium text-white flex items-center gap-2">
                                            {voice.voice_type === 'global' ? <Globe className="h-4 w-4 text-blue-400"/> : <Users className="h-4 w-4 text-green-400"/>}
                                            {voice.name}
                                        </CardTitle>
                                        <Badge variant={voice.voice_type === 'global' ? 'default' : 'secondary'}>{voice.voice_type}</Badge>
                                    </div>
                                    {voice.voice_type === 'user' && <p className="text-xs text-slate-400">Owner ID: {voice.owner_id}</p>}
                                </CardHeader>
                                 <CardContent>
                                     <p className="text-xs text-slate-400 italic break-words h-12 overflow-y-auto">
                                         "{voice.reference_text || "Нет референсного текста."}"
                                     </p>
                                     <div className="flex space-x-2 pt-4">
                                         <Button variant="outline" size="sm" onClick={() => handleEdit(voice)}><Settings className="h-4 w-4 mr-1"/>Настроить</Button>
                                         <Button variant="destructive" size="sm" onClick={() => handleDelete(voice.id)}><Trash2 className="h-4 w-4"/></Button>
                                     </div>
                                 </CardContent>
                             </Card>
                         ))}
                     </div>
                 </CardContent>
             </Card>

            <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Настройки голоса "{currentVoice?.name}"</DialogTitle>
                    </DialogHeader>
                    {currentVoice && (
                        <div className="grid gap-6 py-4">
                            <div>
                                <Label htmlFor="reference-text">Референсный текст</Label>
                                <Textarea
                                  id="reference-text"
                                  value={currentVoice.reference_text || ''}
                                  readOnly
                                  className="mt-1 bg-slate-800"
                                  rows={3}
                                />
                                <p className="text-sm text-muted-foreground mt-1">Текст сгенерирован автоматически. Редактирование недоступно.</p>
                            </div>
                            <div className="space-y-2">
                                <Label>Скорость: {currentVoice.speed.toFixed(2)}</Label>
                                <Slider value={[currentVoice.speed]} onValueChange={(v) => handleSliderChange(v, 'speed')} min={0.5} max={2.0} step={0.05} />
                            </div>
                            <div className="space-y-2">
                                <Label>Тон: {currentVoice.pitch.toFixed(2)}</Label>
                                <Slider value={[currentVoice.pitch]} onValueChange={(v) => handleSliderChange(v, 'pitch')} min={0.5} max={2.0} step={0.05} />
                            </div>
                            <div className="space-y-2">
                                <Label>Громкость: {currentVoice.volume.toFixed(2)}</Label>
                                <Slider value={[currentVoice.volume]} onValueChange={(v) => handleSliderChange(v, 'volume')} min={0.1} max={1.5} step={0.05} />
                            </div>
                        </div>
                    )}
                    <DialogFooter>
                        <Button onClick={handleTestVoice} variant="outline"><TestTube2 className="h-4 w-4 mr-2"/>Тест</Button>
                        <Button onClick={handleUpdateSettings}>Применить</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default VoiceManagement;
