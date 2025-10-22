import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Upload, Trash2, Edit, Users, Globe, Settings, TestTube2, Mic, ChevronDown, ChevronRight, Loader2, RefreshCw, Volume2 } from 'lucide-react';
import { Slider } from "@/components/ui/slider"
import { getAdminVoices, uploadVoice, deleteVoice, updateVoiceSettings, transcribeVoice, testVoice, getUsers, renameVoice } from '../../services/unified-api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../ui/toast';
import { useButtonPosition } from '../../hooks/useButtonPosition';
import { TTS_SERVICE_URL } from '../../constants';

const VoiceManagement = () => {
    const { addToast } = useToast();
    const { getButtonPosition } = useButtonPosition();
    const [voices, setVoices] = useState([]);
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [usersLoading, setUsersLoading] = useState(false);
    const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
    const [testText, setTestText] = useState("Привет, я бы хотел с тобой постримить, если честно, для меня бы это было честью. Постримить с таким великим стримером было бы реально круто.");
    const [editDialogOpen, setEditDialogOpen] = useState(false);
    
    const [currentVoice, setCurrentVoice] = useState(null);
    
    // Состояние для актуальных значений ползунков при тестировании
    const [testCfgStrength, setTestCfgStrength] = useState(2.5);
    const [testSpeedPreset, setTestSpeedPreset] = useState('normal');
    
    // Состояние для сворачивания разделов
    const [expandedSections, setExpandedSections] = useState({
        global: true,
        user: true
    });
    
    // Состояние для загрузки
    const [uploadFile, setUploadFile] = useState(null);
    const [voiceName, setVoiceName] = useState('');
    const [ownerId, setOwnerId] = useState('global'); // 'global' или 'user'
    const [selectedUserId, setSelectedUserId] = useState(''); // ID выбранного пользователя для пользовательского голоса
    const [isUploading, setIsUploading] = useState(false);
    const [isTranscribing, setIsTranscribing] = useState(false);
    const [isTestingVoice, setIsTestingVoice] = useState(false);
    const [isPlaying, setIsPlaying] = useState(false);
    const [hasLoaded, setHasLoaded] = useState(false);
    const loadingRef = useRef(false); // Ref to prevent double loading
    
    const { user } = useAuth();
    let audioContext = null;
    let audioSource = null;

    // Функция для переключения раздела
    const toggleSection = (sectionType) => {
        setExpandedSections(prev => ({
            ...prev,
            [sectionType]: !prev[sectionType]
        }));
    };

    const loadVoices = useCallback(async () => {
        // Предотвращаем множественные одновременные вызовы
        if (loading || loadingRef.current) {
            return;
        }
        
        try {
            setLoading(true);
            const data = await getAdminVoices();
            // Убеждаемся, что data является массивом
            const voicesData = Array.isArray(data) ? data : (data?.data || []);
            setVoices(voicesData);
        } catch (error) {
            addToast({ type: 'error', title: 'Ошибка', message: 'Не удалось загрузить голоса.' });
            console.error('Error loading voices:', error);
            setVoices([]); // Устанавливаем пустой массив в случае ошибки
        } finally {
            setLoading(false);
            loadingRef.current = false;
        }
    }, [addToast, loading]);

    const loadUsers = useCallback(async () => {
        // Предотвращаем множественные одновременные вызовы
        if (usersLoading || loadingRef.current) {
            return;
        }
        
        try {
            setUsersLoading(true);
            const response = await getUsers();
            
            // Проверяем разные форматы ответа
            let usersData = [];
            if (Array.isArray(response)) {
                usersData = response;
            } else if (response && Array.isArray(response.data)) {
                usersData = response.data;
            } else if (response && response.users) {
                usersData = response.users;
            }
            
            setUsers(usersData);
        } catch (error) {
            console.error('Error loading users:', error);
            addToast({ type: 'error', title: 'Ошибка', message: `Не удалось загрузить пользователей: ${error.message || 'Неизвестная ошибка'}` });
            setUsers([]);
        } finally {
            setUsersLoading(false);
            loadingRef.current = false;
        }
    }, [addToast, usersLoading]);

    useEffect(() => {
        if (!hasLoaded && !loadingRef.current) {
            loadingRef.current = true;
            setHasLoaded(true);
            loadVoices();
            loadUsers();
            
            // Сбрасываем флаг после загрузки
            setTimeout(() => {
                loadingRef.current = false;
            }, 1000);
        }
    }, []); // Убираем все зависимости!

    const handleFileUpload = (event) => {
        const file = event.target.files[0];
        if (!file) {
            return;
        }
        
        // Проверяем формат файла (поддерживаем все форматы, которые может конвертировать pydub)
        const supportedFormats = ['.wav', '.mp3', '.flac', '.ogg', '.m4a', '.aac', '.wma', '.aiff', '.au'];
        const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
        
        if (!supportedFormats.includes(fileExtension)) {
            addToast({ 
                type: 'error', 
                title: 'Ошибка', 
                message: `Неподдерживаемый формат файла. Поддерживаемые форматы: ${supportedFormats.join(', ')}` 
            });
            event.target.value = ''; // Сбрасываем input
            return;
        }
        
        setUploadFile(file);
        const nameWithoutExt = file.name.replace(/\.[^/.]+$/, "");
        setVoiceName(nameWithoutExt);
    };

    const handleUpload = async (event) => {
        if (!uploadFile || !voiceName.trim()) {
            addToast({ type: 'error', title: 'Ошибка', message: 'Выберите файл и введите имя голоса.' });
            return;
        }

        // Проверка для пользовательских голосов
        if (ownerId === 'user' && !selectedUserId) {
            addToast({ type: 'error', title: 'Ошибка', message: 'Выберите пользователя для пользовательского голоса.' });
            return;
        }

        setIsUploading(true);
        try {
            const formData = new FormData();
            formData.append('file', uploadFile);
            formData.append('voice_name', voiceName.trim());
            
            // Если выбран пользовательский голос, добавляем owner_id
            if (ownerId === 'user') {
                formData.append('owner_id', selectedUserId);
            }
            // Для глобальных голосов owner_id не передаем

            await uploadVoice(formData);

            const position = getButtonPosition(event);
            const message = ownerId === 'global' 
                ? `Голос "${voiceName.trim()}" успешно загружен в глобальные голоса.`
                : `Голос "${voiceName.trim()}" успешно загружен для пользователя.`;
            addToast({ type: 'success', title: 'Успех', message });
            setUploadDialogOpen(false);
            setUploadFile(null);
            setVoiceName('');
            setOwnerId('global');
            setSelectedUserId('');
            loadVoices();
        } catch (error) {
            addToast({ type: 'error', title: 'Ошибка', message: error.message || 'Не удалось загрузить голос.' });
        } finally {
            setIsUploading(false);
        }
    };

    const handleDelete = async (voiceId, event) => {
        const voiceToDelete = voices.find(v => v.id === voiceId);
        if (!voiceToDelete || !window.confirm(`Вы уверены, что хотите удалить голос "${voiceToDelete.name}"?`)) {
            return;
        }

        try {
            await deleteVoice(voiceId);
            const position = getButtonPosition(event);
            addToast({ type: 'success', title: 'Успех', message: `Голос "${voiceToDelete.name}" удален.` });
            loadVoices();
        } catch (error) {
            addToast({ type: 'error', title: 'Ошибка', message: error.message || 'Не удалось удалить голос.' });
        }
    };
    
    const handleEdit = (voice) => {
        setCurrentVoice({ ...voice });
        // Синхронизируем тестовые значения с выбранным голосом
        setTestCfgStrength(voice.cfg_strength || 2.5);
        setTestSpeedPreset(voice.speed_preset || 'normal');
        setEditDialogOpen(true);
    };

    const handleTranscribe = async () => {
        if (!currentVoice) return;
        
        setIsTranscribing(true);
        try {
            const response = await transcribeVoice(currentVoice.id);
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
        if (!currentVoice) return;
        
        const newName = prompt('Введите новое имя голоса:', currentVoice.name);
        if (!newName || newName.trim() === '' || newName === currentVoice.name) return;
        
        try {
            await renameVoice(currentVoice.id, newName.trim());
            
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
            
            await updateVoiceSettings(currentVoice.id, settings);
            
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

        setIsTestingVoice(true);
        try {
            // Используем текущие значения ползунков для тестирования
            const response = await testVoice(
                currentVoice.name,
                user.id,
                testText,
                testCfgStrength,
                testSpeedPreset
            );
            
            // Получаем URL аудио из ответа
            const audioUrl = response.data?.audio_url || response.audio_url;
            if (audioUrl) {
                // Создаем полный URL
                const fullAudioUrl = audioUrl.startsWith('http') ? audioUrl : `${TTS_SERVICE_URL}${audioUrl}`;
                
                const audio = new Audio(fullAudioUrl);
                
                // Обработчики событий
                audio.onloadstart = () => {
                    // Audio loading started
                };
                
                audio.oncanplay = () => {
                    setIsTestingVoice(false);
                    
                    // Автоматически воспроизводим когда аудио готово
                    audio.play().then(() => {
                        setIsPlaying(true);
                        addToast({ type: 'success', title: 'Успех', message: 'Аудио воспроизводится!' });
                    }).catch((playError) => {
                        console.error('Play error:', playError);
                        setIsPlaying(false);
                        addToast({ type: 'error', title: 'Ошибка', message: 'Не удалось воспроизвести аудио. Проверьте настройки браузера.' });
                    });
                };
                
                audio.oncanplaythrough = () => {
                    setIsTestingVoice(false);
                };
                
                audio.onloadeddata = () => {
                    // Пытаемся воспроизвести когда данные загружены
                    audio.play().then(() => {
                        // Audio playing successfully
                    }).catch((playError) => {
                        console.error('Play error (onloadeddata):', playError);
                    });
                };
                
                audio.onerror = (e) => {
                    console.error('Audio error:', e);
                    setIsTestingVoice(false);
                    addToast({ type: 'error', title: 'Ошибка', message: 'Не удалось загрузить аудио файл.' });
                };
                
                audio.onabort = () => {
                    setIsTestingVoice(false);
                    setIsPlaying(false);
                };
                
                audio.onended = () => {
                    setIsPlaying(false);
                };
                
                audio.onpause = () => {
                    setIsPlaying(false);
                };
                
                // Дополнительная попытка воспроизведения через небольшую задержку
                setTimeout(() => {
                    if (audio.readyState >= 2) { // HAVE_CURRENT_DATA
                        audio.play().then(() => {
                            // Audio playing successfully (delayed)
                        }).catch((playError) => {
                            console.error('Delayed play error:', playError);
                        });
                    }
                }, 100);
            } else {
                console.error('No audio URL in response:', response);
                setIsTestingVoice(false);
                addToast({ type: 'error', title: 'Ошибка', message: 'Не удалось получить аудио для воспроизведения.' });
            }
        } catch (error) {
            console.error('Test voice error:', error);
            setIsTestingVoice(false);
            addToast({ type: 'error', title: 'Ошибка', message: error.message || 'Не удалось протестировать голос.' });
        }
    };

    const handleTranscribeVoice = async () => {
        if (!currentVoice || !currentVoice.reference_text?.trim()) return;
        
        setIsTranscribing(true);
        try {
            const response = await transcribeVoice(currentVoice.id, currentVoice.reference_text);
            
            // Обновляем референсный текст в текущем голосе
            setCurrentVoice(prev => ({...prev, reference_text: response.data.reference_text}));
            
            // Обновляем в списке голосов
            setVoices(prev => prev.map(voice => 
                voice.id === currentVoice.id 
                    ? {...voice, reference_text: response.data.reference_text}
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

    const handleRetranscribeVoice = async () => {
        if (!currentVoice || !currentVoice.reference_text?.trim()) return;
        
        setIsTranscribing(true);
        try {
            const response = await retranscribeVoice(currentVoice.id, currentVoice.reference_text);
            
            // Обновляем референсный текст в текущем голосе
            setCurrentVoice(prev => ({...prev, reference_text: response.data.reference_text}));
            
            // Обновляем в списке голосов
            setVoices(prev => prev.map(voice => 
                voice.id === currentVoice.id 
                    ? {...voice, reference_text: response.data.reference_text}
                    : voice
            ));
            
            addToast({ type: 'success', title: 'Успех', message: 'Перетранскрипция завершена успешно!' });
        } catch (error) {
            console.error('Error retranscribing voice:', error);
            addToast({ type: 'error', title: 'Ошибка', message: 'Не удалось выполнить перетранскрипцию аудио.' });
        } finally {
            setIsTranscribing(false);
        }
    };

            const handleUpdateSettings = async () => {
                if (!currentVoice) return;
                try {
                    await updateVoiceSettings(currentVoice.id, {
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

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                        <Mic className="h-6 w-6 text-gray-400" />
                        Управление голосами
                    </h2>
                    <p className="text-gray-300 mt-1">Загрузка и управление всеми голосовыми сэмплами</p>
                </div>
                <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
                    <DialogTrigger asChild>
                        <Button className="bg-gray-600 hover:bg-gray-700">
                            <Upload className="h-4 w-4 mr-2" />
                            Загрузить голос
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-md">
                        <DialogHeader>
                            <DialogTitle>Загрузка нового голоса</DialogTitle>
                            <DialogDescription>
                                Загрузите аудио файл для создания нового голоса. Поддерживаются все популярные форматы.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                            <div>
                                <Label htmlFor="file">Аудио файл (WAV, MP3, FLAC, OGG, M4A, AAC, WMA, AIFF, AU)</Label>
                                <div className="mt-1">
                                    <Input
                                        id="file"
                                        type="file"
                                        accept=".wav,.mp3,.flac,.ogg,.m4a,.aac,.wma,.aiff,.au"
                                        onChange={handleFileUpload}
                                        className="file:bg-gray-600 file:text-white file:border-0 file:rounded-md file:px-1.5 file:py-0.5 file:mr-1 file:cursor-pointer hover:file:bg-gray-700 file:text-xs cursor-pointer text-xs"
                                    />
                                </div>
                            </div>
                            <div>
                                <Label htmlFor="voiceName">Имя голоса</Label>
                                <Input
                                    id="voiceName"
                                    value={voiceName}
                                    onChange={(e) => setVoiceName(e.target.value)}
                                    placeholder="e.g., speaker1"
                                    className="mt-1"
                                />
                            </div>
                            <div>
                                <Label htmlFor="ownerType">Тип голоса</Label>
                                <Select value={ownerId} onValueChange={(value) => {
                                    setOwnerId(value);
                                    if (value === 'global') {
                                        setSelectedUserId('');
                                    }
                                }}>
                                    <SelectTrigger className="mt-1">
                                        <SelectValue placeholder="Выберите тип голоса" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="global">
                                            <div className="flex items-center gap-2">
                                                <Globe className="w-4 h-4" />
                                                <span>Глобальный голос</span>
                                            </div>
                                        </SelectItem>
                                        <SelectItem value="user">
                                            <div className="flex items-center gap-2">
                                                <Users className="w-4 h-4" />
                                                <span>Пользовательский голос</span>
                                            </div>
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            {ownerId === 'user' && (
                                <div>
                                    <Label htmlFor="selectedUserId">Пользователь</Label>
                                    <Select 
                                        value={selectedUserId} 
                                        onValueChange={setSelectedUserId}
                                        onOpenChange={(open) => {
                                            if (open && users.length === 0) {
                                                loadUsers();
                                            }
                                        }}
                                    >
                                        <SelectTrigger className="mt-1">
                                            <SelectValue placeholder="Выберите пользователя" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {usersLoading ? (
                                                <div className="flex items-center justify-center p-4">
                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                    <span className="ml-2">Загрузка...</span>
                                                </div>
                                            ) : users.length === 0 ? (
                                                <div className="p-4 text-center text-sm text-muted-foreground">
                                                    Пользователи не найдены
                                                </div>
                                            ) : (
                                                users.map(u => (
                                                    <SelectItem key={u.id} value={u.id.toString()}>
                                                        {u.username || `User_${u.id}`}
                                                    </SelectItem>
                                                ))
                                            )}
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}
                        </div>
                         <DialogFooter className="flex justify-center gap-4">
                             <Button 
                                 onClick={() => setUploadDialogOpen(false)} 
                                 variant="outline" 
                                 className="w-28"
                             >
                                 Отмена
                             </Button>
                             <Button
                                 onClick={(e) => handleUpload(e)}
                                 disabled={isUploading || !uploadFile || !voiceName.trim() || (ownerId === 'user' && !selectedUserId)}
                                 className="w-36 bg-green-600 hover:bg-green-700"
                             >
                                 {isUploading ? 'Загрузка...' : 'Загрузить'}
                             </Button>
                         </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>

            <Card className="bg-gray-800/50 border-gray-700">
                 <CardHeader>
                    <CardTitle>Список голосов</CardTitle>
                 </CardHeader>
                 <CardContent>
                    <div className="space-y-4">
                         {loading ? (
                             <p>Загрузка...</p>
                         ) : Array.isArray(voices) && voices.length > 0 ? (
                             <>
                                 {/* Глобальные голоса */}
                                 {voices.filter(voice => voice.voice_type === 'global').length > 0 && (
                                     <div className="mb-6">
                                         <div 
                                             className="flex items-center gap-2 mb-3 cursor-pointer hover:bg-gray-700 p-2 rounded-lg transition-colors"
                                             onClick={() => toggleSection('global')}
                                         >
                                             <Globe className="h-5 w-5 text-gray-400"/>
                                             <h3 className="text-lg font-semibold text-white">Глобальные голоса</h3>
                                             <Badge variant="outline" className="ml-auto">
                                                 {voices.filter(voice => voice.voice_type === 'global').length}
                                             </Badge>
                                             {expandedSections.global ? 
                                                 <ChevronDown className="h-4 w-4 text-gray-400"/> : 
                                                 <ChevronRight className="h-4 w-4 text-gray-400"/>
                                             }
                                             <span className="text-xs text-gray-500 ml-2">
                                                 {expandedSections.global ? 'open' : 'closed'}
                                             </span>
                                         </div>
                                         {expandedSections.global && (
                                             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                                 {voices.filter(voice => voice.voice_type === 'global').map((voice) => (
                                                     <Card key={voice.id} className="bg-gray-800 border-gray-700 h-full">
                                                         <CardHeader className="pb-2">
                                                             <div className="flex items-center justify-between">
                                                                 <CardTitle className="text-sm font-medium text-white flex items-center gap-2 truncate">
                                                                     <Globe className="h-3 w-3 text-gray-400 flex-shrink-0"/>
                                                                     <span className="truncate">{voice.name}</span>
                                                                 </CardTitle>
                                                                 <Badge variant="default" className="text-xs">global</Badge>
                                                             </div>
                                                         </CardHeader>
                                                         <CardContent className="pt-0">
                                                             <div className="flex gap-1">
                                                                 <Button 
                                                                     onClick={() => handleEdit(voice)} 
                                                                     size="sm" 
                                                                     variant="outline"
                                                                     className="flex-1 text-xs px-2"
                                                                 >
                                                                     <Settings className="h-3 w-3 mr-1"/>
                                                                     Настройки
                                                                 </Button>
                                                                 <Button 
                                                                     onClick={(e) => handleDelete(voice.id, voice.name)} 
                                                                     size="sm" 
                                                                     variant="destructive"
                                                                     className="px-2"
                                                                 >
                                                                     <Trash2 className="h-3 w-3"/>
                                                                 </Button>
                                                             </div>
                                                         </CardContent>
                                                     </Card>
                                                 ))}
                                             </div>
                                         )}
                                     </div>
                                 )}

                                 {/* Пользовательские голоса */}
                                 {voices.filter(voice => voice.voice_type === 'user').length > 0 && (
                                     <div className="mb-6">
                                         <div 
                                             className="flex items-center gap-2 mb-3 cursor-pointer hover:bg-gray-700 p-2 rounded-lg transition-colors"
                                             onClick={() => toggleSection('user')}
                                         >
                                             <Users className="h-5 w-5 text-gray-400"/>
                                             <h3 className="text-lg font-semibold text-white">Пользовательские голоса</h3>
                                             <Badge variant="outline" className="ml-auto">
                                                 {voices.filter(voice => voice.voice_type === 'user').length}
                                             </Badge>
                                             {expandedSections.user ? 
                                                 <ChevronDown className="h-4 w-4 text-gray-400"/> : 
                                                 <ChevronRight className="h-4 w-4 text-gray-400"/>
                                             }
                                             <span className="text-xs text-gray-500 ml-2">
                                                 {expandedSections.user ? 'open' : 'closed'}
                                             </span>
                                         </div>
                                         {expandedSections.user && (
                                             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                                 {voices.filter(voice => voice.voice_type === 'user').map((voice) => (
                                                     <Card key={voice.id} className="bg-gray-800 border-gray-700 h-full">
                                                         <CardHeader className="pb-2">
                                                             <div className="flex items-center justify-between">
                                                                 <CardTitle className="text-sm font-medium text-white flex items-center gap-2 truncate">
                                                                     <Users className="h-3 w-3 text-gray-400 flex-shrink-0"/>
                                                                     <span className="truncate">{voice.name}</span>
                                                                 </CardTitle>
                                                                 <Badge variant="secondary" className="text-xs">user</Badge>
                                                             </div>
                                                             <div className="text-xs text-gray-400 truncate">
                                                                 {(() => {
                                                                     const owner = users.find(u => u.id === voice.owner_id);
                                                                     return owner ? (
                                                                         <div className="flex items-center gap-1">
                                                                             <Users className="h-3 w-3 flex-shrink-0" />
                                                                             <span className="truncate">{owner.username || `User_${owner.id}`}</span>
                                                                             {owner.is_online && <Badge variant="outline" className="text-xs ml-1">Онлайн</Badge>}
                                                                         </div>
                                                                     ) : (
                                                                         <span>Owner ID: {voice.owner_id}</span>
                                                                     );
                                                                 })()}
                                                             </div>
                                                         </CardHeader>
                                                         <CardContent className="pt-0">
                                                             <div className="flex gap-1">
                                                                 <Button 
                                                                     onClick={() => handleEdit(voice)} 
                                                                     size="sm" 
                                                                     variant="outline"
                                                                     className="flex-1 text-xs px-2"
                                                                 >
                                                                     <Settings className="h-3 w-3 mr-1"/>
                                                                     Настройки
                                                                 </Button>
                                                                 <Button 
                                                                     onClick={(e) => handleDelete(voice.id, voice.name)} 
                                                                     size="sm" 
                                                                     variant="destructive"
                                                                     className="px-2"
                                                                 >
                                                                     <Trash2 className="h-3 w-3"/>
                                                                 </Button>
                                                             </div>
                                                         </CardContent>
                                                     </Card>
                                                 ))}
                                             </div>
                                         )}
                                     </div>
                                 )}
                             </>
                         ) : (
                             <div className="col-span-full text-center py-8">
                                 <p className="text-gray-400">Голосов не найдено</p>
                             </div>
                         )}
                     </div>
                 </CardContent>
             </Card>

            <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Настройки голоса "{currentVoice?.name}"</DialogTitle>
                        <DialogDescription>
                            Настройте параметры голоса, референсный текст и протестируйте изменения
                        </DialogDescription>
                    </DialogHeader>
                    {currentVoice && (
                        <div className="grid gap-6 py-4">
                            {/* Референсный текст - ПЕРВЫЙ БЛОК */}
                            <div className="space-y-4">
                                <div>
                                    <Label>Референсный текст</Label>
                                    <div className="flex justify-center mt-2 mb-2">
                                        <Button
                                            onClick={handleRetranscribeVoice}
                                            disabled={isTranscribing || !currentVoice?.reference_text?.trim()}
                                            variant="outline"
                                            size="sm"
                                            className="w-32 text-xs px-3"
                                        >
                                            {isTranscribing ? (
                                                <>
                                                    <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                                                    Перетранскрибирую...
                                                </>
                                            ) : (
                                                <>
                                                    <RefreshCw className="h-3 w-3 mr-1" />
                                                    Перетранскрибировать
                                                </>
                                            )}
                                        </Button>
                                    </div>
                                    <Textarea
                                        value={currentVoice?.reference_text || ''}
                                        onChange={(e) => handleReferenceTextChange(e.target.value)}
                                        placeholder="Введите текст для транскрипции..."
                                        className="mt-1"
                                        rows={3}
                                    />
                                    <p className="text-xs text-muted-foreground mt-1">
                                        Текст, который будет использоваться для транскрипции аудио
                                    </p>
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
                                    <Label htmlFor="cfg-strength">Стабильность синтеза: {testCfgStrength}</Label>
                                    <Slider
                                        id="cfg-strength"
                                        min={0.1}
                                        max={10.0}
                                        step={0.1}
                                        value={[testCfgStrength]}
                                        onValueChange={(value) => {
                                            setTestCfgStrength(value[0]);
                                            setCurrentVoice(prev => ({ ...prev, cfg_strength: value[0] }));
                                        }}
                                        className="mt-2"
                                    />
                                    <div className="text-xs text-gray-400 bg-gray-800 p-2 rounded mt-1">
                                        💡 <strong>Стабильность:</strong> Влияет на стабильность и консистентность речи. 
                                        Рекомендуемое значение 2.5. Слишком высокое значение может сделать речь роботизированной.
                                    </div>
                                </div>
                                
                                <div>
                                    <Label htmlFor="speed-preset">Скорость речи: {
                                        testSpeedPreset === 'very_slow' ? 'Очень медленный' :
                                        testSpeedPreset === 'slow' ? 'Медленный' :
                                        testSpeedPreset === 'normal' ? 'Нормальный' :
                                        testSpeedPreset === 'fast' ? 'Быстрый' : 'Очень быстрый'
                                    }</Label>
                                    <Slider
                                        id="speed-preset"
                                        min={0}
                                        max={4}
                                        step={1}
                                        value={[
                                            testSpeedPreset === 'very_slow' ? 0 :
                                            testSpeedPreset === 'slow' ? 1 :
                                            testSpeedPreset === 'normal' ? 2 :
                                            testSpeedPreset === 'fast' ? 3 : 4
                                        ]}
                                        onValueChange={(value) => {
                                            const preset = value[0] === 0 ? 'very_slow' : 
                                                         value[0] === 1 ? 'slow' : 
                                                         value[0] === 2 ? 'normal' :
                                                         value[0] === 3 ? 'fast' : 'very_fast';
                                            setTestSpeedPreset(preset);
                                            setCurrentVoice(prev => ({ ...prev, speed_preset: preset }));
                                        }}
                                        className="mt-2"
                                    />
                                    <div className="flex justify-between text-xs text-muted-foreground mt-1 px-1">
                                        <span>Очень медл.</span>
                                        <span>Медленный</span>
                                        <span>Нормальный</span>
                                        <span>Быстрый</span>
                                        <span>Очень быстрый</span>
                                    </div>
                                    <div className="text-xs text-gray-400 bg-gray-800 p-2 rounded mt-1">
                                        💡 <strong>Скорость:</strong> Подберите подходящий пресет. Сильно быстрый может обрывать конец фразы. 
                                        Слишком медленный может тормозить речь. Начните с "Нормальный" и корректируйте по результату.
                                    </div>
                                </div>
                                
                            </div>
                        </div>
                    )}
                    <DialogFooter className="flex justify-center gap-4">
                        <Button 
                            onClick={handleTestVoice} 
                            variant="outline" 
                            disabled={isTestingVoice}
                            className="w-32"
                        >
                            {isTestingVoice ? (
                                <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin"/>
                                    Тест...
                                </>
                            ) : isPlaying ? (
                                <>
                                    <Volume2 className="h-4 w-4 mr-2"/>
                                    Воспроизводится
                                </>
                            ) : (
                                <>
                                    <TestTube2 className="h-4 w-4 mr-2"/>
                                    Тест
                                </>
                            )}
                        </Button>
                        <Button 
                            onClick={handleRenameVoice} 
                            variant="outline" 
                            className="w-32 text-orange-600 border-orange-600 hover:bg-orange-600 hover:text-white"
                        >
                            <Edit className="h-4 w-4 mr-2"/>Переименовать
                        </Button>
                        <Button 
                            onClick={handleSaveSettings} 
                            className="w-32 bg-green-600 hover:bg-green-700"
                        >
                            <Settings className="h-4 w-4 mr-2"/>Сохранить
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default VoiceManagement;

