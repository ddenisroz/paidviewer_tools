import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Upload, Trash2, Settings, TestTube2, Globe, User, Link, Copy } from 'lucide-react';
import { Slider } from "@/components/ui/slider";
import { toast } from 'sonner';
import { useAuth } from '../../context/AuthContext';
import { useTts } from '../../context/TtsContext';
import { 
    getUserVoices, 
    uploadUserVoice, 
    deleteUserVoice, 
    updateUserVoiceSettings, 
    transcribeUserVoice,
    testVoice,
    renameUserVoice
} from '../../services/unified-api';
import { generateObsUrl } from '../../services/microservices'; // Import directly
import { Badge } from '@/components/ui/badge';


const VoiceManagementPage = () => {
    const [voices, setVoices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
    const [editDialogOpen, setEditDialogOpen] = useState(false);
    const [currentVoice, setCurrentVoice] = useState(null);
    const [uploadFile, setUploadFile] = useState(null);
    const [voiceName, setVoiceName] = useState('');
    const [testText, setTestText] = useState("Ну так я гетеро, че мне пидоров бояться!");
    const [isUploading, setIsUploading] = useState(false);
    const [obsUrl, setObsUrl] = useState('');
    const [isTranscribing, setIsTranscribing] = useState(false);
    
    const { user } = useAuth();
    const { initializeTts } = useTts();
    let audioContext = null;
    let audioSource = null;

    // Инициализируем TTS только при загрузке этой страницы
    useEffect(() => {
        initializeTts();
    }, [initializeTts]);

    const loadVoices = useCallback(async () => {
        if (!user) return;
        try {
            setLoading(true);
            const response = await getUserVoices(user.id);
            console.log('Voices response:', response);
            // Проверяем, что response.data существует и является массивом
            const voicesData = response?.data || response || [];
            setVoices(Array.isArray(voicesData) ? voicesData : []);
        } catch (error) {
            toast.error('Ошибка загрузки голосов');
            console.error('Error loading voices:', error);
            setVoices([]); // Устанавливаем пустой массив в случае ошибки
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
            const formData = new FormData();
            formData.append('file', uploadFile);
            formData.append('name', voiceName.trim());
            formData.append('user_id', user.id);
            
            await uploadUserVoice(user.id, formData);
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

    const handleTranscribe = async () => {
        if (!currentVoice) return;
        
        setIsTranscribing(true);
        try {
            const response = await transcribeUserVoice(currentVoice.id, user.id);
            const newReferenceText = response.data.reference_text;
            
            // Обновляем локальное состояние
            setCurrentVoice(prev => ({...prev, reference_text: newReferenceText}));
            
            // Обновляем в списке голосов
            setVoices(prev => prev.map(voice => 
                voice.id === currentVoice.id 
                    ? {...voice, reference_text: newReferenceText}
                    : voice
            ));
            
            toast.success('Транскрипция завершена успешно!');
        } catch (error) {
            console.error('Error transcribing voice:', error);
            toast.error('Ошибка при транскрипции аудио');
        } finally {
            setIsTranscribing(false);
        }
    };

    const handleReferenceTextChange = (value) => {
        setCurrentVoice(prev => ({...prev, reference_text: value}));
    };

    const handleRenameVoice = async () => {
        if (!currentVoice || !user) return;
        
        const newName = prompt('Введите новое имя голоса:', currentVoice.name);
        if (!newName || newName.trim() === '' || newName === currentVoice.name) return;
        
        try {
            await renameUserVoice(currentVoice.id, user.id, newName.trim());
            
            // Обновляем в списке голосов
            setVoices(prev => prev.map(voice => 
                voice.id === currentVoice.id 
                    ? {...voice, name: newName.trim()}
                    : voice
            ));
            
            // Обновляем currentVoice
            setCurrentVoice(prev => ({...prev, name: newName.trim()}));
            
            toast.success('Голос переименован успешно!');
        } catch (error) {
            console.error('Error renaming voice:', error);
            toast.error('Ошибка при переименовании голоса');
        }
    };

    const handleSaveSettings = async () => {
        if (!currentVoice) return;
        
        try {
            const settings = {
                cfg_strength: currentVoice.cfg_strength,
                reference_text: currentVoice.reference_text
            };
            
            await updateUserVoiceSettings(currentVoice.id, user.id, settings);
            
            // Обновляем в списке голосов
            setVoices(prev => prev.map(voice => 
                voice.id === currentVoice.id 
                    ? {...voice, ...settings}
                    : voice
            ));
            
            setEditDialogOpen(false);
            toast.success('Настройки голоса сохранены!');
        } catch (error) {
            console.error('Error updating voice settings:', error);
            toast.error('Ошибка при сохранении настроек');
        }
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
                testText,
                currentVoice.cfg_strength  // Передаем текущее значение ползунка
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
                if (!currentVoice || !user) return;
                try {
                    await updateUserVoiceSettings(currentVoice.id, user.id, {
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

    const handleGenerateObsUrl = async () => {
        try {
            const response = await generateObsUrl();
            const fullUrl = `${window.location.origin}/tts-obs/${response.data.obs_token}`;
            setObsUrl(fullUrl);
            toast.success('Ссылка для OBS успешно создана!');
        } catch (error) {
            toast.error('Не удалось создать ссылку для OBS.');
            console.error('Failed to generate OBS URL:', error);
        }
    };

    const copyToClipboard = () => {
        navigator.clipboard.writeText(obsUrl);
        toast.success('Ссылка скопирована в буфер обмена!');
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

            {/* OBS Integration Card */}
            <Card className="bg-slate-800 border-slate-700">
                <CardHeader>
                    <CardTitle className="text-white flex items-center gap-2">
                        <Link className="h-5 w-5 text-purple-400" />
                        Интеграция с OBS
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-slate-400 mb-4">
                        Используйте эту ссылку как источник браузера в OBS для вывода звука TTS в прямой эфир.
                        Ссылка уникальна для вашего аккаунта, не делитесь ей ни с кем.
                    </p>
                    {obsUrl ? (
                        <div className="flex items-center gap-2">
                            <Input type="text" value={obsUrl} readOnly className="bg-slate-900" />
                            <Button onClick={copyToClipboard} variant="outline" size="icon">
                                <Copy className="h-4 w-4" />
                            </Button>
                        </div>
                    ) : (
                        <Button onClick={handleGenerateObsUrl} className="bg-purple-600 hover:bg-purple-700">
                            Сгенерировать ссылку
                        </Button>
                    )}
                </CardContent>
            </Card>

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
                                 <Button className="flex-1" variant="outline" size="sm" onClick={() => { setCurrentVoice(voice); handleTestVoice(); }}><TestTube2 className="h-4 w-4 mr-1"/>Тест</Button>
                                 {voice.voice_type === 'user' && (
                                    <Button variant="destructive" size="icon" onClick={() => handleDelete(voice.id)}><Trash2 className="h-4 w-4"/></Button>
                                 )}
                             </div>
                          </CardContent>
                     </Card>
                 ))}
             </div>

             {/* Диалог редактирования голоса */}
            <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Настройки голоса "{currentVoice?.name}"</DialogTitle>
                    </DialogHeader>
                    {currentVoice && (
                        <div className="space-y-4 py-4">
                            <div>
                                <Label htmlFor="reference-text">Референсный текст</Label>
                                <Textarea
                                  id="reference-text"
                                  value={currentVoice.reference_text || ''}
                                  onChange={(e) => handleReferenceTextChange(e.target.value)}
                                  className="mt-1 bg-slate-800"
                                  rows={3}
                                  placeholder="Введите референсный текст для синтеза..."
                                />
                                <div className="flex gap-2 mt-2">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={handleTranscribe}
                                        disabled={isTranscribing}
                                    >
                                        {isTranscribing ? 'Транскрибирую...' : 'Авто-транскрипция'}
                                    </Button>
                                </div>
                                <p className="text-sm text-muted-foreground mt-1">
                                    Редактируйте текст или используйте автоматическую транскрипцию аудиофайла.
                                </p>
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
                        <Button onClick={handleRenameVoice} variant="outline" className="text-orange-600 border-orange-600 hover:bg-orange-600 hover:text-white">
                            <Link className="h-4 w-4 mr-2"/>Переименовать
                        </Button>
                        <Button onClick={handleSaveSettings} className="bg-blue-600 hover:bg-blue-700">
                            <Settings className="h-4 w-4 mr-2"/>Сохранить
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default VoiceManagementPage;