import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Upload, Trash2, Settings, TestTube2, Globe, User, Edit } from 'lucide-react';
import { Slider } from "@/components/ui/slider";
import { useToast } from '../../components/ui/toast';
import { useButtonPosition } from '../../hooks/useButtonPosition';
import { useAuth } from '../../context/AuthContext';
import { useTts } from '../../context/TtsContext';
import { useTtsHealth } from '../../context/TtsHealthContext';
import TtsErrorCard from '../../components/TtsErrorCard';
import { 
    getUserVoices, 
    uploadUserVoice, 
    deleteUserVoice, 
    updateUserVoiceSettings, 
    transcribeUserVoice,
    testVoice,
    renameUserVoice,
    getGlobalVoices
} from '../../services/unified-api';
import { Badge } from '@/components/ui/badge';
import { PageLoader } from '@/components/ui/loader';
import { useLoadingState } from '../../hooks/useLoadingState';
import { TTS_SERVICE_URL } from '@/services/microservices';


const VoiceManagementPageContent = () => {
    const { addToast } = useToast();
    const { getButtonPosition } = useButtonPosition();
    const [voices, setVoices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
    const [editDialogOpen, setEditDialogOpen] = useState(false);
    const [currentVoice, setCurrentVoice] = useState(null);
    const [uploadFile, setUploadFile] = useState(null);
    const [voiceName, setVoiceName] = useState('');
    const [testText, setTestText] = useState("Ну так я гетеро, че мне пидоров бояться!");
    const [isUploading, setIsUploading] = useState(false);
    const [isTranscribing, setIsTranscribing] = useState(false);
    const [voiceVolumes, setVoiceVolumes] = useState({}); // {voice_name: volume_level}
    
    const { user } = useAuth();
    const { initializeTts, engineStatus } = useTts();
    const { isHealthy, isChecking } = useTtsHealth();
    let audioContext = null;
    let audioSource = null;
    
    // Используем хук для управления состоянием загрузки
    const showLoader = useLoadingState(isChecking);

    // Загрузка индивидуальной громкости для голоса
    const loadVoiceVolume = async (voiceName) => {
        try {
            const response = await fetch(`/api/tts/voice-volume/${encodeURIComponent(voiceName)}`, {
                credentials: 'include'
            });
            if (response.ok) {
                const data = await response.json();
                setVoiceVolumes(prev => ({
                    ...prev,
                    [voiceName]: data.volume_level
                }));
                return data.volume_level;
            }
        } catch (error) {
            console.error('Error loading voice volume:', error);
        }
        return 50.0; // Значение по умолчанию
    };

    // Сохранение индивидуальной громкости для голоса
    const saveVoiceVolume = async (voiceName, volumeLevel) => {
        try {
            const response = await fetch('/api/tts/voice-volume', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    voice_name: voiceName,
                    volume_level: volumeLevel
                }),
                credentials: 'include'
            });

            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    setVoiceVolumes(prev => ({
                        ...prev,
                        [voiceName]: volumeLevel
                    }));
                    addToast(`Громкость голоса "${voiceName}" установлена: ${volumeLevel}%`, 'success');
                    return true;
                }
            }
        } catch (error) {
            console.error('Error saving voice volume:', error);
        }
        addToast('Ошибка сохранения громкости голоса', 'error');
        return false;
    };

    // Инициализируем TTS только при загрузке этой страницы
    useEffect(() => {
        initializeTts();
    }, [initializeTts]);

    const loadVoices = useCallback(async () => {
        if (!user) return;
        try {
            setLoading(true);
            let response;
            if (user.isGuest) {
                // Для гостей загружаем только глобальные голоса
                response = await getGlobalVoices();
            } else {
                // Для авторизованных пользователей загружаем их голоса
                response = await getUserVoices(user.id);
            }
            console.log('Voices response:', response);
            // Проверяем, что response.data существует и является массивом
            const voicesData = response?.data || response || [];
            const voicesArray = Array.isArray(voicesData) ? voicesData : [];
            setVoices(voicesArray);
            
            // Загружаем индивидуальные громкости для всех голосов
            if (!user.isGuest && voicesArray.length > 0) {
                for (const voice of voicesArray) {
                    if (voice.name) {
                        await loadVoiceVolume(voice.name);
                    }
                }
            }
        } catch (error) {
            addToast({ type: 'error', title: 'Ошибка', message: 'Не удалось загрузить голоса.' });
            console.error('Error loading voices:', error);
            setVoices([]); // Устанавливаем пустой массив в случае ошибки
        } finally {
            setLoading(false);
        }
    }, [user, addToast]);

    useEffect(() => {
        if (isHealthy) {
            loadVoices();
        }
    }, [isHealthy, loadVoices]);

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
            addToast({ type: 'error', title: 'Ошибка', message: 'Выберите файл и введите имя голоса.' });
            return;
        }
        
        const userVoiceCount = voices.filter(v => v.voice_type === 'user').length;
        if (userVoiceCount >= 5) {
            addToast({ type: 'error', title: 'Лимит достигнут', message: 'Вы достигли лимита в 5 пользовательских голосов.' });
            return;
        }

        setIsUploading(true);
        try {
            const formData = new FormData();
            formData.append('file', uploadFile);
            formData.append('name', voiceName.trim());
            formData.append('user_id', user.id);
            
            await uploadUserVoice(user.id, formData);
            addToast({ type: 'success', title: 'Успех', message: `Голос "${voiceName.trim()}" успешно загружен.` });
            setUploadDialogOpen(false);
            setUploadFile(null);
            setVoiceName('');
            loadVoices();
        } catch (error) {
            addToast({ type: 'error', title: 'Ошибка', message: error.message || 'Не удалось загрузить голос.' });
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
            addToast({ type: 'error', title: 'Ошибка', message: 'Вы не можете удалять общие голоса.' });
            return;
        }

        try {
            await deleteUserVoice(voiceId, user.id);
            addToast({ type: 'success', title: 'Успех', message: `Голос "${voiceToDelete.name}" удален.` });
            loadVoices();
        } catch (error) {
            addToast({ type: 'error', title: 'Ошибка', message: error.message || 'Не удалось удалить голос.' });
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
            
            addToast({ type: 'success', title: 'Успех', message: 'Транскрипция завершена успешно!' });
        } catch (error) {
            console.error('Error transcribing voice:', error);
            addToast({ type: 'error', title: 'Ошибка', message: 'Не удалось выполнить транскрипцию аудио.' });
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
            
            addToast({ type: 'success', title: 'Успех', message: 'Голос переименован успешно!' });
        } catch (error) {
            console.error('Error renaming voice:', error);
            addToast({ type: 'error', title: 'Ошибка', message: 'Не удалось переименовать голос.' });
        }
    };

    const handleSaveSettings = async () => {
        if (!currentVoice) return;
        
        try {
            const settings = {
                cfg_strength: currentVoice.cfg_strength,
                speed_preset: currentVoice.speed_preset,
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
            addToast({ type: 'success', title: 'Успех', message: 'Настройки голоса сохранены!' });
        } catch (error) {
            console.error('Error updating voice settings:', error);
            addToast({ type: 'error', title: 'Ошибка', message: 'Не удалось сохранить настройки.' });
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
            addToast({ type: 'error', title: 'Ошибка', message: 'Не удалось воспроизвести аудио.' });
        });
    };
    
    const handleTestVoice = async () => {
        if (!currentVoice || !user) return;
        try {
            const response = await testVoice(
                currentVoice.name,
                user.id,
                testText,
                currentVoice.cfg_strength,  // Передаем текущее значение ползунка
                currentVoice.speed_preset   // Передаем текущий пресет скорости
            );
            
            // Получаем URL аудио из ответа
            const audioUrl = response.data.audio_url;
            if (audioUrl) {
                try {
                    // Убираем кэш-бастинг, т.к. аудио уже проигрывается
                    const audio = new Audio(`${TTS_SERVICE_URL}${audioUrl}`);
                    audio.play();
                    // Освобождаем ресурсы после проигрывания
                    audio.onended = () => {
                        URL.revokeObjectURL(audio.src);
                    };
                } catch (error) {
                    console.error("Error playing audio:", error);
                    addToast({ type: 'error', title: 'Ошибка', message: 'Не удалось воспроизвести аудио.' });
                }
            } else {
                addToast({ type: 'error', title: 'Ошибка', message: 'Не удалось получить аудио для воспроизведения.' });
            }
        } catch (error) {
            addToast({ type: 'error', title: 'Ошибка', message: error.message || 'Не удалось протестировать голос.' });
        }
    };

            const handleUpdateSettings = async () => {
                if (!currentVoice || !user) return;
                try {
                    await updateUserVoiceSettings(currentVoice.id, user.id, {
                        cfg_strength: currentVoice.cfg_strength
                        // Только cfg_strength настраивается пользователем
                    });
                    addToast({ type: 'success', title: 'Успех', message: `Настройки голоса "${currentVoice.name}" обновлены.` });
                    setEditDialogOpen(false);
                    loadVoices();
                } catch (error) {
                    addToast({ type: 'error', title: 'Ошибка', message: error.message || 'Не удалось обновить настройки.' });
                }
            };

    const handleSliderChange = (value, field) => {
        if (currentVoice) {
            setCurrentVoice(prev => ({ ...prev, [field]: value[0] }));
        }
    };


    // Показываем прелоадер пока проверяется health или загружаются голоса
    if (showLoader) {
        return (
            <div className="container mx-auto p-4 md:p-6 lg:p-8 space-y-6">
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-white">Управление голосами</h1>
                        <p className="text-slate-400 mt-1">Загружайте и настраивайте свои уникальные голоса для TTS.</p>
                    </div>
                </div>
                <PageLoader message="Проверка состояния TTS сервиса..." />
            </div>
        );
    }

    // Заглушка когда TTS недоступен
    if (!isHealthy) {
        return (
            <div className="container mx-auto p-4 md:p-6 lg:p-8 space-y-6">
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-white">Управление голосами</h1>
                        <p className="text-slate-400 mt-1">Загружайте и настраивайте свои уникальные голоса для TTS.</p>
                    </div>
                </div>
                
                <TtsErrorCard
                    title="TTS сервер недоступен"
                    description="В данный момент сервис TTS недоступен. Управление голосами временно отключено."
                    suggestion="Попробуйте обновить страницу через несколько минут."
                />
            </div>
        );
    }

    return (
        <div className="container mx-auto p-4 md:p-6 lg:p-8 space-y-6">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-white">Управление голосами</h1>
                    {user?.isGuest ? (
                        <div className="mt-1">
                            <p className="text-slate-400">Гостевой режим: используйте только глобальные голоса.</p>
                            <p className="text-slate-500 text-sm">Для загрузки собственных голосов войдите в систему.</p>
                        </div>
                    ) : (
                        <p className="text-slate-400 mt-1">Загружайте и настраивайте свои уникальные голоса для TTS.</p>
                    )}
                </div>
                <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
                    {!user?.isGuest && (
                        <DialogTrigger asChild>
                            <Button className="bg-purple-600 hover:bg-purple-700 w-full md:w-auto">
                                <Upload className="h-4 w-4 mr-2" />
                                Загрузить свой голос
                            </Button>
                        </DialogTrigger>
                    )}
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
                 ) : voices.length === 0 ? (
                     <div className="col-span-full text-center py-12">
                         <div className="text-slate-400 text-lg mb-4">
                             <User className="h-12 w-12 mx-auto mb-4 text-slate-500" />
                             <p>Загрузите свой первый голос</p>
                         </div>
                     </div>
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
                            
                            {/* Индивидуальная громкость голоса */}
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <Label htmlFor="voice-volume">Индивидуальная громкость</Label>
                                    <span className="text-sm text-purple-400 font-medium">
                                        {voiceVolumes[currentVoice.name] || 50}%
                                    </span>
                                </div>
                                <div className="space-y-2">
                                    <Slider
                                        id="voice-volume"
                                        min={0}
                                        max={100}
                                        step={1}
                                        value={[voiceVolumes[currentVoice.name] || 50]}
                                        onValueChange={async (value) => {
                                            const newVolume = value[0];
                                            await saveVoiceVolume(currentVoice.name, newVolume);
                                        }}
                                        className="w-full"
                                    />
                                    <div className="flex justify-between text-xs text-gray-400">
                                        <span>Тихо (0%)</span>
                                        <span>Громко (100%)</span>
                                    </div>
                                </div>
                                <div className="text-xs text-gray-400 bg-gray-800 p-2 rounded">
                                    💡 <strong>Приоритет:</strong> Эта настройка имеет приоритет над общей громкостью TTS. 
                                    Если не установлена, используется общая громкость (50% по умолчанию).
                                </div>
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
                            </div>
                            
                            {/* Настройки генерации TTS */}
                            <div className="space-y-4">
                                <h4 className="text-sm font-medium text-white">Настройки генерации</h4>
                                
                                {/* Единственный настраиваемый параметр */}
                                <div>
                                    <Label htmlFor="cfg-strength">Качество синтеза: {currentVoice.cfg_strength}</Label>
                                    <Slider
                                        id="cfg-strength"
                                        min={0.1}
                                        max={10.0}
                                        step={0.1}
                                        value={[currentVoice.cfg_strength]}
                                        onValueChange={(value) => setCurrentVoice(prev => ({ ...prev, cfg_strength: value[0] }))}
                                        className="mt-2"
                                    />
                                    <p className="text-xs text-muted-foreground mt-1">Влияет на качество и стабильность речи (0.1-10.0) • Рекомендуемое: 2.0</p>
                                </div>
                                
                                <div>
                                    <Label htmlFor="speed-preset">Скорость речи: {
                                        currentVoice.speed_preset === 'very_slow' ? 'Очень медленный' :
                                        currentVoice.speed_preset === 'slow' ? 'Медленный' :
                                        currentVoice.speed_preset === 'normal' ? 'Нормальный' : 'Быстрый'
                                    }</Label>
                                    <Slider
                                        id="speed-preset"
                                        min={0}
                                        max={3}
                                        step={1}
                                        value={[
                                            currentVoice.speed_preset === 'very_slow' ? 0 :
                                            currentVoice.speed_preset === 'slow' ? 1 :
                                            currentVoice.speed_preset === 'normal' ? 2 : 3
                                        ]}
                                        onValueChange={(value) => {
                                            const preset = value[0] === 0 ? 'very_slow' : 
                                                         value[0] === 1 ? 'slow' : 
                                                         value[0] === 2 ? 'normal' : 'fast';
                                            setCurrentVoice(prev => ({ ...prev, speed_preset: preset }));
                                        }}
                                        className="mt-2"
                                    />
                                    <div className="flex justify-between text-xs text-muted-foreground mt-1 px-1">
                                        <span>Очень медл.</span>
                                        <span>Медленный</span>
                                        <span>Нормальный</span>
                                        <span>Быстрый</span>
                                    </div>
                                </div>
                                
                            </div>
                        </div>
                    )}
                    <DialogFooter>
                        <Button onClick={handleTestVoice} variant="outline"><TestTube2 className="h-4 w-4 mr-2"/>Тест</Button>
                        <Button onClick={handleRenameVoice} variant="outline" className="text-orange-600 border-orange-600 hover:bg-orange-600 hover:text-white">
                            <Edit className="h-4 w-4 mr-2"/>Переименовать
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

const VoiceManagementPage = () => {
    return <VoiceManagementPageContent />;
};

export default VoiceManagementPage;