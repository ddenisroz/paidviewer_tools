import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Upload, Trash2, Settings, TestTube2, Globe, User } from 'lucide-react';
import { Slider } from "@/components/ui/slider";
import { toast } from 'sonner';
import { useAuth } from '../../context/AuthContext';
import { getUserVoices, uploadUserVoice, deleteUserVoice, updateUserVoiceSettings, testVoice } from '../../services/unified-api';
import { Badge } from '@/components/ui/badge';


const VoiceManagementPage = () => {
    const [voices, setVoices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
    const [editDialogOpen, setEditDialogOpen] = useState(false);
    const [currentVoice, setCurrentVoice] = useState(null);
    const [uploadFile, setUploadFile] = useState(null);
    const [voiceName, setVoiceName] = useState('');
    const [isUploading, setIsUploading] = useState(false);
    
    const { user } = useAuth();
    let audioContext = null;
    let audioSource = null;

    const loadVoices = useCallback(async () => {
        if (!user) return;
        try {
            setLoading(true);
            const data = await getUserVoices(user.id);
            setVoices(data || []);
        } catch (error) {
            toast.error('Ошибка загрузки голосов');
            console.error('Error loading voices:', error);
        } finally {
            setLoading(false);
        }
    }, [user]);

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
        if (!uploadFile || !voiceName.trim() || !user) {
            toast.error('Выберите файл и введите имя голоса');
            return;
        }
        
        const userVoiceCount = voices.filter(v => v.voice_type === 'user').length;
        if (userVoiceCount >= 5) {
            toast.error('Вы достигли лимита в 5 пользовательских голосов.');
            return;
        }

        setIsUploading(true);
        try {
            await uploadUserVoice(user.id, uploadFile, voiceName.trim());
            toast.success(`Голос "${voiceName.trim()}" успешно загружен.`);
            setUploadDialogOpen(false);
            setUploadFile(null);
            setVoiceName('');
            loadVoices();
        } catch (error) {
            toast.error(error.message || 'Ошибка загрузки голоса');
        } finally {
            setIsUploading(false);
        }
    };

    const handleDelete = async (voiceId) => {
        const voiceToDelete = voices.find(v => v.id === voiceId);
        if (!voiceToDelete || !user || !window.confirm(`Вы уверены, что хотите удалить свой голос "${voiceToDelete.name}"?`)) {
            return;
        }
        
        if (voiceToDelete.voice_type !== 'user') {
            toast.error("Вы не можете удалять общие голоса.");
            return;
        }

        try {
            await deleteUserVoice(voiceId, user.id);
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
        if (!currentVoice || !user) return;
        try {
            await updateUserVoiceSettings(currentVoice.id, user.id, {
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
        <div className="container mx-auto p-4 md:p-6 lg:p-8 space-y-6">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-white">Управление голосами</h1>
                    <p className="text-slate-400 mt-1">Загружайте и настраивайте свои уникальные голоса для TTS.</p>
                </div>
                <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
                    <DialogTrigger asChild>
                        <Button className="bg-purple-600 hover:bg-purple-700 w-full md:w-auto">
                            <Upload className="h-4 w-4 mr-2" />
                            Загрузить свой голос
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-md">
                        <DialogHeader>
                            <DialogTitle>Загрузка нового голоса</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                             <div>
                                 <Label htmlFor="file">Аудио файл (.wav, до 10MB)</Label>
                                 <Input id="file" type="file" accept=".wav" onChange={handleFileUpload} className="mt-1" />
                             </div>
                             <div>
                                 <Label htmlFor="voiceName">Имя голоса</Label>
                                 <Input id="voiceName" value={voiceName} onChange={(e) => setVoiceName(e.target.value)} placeholder="e.g., my_voice" className="mt-1" />
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

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                 {loading ? (
                     <p className="text-slate-400 col-span-full">Загрузка голосов...</p>
                 ) : voices.map((voice) => (
                     <Card key={voice.id} className="bg-slate-800 border-slate-700 flex flex-col">
                         <CardHeader>
                             <div className="flex items-center justify-between">
                                 <CardTitle className="text-base font-medium text-white flex items-center gap-2">
                                     {voice.voice_type === 'global' ? <Globe className="h-4 w-4 text-blue-400"/> : <User className="h-4 w-4 text-green-400"/>}
                                     {voice.name}
                                 </CardTitle>
                                 <Badge variant={voice.voice_type === 'global' ? 'default' : 'secondary'}>{voice.voice_type}</Badge>
                             </div>
                         </CardHeader>
                          <CardContent className="flex-grow flex flex-col justify-between">
                              <p className="text-xs text-slate-400 italic break-words h-16 overflow-y-auto mb-4 p-2 bg-slate-900 rounded">
                                  "{voice.reference_text || "Нет референсного текста."}"
                              </p>
                              <div className="flex space-x-2">
                                  <Button className="flex-1" variant="outline" size="sm" onClick={() => handleEdit(voice)}><Settings className="h-4 w-4 mr-1"/>Настроить</Button>
                                  {voice.voice_type === 'user' && (
                                     <Button variant="destructive" size="icon" onClick={() => handleDelete(voice.id)}><Trash2 className="h-4 w-4"/></Button>
                                  )}
                              </div>
                          </CardContent>
                     </Card>
                 ))}
             </div>

             <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
                 <DialogContent>
                     <DialogHeader>
                         <DialogTitle>Настройки голоса "{currentVoice?.name}"</DialogTitle>
                     </DialogHeader>
                     {currentVoice && (
                         <div className="grid gap-6 py-4">
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

export default VoiceManagementPage;