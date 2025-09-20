import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Upload, Trash2, Edit, Users, Globe, Settings, TestTube2, Mic } from 'lucide-react';
import { Slider } from "@/components/ui/slider"
import { toast } from 'sonner';
import { getAdminVoices, uploadVoice, deleteVoice, updateVoiceSettings, testVoice, getUsers } from '../../services/unified-api';
import { useAuth } from '../../context/AuthContext';

const VoiceManagement = () => {
    const [voices, setVoices] = useState([]);
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
    const [testText, setTestText] = useState("Ну так я гетеро, че мне пидоров бояться!");
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
            // Убеждаемся, что data является массивом
            const voicesData = Array.isArray(data) ? data : (data?.data || []);
            setVoices(voicesData);
        } catch (error) {
            toast.error('Ошибка загрузки голосов');
            console.error('Error loading voices:', error);
            setVoices([]); // Устанавливаем пустой массив в случае ошибки
        } finally {
            setLoading(false);
        }
    }, []);

    const loadUsers = useCallback(async () => {
        try {
            const data = await getUsers();
            setUsers(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error('Error loading users:', error);
            setUsers([]);
        }
    }, []);

    useEffect(() => {
        loadVoices();
        // Временно отключаем загрузку пользователей
        // loadUsers();
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
            const formData = new FormData();
            formData.append('file', uploadFile);
            formData.append('voice_name', voiceName.trim());
            if (ownerId === 'user') {
                formData.append('owner_id', 'temp_user_id');
            }
            
            await uploadVoice(formData);
            
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

    // Voice settings removed - F5-TTS uses dynamic settings based on text length
    
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
            const response = await testVoice(
                currentVoice.name,
                user.id,
                testText
            );
            
            // Получаем URL аудио из ответа
            const audioUrl = response.data.audio_url;
            if (audioUrl) {
                // Создаем полный URL
                const fullAudioUrl = `http://localhost:8001${audioUrl}`;
                const audio = new Audio(fullAudioUrl);
                audio.play().catch(() => {
                    toast.error('Не удалось воспроизвести аудио');
                });
            } else {
                toast.error('Не удалось получить аудио для воспроизведения');
            }
        } catch (error) {
            toast.error(error.message || 'Ошибка тестирования голоса');
        }
    };

            const handleUpdateSettings = async () => {
                if (!currentVoice) return;
                try {
                    await updateVoiceSettings(currentVoice.id, {
                        cfg_strength: currentVoice.cfg_strength
                        // Только cfg_strength настраивается пользователем
                    });
                    toast.success(`Настройки голоса "${currentVoice.name}" обновлены.`);
                    setEditDialogOpen(false);
                    loadVoices();
                } catch (error) {
                    toast.error(error.message || 'Ошибка обновления настроек');
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
                                <Label htmlFor="ownerId">Тип голоса</Label>
                                <Select value={ownerId} onValueChange={setOwnerId}>
                                    <SelectTrigger className="mt-1">
                                        <SelectValue placeholder="Выберите тип голоса" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="global">Глобальный голос</SelectItem>
                                        <SelectItem value="user">Пользовательский голос</SelectItem>
                                    </SelectContent>
                                </Select>
                                <p className="text-sm text-muted-foreground mt-1">Глобальный голос доступен всем, пользовательский - только конкретному пользователю</p>
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
                         ) : Array.isArray(voices) && voices.length > 0 ? voices.map((voice) => (
                             <Card key={voice.id} className="bg-slate-800 border-slate-700">
                                <CardHeader>
                                    <div className="flex items-center justify-between">
                                        <CardTitle className="text-base font-medium text-white flex items-center gap-2">
                                            {voice.voice_type === 'global' ? <Globe className="h-4 w-4 text-blue-400"/> : <Users className="h-4 w-4 text-green-400"/>}
                                            {voice.name}
                                        </CardTitle>
                                        <Badge variant={voice.voice_type === 'global' ? 'default' : 'secondary'}>{voice.voice_type}</Badge>
                                    </div>
                                    {voice.voice_type === 'user' && (
                                        <div className="text-xs text-slate-400">
                                            {(() => {
                                                const owner = users.find(u => u.id === voice.owner_id);
                                                return owner ? (
                                                    <div className="flex items-center gap-1">
                                                        <Users className="h-3 w-3" />
                                                        <span>{owner.display_name || owner.username}</span>
                                                        {owner.is_online && <Badge variant="outline" className="text-xs">Онлайн</Badge>}
                                                    </div>
                                                ) : (
                                                    <span>Owner ID: {voice.owner_id}</span>
                                                );
                                            })()}
                                        </div>
                                    )}
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
                         )) : (
                             <div className="col-span-full text-center py-8">
                                 <p className="text-slate-400">Голосов не найдено</p>
                             </div>
                         )}
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
                            
                            <div>
                                <Label htmlFor="test-text">Текст для тестирования</Label>
                                <Textarea
                                  id="test-text"
                                  value={testText}
                                  onChange={(e) => setTestText(e.target.value)}
                                  className="mt-1"
                                  rows={3}
                                  placeholder="Введите текст для тестирования голоса..."
                                />
                                <p className="text-sm text-muted-foreground mt-1">Введите текст, который хотите озвучить для тестирования</p>
                            </div>
                            
                            {/* Настройки генерации TTS */}
                            <div className="space-y-4">
                                <h4 className="text-sm font-medium text-white">Настройки генерации</h4>
                                
                                {/* Единственный настраиваемый параметр */}
                                <div>
                                    <Label htmlFor="cfg-strength">CFG Strength: {currentVoice.cfg_strength}</Label>
                                    <Slider
                                        id="cfg-strength"
                                        min={0.1}
                                        max={10.0}
                                        step={0.1}
                                        value={[currentVoice.cfg_strength]}
                                        onValueChange={(value) => setCurrentVoice(prev => ({ ...prev, cfg_strength: value[0] }))}
                                        className="mt-2"
                                    />
                                    <p className="text-xs text-muted-foreground mt-1">Сила классификатора (0.1-10.0) - единственный настраиваемый параметр</p>
                                </div>
                                
                                {/* Автоматически определяемые параметры (только для отображения) */}
                                <div className="space-y-2 pt-2 border-t border-slate-600">
                                    <h5 className="text-xs font-medium text-slate-300">Автоматически определяемые системой</h5>
                                    
                                    <div className="flex justify-between text-xs text-slate-400">
                                        <span>Speed: 0.1-1.0</span>
                                        <span className="text-slate-500">По длине текста</span>
                                    </div>
                                    
                                    <div className="flex justify-between text-xs text-slate-400">
                                        <span>NFE Steps: 18-26</span>
                                        <span className="text-slate-500">По длине текста</span>
                                    </div>
                                </div>
                                
                                {/* Фиксированные параметры */}
                                <div className="space-y-2 pt-2 border-t border-slate-600">
                                    <h5 className="text-xs font-medium text-slate-300">Фиксированные параметры</h5>
                                    
                                    <div className="flex justify-between text-xs text-slate-400">
                                        <span>Target RMS: 0.2</span>
                                        <span className="text-slate-500">Фиксированное значение</span>
                                    </div>
                                    
                                    <div className="flex justify-between text-xs text-slate-400">
                                        <span>Cross Fade Duration: 0.15</span>
                                        <span className="text-slate-500">Фиксированное значение</span>
                                    </div>
                                    
                                    <div className="flex justify-between text-xs text-slate-400">
                                        <span>Silence Duration: 100ms</span>
                                        <span className="text-slate-500">Фиксированное значение</span>
                                    </div>
                                    
                                    <div className="flex justify-between text-xs text-slate-400">
                                        <span>Sway Sampling Coef: -1.0</span>
                                        <span className="text-slate-500">Фиксированное значение</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                    <DialogFooter>
                        <Button onClick={handleTestVoice} variant="outline"><TestTube2 className="h-4 w-4 mr-2"/>Тест</Button>
                        <Button onClick={handleUpdateSettings} className="bg-blue-600 hover:bg-blue-700">
                            <Settings className="h-4 w-4 mr-2"/>Применить
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default VoiceManagement;
