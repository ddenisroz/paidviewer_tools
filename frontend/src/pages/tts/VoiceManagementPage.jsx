import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Upload, Trash2, Settings, TestTube2, Globe, User, Edit, Lock, AlertCircle } from 'lucide-react';
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
    retranscribeUserVoice,
    testVoice,
    renameUserVoice,
    getGlobalVoices,
    botService
} from '../../services/unified-api';
import { Badge } from '@/components/ui/badge';
import { PageLoader } from '@/components/ui/loader';
import { useLoadingState } from '../../hooks/useLoadingState';
import { TTS_SERVICE_URL } from '@/services/microservices';
import PageWrapper from '../../components/PageWrapper';


const VoiceManagementPageContent = () => {
    const { addToast } = useToast();
    const { getButtonPosition } = useButtonPosition();
    const [voices, setVoices] = useState([]);
    const [loading, setLoading] = useState(true);
    const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
    const [editDialogOpen, setEditDialogOpen] = useState(false);
    const [renameDialogOpen, setRenameDialogOpen] = useState(false);
    const [currentVoice, setCurrentVoice] = useState(null);
    const [newVoiceName, setNewVoiceName] = useState('');
    const [uploadFile, setUploadFile] = useState(null);
    const [voiceName, setVoiceName] = useState('');
    const [testText, setTestText] = useState("Привет, я бы хотел с тобой постримить, если честно, для меня бы это было честью. Постримить с таким великим стримером было бы реально круто.");
    const [isUploading, setIsUploading] = useState(false);
    const [isTranscribing, setIsTranscribing] = useState(false);
    const [isTestingVoice, setIsTestingVoice] = useState(false);
    const [voiceVolumes, setVoiceVolumes] = useState({}); // {voice_name: volume_level}
    const [whitelistStatus, setWhitelistStatus] = useState(null); // Статус whitelist пользователя
    const fileInputRef = React.useRef(null);
    const voiceVolumeSaveTimeout = React.useRef({});
    
    const { user } = useAuth();
    const { initializeTts, engineStatus } = useTts();
    const { isHealthy, isChecking, lastCheck, checkTtsHealth } = useTtsHealth();
    let audioContext = null;
    let audioSource = null;
    
    // Используем хук для управления состоянием загрузки
    const showLoader = useLoadingState(isChecking);

    // Загрузка индивидуальной громкости для голоса с сервера
    const loadVoiceVolume = async (voiceName) => {
        try {
            const response = await botService.get(`/api/voices/${voiceName}/settings`);
            if (response.data && response.data.volume !== undefined) {
                setVoiceVolumes(prev => ({
                    ...prev,
                    [voiceName]: response.data.volume
                }));
                return response.data.volume;
            }
        } catch (error) {
            console.error('Error loading voice volume:', error);
        }
        return 50.0; // Значение по умолчанию
    };

    // Сохранение индивидуальной громкости для голоса на сервер
    const saveVoiceVolume = async (voiceName, volumeLevel) => {
        try {
            await botService.put(`/api/voices/${voiceName}/settings`, {
                volume: volumeLevel
            });
            
            setVoiceVolumes(prev => ({
                ...prev,
                [voiceName]: volumeLevel
            }));
        } catch (error) {
            console.error('Error saving voice volume:', error);
        }
    };

    // Инициализируем TTS только при загрузке этой страницы
    useEffect(() => {
        initializeTts();
    }, [initializeTts]);

    // Проверяем whitelist статус пользователя (включая гостей)
    const checkWhitelistStatus = useCallback(async () => {
        if (!user) {
            setWhitelistStatus({
                is_whitelisted: false,
                can_manage_voices: false,
                message: "Пользователь не авторизован"
            });
            return;
        }
        
        try {
            // API проверяет whitelist для всех: OAuth пользователей и гостей
            const response = await botService.get('/api/voices/whitelist-status');
            setWhitelistStatus(response.data);
        } catch (error) {
            console.error('Error checking whitelist status:', error);
            setWhitelistStatus({
                is_whitelisted: false,
                can_manage_voices: false,
                message: "Ошибка проверки статуса доступа"
            });
        }
    }, [user]);

    const loadVoices = useCallback(async () => {
        if (!user) return;
        
        // Проверяем whitelist статус перед загрузкой голосов
        // Для гостей и OAuth пользователей без whitelist - не загружаем голоса
        if (whitelistStatus && !whitelistStatus.can_manage_voices) {
            console.log(`${user.isGuest ? 'Guest' : 'User'} not in whitelist - F5-TTS not available`);
            setVoices([]);
            setLoading(false);
            return;
        }
        
        try {
            setLoading(true);
            let response;
            if (user.isGuest) {
                // Для гостей загружаем только глобальные голоса (если они в whitelist)
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
                        loadVoiceVolume(voice.name);
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
    }, [user, addToast, whitelistStatus]);

    useEffect(() => {
        // Загружаем голоса и проверяем whitelist независимо от TTS сервиса
        // TTS нужен только для тестирования/создания голосов, не для просмотра
        loadVoices();
        checkWhitelistStatus();
        
        // Обработчик для сворачивания/разворачивания вкладки
        const handleVisibilityChange = () => {
            if (document.hidden) {
                // При сворачивании вкладки закрываем все диалоги
                setEditDialogOpen(false);
                setUploadDialogOpen(false);
                setRenameDialogOpen(false);
            }
        };
        
        document.addEventListener('visibilitychange', handleVisibilityChange);
        
        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [user, loadVoices, checkWhitelistStatus]);

    const handleFileUpload = (event) => {
        event.stopPropagation();
        
        const file = event.target.files?.[0];
        
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
        if (!uploadFile || !voiceName.trim() || !user) {
            addToast({ type: 'error', title: 'Ошибка', message: 'Выберите файл и введите имя голоса.' });
            return;
        }
        
        setIsUploading(true);
        try {
            const formData = new FormData();
            formData.append('file', uploadFile);
            formData.append('voice_name', voiceName.trim());
            formData.append('user_id', user.id); // Загружаем в личную папку пользователя
            
            await uploadUserVoice(user.id, formData);
            
            const position = getButtonPosition(event);
            addToast({ type: 'success', title: 'Успех', message: `Голос "${voiceName.trim()}" успешно загружен в вашу папку.` });
            setUploadDialogOpen(false);
            setUploadFile(null);
            setVoiceName('');
            loadVoices();
        } catch (error) {
            console.error('Error uploading voice:', error);
            addToast({ type: 'error', title: 'Ошибка', message: error.message || 'Не удалось загрузить голос.' });
        } finally {
            setIsUploading(false);
        }
    };

    const handleDelete = async (voiceId) => {
        // Проверяем whitelist статус
        if (!whitelistStatus?.can_manage_voices) {
            addToast({ 
                type: 'error', 
                title: 'Ошибка', 
                message: 'У вас нет доступа к удалению голосов. Обратитесь к администратору.' 
            });
            return;
        }
        
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
        if (!currentVoice || !user) return;
        
        setIsTranscribing(true);
        try {
            // Запускаем транскрипцию аудиофайла голоса
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
            
            addToast({ type: 'success', title: 'Успех', message: 'Транскрипция аудиофайла завершена успешно!' });
        } catch (error) {
            console.error('Error transcribing voice:', error);
            addToast({ type: 'error', title: 'Ошибка', message: 'Не удалось выполнить транскрипцию аудиофайла.' });
        } finally {
            setIsTranscribing(false);
        }
    };

    const handleReferenceTextChange = (value) => {
        setCurrentVoice(prev => ({...prev, reference_text: value}));
    };

    const handleRenameVoice = () => {
        if (!currentVoice) return;
        setNewVoiceName(currentVoice.name);
        setRenameDialogOpen(true);
    };

    const handleConfirmRename = async () => {
        if (!currentVoice || !user || !newVoiceName.trim()) return;
        
        if (newVoiceName.trim() === currentVoice.name) {
            setRenameDialogOpen(false);
            return;
        }
        
        try {
            await renameUserVoice(currentVoice.id, user.id, newVoiceName.trim());
            
            // Обновляем в списке голосов
            setVoices(prev => prev.map(voice => 
                voice.id === currentVoice.id 
                    ? {...voice, name: newVoiceName.trim()}
                    : voice
            ));
            
            // Обновляем currentVoice
            setCurrentVoice(prev => ({...prev, name: newVoiceName.trim()}));
            
            setRenameDialogOpen(false);
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
        
        setIsTestingVoice(true);
        try {
            console.log('Testing voice with parameters:', {
                name: currentVoice.name,
                cfg_strength: currentVoice.cfg_strength,
                speed_preset: currentVoice.speed_preset,
                volume: voiceVolumes[currentVoice.name] || 50
            });
            
            // Используем текущие значения ползунков и тестовый текст для тестирования (БЕЗ сохранения в БД)
            const response = await testVoice(
                currentVoice.name,
                user.id,
                testText,                     // Используем текст из тестового окна
                currentVoice.cfg_strength,    // Передаем текущее значение ползунка
                currentVoice.speed_preset     // Передаем текущий пресет скорости
            );
            
            // Получаем URL аудио из ответа
            const audioUrl = response.data.audio_url;
            if (audioUrl) {
                try {
                    // Проверяем, является ли URL уже полным
                    let fullAudioUrl = audioUrl;
                    if (!audioUrl.startsWith('http')) {
                        fullAudioUrl = `${TTS_SERVICE_URL}${audioUrl}`;
                    }
                    
                    console.log('Playing test audio:', fullAudioUrl);
                    const audio = new Audio(fullAudioUrl);
                    
                    // Применяем индивидуальную громкость для этого голоса
                    const volumeLevel = voiceVolumes[currentVoice.name] || 50;
                    audio.volume = volumeLevel / 100; // Конвертируем 0-100 в 0-1
                    
                    // Добавляем обработчики событий
                    audio.oncanplaythrough = () => {
                        console.log('Test audio ready to play with volume:', audio.volume);
                        audio.play().catch(e => {
                            console.error("Test audio play failed:", e);
                            addToast({ type: 'error', title: 'Ошибка', message: 'Не удалось воспроизвести аудио.' });
                        });
                    };
                    
                    audio.onended = () => {
                        console.log('Test audio playback ended');
                    };
                    
                    audio.onerror = (e) => {
                        console.error("Error loading test audio:", fullAudioUrl, e);
                        addToast({ type: 'error', title: 'Ошибка', message: 'Не удалось загрузить аудио файл.' });
                    };
                    
                    // Загружаем аудио
                    audio.load();
                } catch (error) {
                    console.error("Error creating audio:", error);
                    addToast({ type: 'error', title: 'Ошибка', message: 'Не удалось создать аудио объект.' });
                }
            } else {
                addToast({ type: 'error', title: 'Ошибка', message: 'Не удалось получить аудио для воспроизведения.' });
            }
        } catch (error) {
            addToast({ type: 'error', title: 'Ошибка', message: error.message || 'Не удалось протестировать голос.' });
        } finally {
            setIsTestingVoice(false);
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


    // Показываем скелетон с фиксированной высотой пока проверяется health или загружаются голоса
    if (showLoader) {
        return (
            <PageWrapper 
                title="Управление голосами"
            >
                <div className="flex justify-center items-center min-h-[400px]">
                    <PageLoader />
                </div>
            </PageWrapper>
        );
    }

    // Показываем заглушку если TTS недоступен (только после завершения проверки)
    if (!isHealthy && !isChecking && lastCheck) {
        return (
            <PageWrapper 
                title="Управление голосами"
            >
                <TtsErrorCard
                    title="TTS сервер недоступен"
                    description="В данный момент сервис TTS недоступен. Управление голосами временно отключено."
                    suggestion="Попробуйте обновить страницу через несколько минут."
                />
            </PageWrapper>
        );
    }

    return (
        <PageWrapper 
            title="Управление голосами"
            description={
                user?.isGuest 
                    ? "Гостевой режим: используйте только глобальные голоса. Для загрузки собственных голосов войдите в систему."
                    : whitelistStatus && !whitelistStatus.can_manage_voices
                        ? whitelistStatus.message
                        : ""
            }
        >
            {/* Скрытый input для загрузки файлов - вынесен наружу чтобы не терялся при перерисовке диалога */}
            <input 
                    ref={(el) => {
                        fileInputRef.current = el;
                        if (el) {
                            // Добавляем слушатель напрямую к элементу
                            el.onchange = (e) => {
                                handleFileUpload(e);
                            };
                        }
                    }}
                    type="file" 
                    accept=".wav,.mp3,.flac,.ogg,.m4a,.aac,.wma,.aiff,.au"
                    style={{ display: 'none', pointerEvents: 'auto' }}
                />
                
                <Dialog open={uploadDialogOpen} onOpenChange={(open) => {
                    setUploadDialogOpen(open);
                    if (!open) {
                        // Сбрасываем состояние только при закрытии диалога
                        setUploadFile(null);
                        setVoiceName('');
                        if (fileInputRef.current) {
                            fileInputRef.current.value = '';
                        }
                    }
                }}>
                    {!user?.isGuest && whitelistStatus?.can_manage_voices && (
                        <DialogTrigger asChild>
                            <Button className="bg-purple-600 hover:bg-purple-700 w-full md:w-auto">
                                <Upload className="h-4 w-4 mr-2" />
                                Загрузить свой голос
                            </Button>
                        </DialogTrigger>
                    )}
                    <DialogContent 
                        key="upload-dialog"
                        className="max-w-md" 
                        onOpenAutoFocus={(e) => e.preventDefault()}
                        onCloseAutoFocus={(e) => e.preventDefault()}
                    >
                        <DialogHeader>
                            <DialogTitle>Загрузка нового голоса</DialogTitle>
                            <DialogDescription>
                                Загрузите аудио файл для создания вашего голоса
                            </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                             <div>
                                 <Label>Аудио файл (WAV, MP3, FLAC, OGG, M4A, AAC, WMA, AIFF, AU)</Label>
                                 <div className="mt-1">
                                     <Button
                                         type="button"
                                         variant="outline"
                                         onClick={(e) => {
                                             e.preventDefault();
                                             e.stopPropagation();
                                             if (fileInputRef.current) {
                                                 fileInputRef.current.click();
                                             }
                                         }}
                                         className="w-full"
                                     >
                                         <Upload className="h-4 w-4 mr-2" />
                                         {uploadFile ? uploadFile.name : 'Выбрать файл'}
                                     </Button>
                                 </div>
                                 {uploadFile && (
                                     <p className="text-xs text-green-400 mt-1">
                                         ✓ Файл выбран: {uploadFile.name}
                                     </p>
                                 )}
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
                                 <Label>Информация</Label>
                                 <div className="mt-1 p-3 bg-slate-800 rounded-md">
                                     <p className="text-sm text-slate-300">
                                         Голос будет доступен только вам и загружен в вашу личную папку голосов.
                                     </p>
                                 </div>
                             </div>
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
                                 disabled={isUploading || !uploadFile || !voiceName.trim()}
                                 className="w-36 bg-green-600 hover:bg-green-700"
                             >
                                 {isUploading ? 'Загрузка...' : 'Загрузить'}
                             </Button>
                        </DialogFooter>
                   </DialogContent>
               </Dialog>

            {/* Уведомление для пользователей без whitelist */}
            {!user?.isGuest && whitelistStatus && !whitelistStatus.can_manage_voices && (
                <div className="mb-6 bg-orange-900/20 border border-orange-500/50 rounded-lg p-4 flex items-start gap-3">
                    <Lock className="h-5 w-5 text-orange-400 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                        <h3 className="text-orange-300 font-semibold mb-1">Доступ к F5-TTS ограничен</h3>
                        <p className="text-orange-200/80 text-sm">
                            Вы не находитесь в белом списке (whitelist) и не можете использовать F5-TTS для AI озвучки. 
                            Для получения доступа обратитесь к администратору системы.
                        </p>
                        <p className="text-orange-200/60 text-xs mt-2">
                            💡 Вам доступна только базовая озвучка (gTTS) через основные настройки TTS.
                        </p>
                    </div>
                </div>
            )}
            
            {/* Уведомление для гостевого режима */}
            {user?.isGuest && whitelistStatus && !whitelistStatus.can_manage_voices && (
                <div className="mb-6 bg-blue-900/20 border border-blue-500/50 rounded-lg p-4 flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-blue-400 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                        <h3 className="text-blue-300 font-semibold mb-1">Гостевой режим - Канал не в whitelist</h3>
                        <p className="text-blue-200/80 text-sm">
                            Канал, к которому вы подключились, не находится в whitelist. F5-TTS (AI озвучка) недоступен.
                        </p>
                        <p className="text-blue-200/60 text-xs mt-2">
                            💡 Вам доступна только базовая озвучка (gTTS) через основные настройки TTS.
                        </p>
                        <p className="text-blue-200/60 text-xs mt-1">
                            💡 Для получения доступа к F5-TTS обратитесь к администратору для добавления канала в whitelist.
                        </p>
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                 {loading ? (
                     <p className="text-slate-400 col-span-full">Загрузка голосов...</p>
                 ) : voices.length === 0 ? (
                     <div className="col-span-full text-center py-12">
                         <div className="text-slate-400 text-lg mb-4">
                             {whitelistStatus && !whitelistStatus.can_manage_voices ? (
                                 <>
                                     <Lock className="h-12 w-12 mx-auto mb-4 text-orange-500" />
                                     <p>F5-TTS недоступен без whitelist</p>
                                     <p className="text-sm text-slate-500 mt-2">
                                         {user?.isGuest 
                                             ? 'Канал не в whitelist. Используйте базовую озвучку (gTTS)'
                                             : 'Используйте базовую озвучку (gTTS)'}
                                     </p>
                                 </>
                             ) : (
                                 <>
                                     <User className="h-12 w-12 mx-auto mb-4 text-slate-500" />
                                     <p>{user?.isGuest ? 'Голоса доступны для использования' : 'Загрузите свой первый голос'}</p>
                                 </>
                             )}
                         </div>
                     </div>
                 ) : voices.map((voice) => (
                     <Card key={voice.id} className="bg-slate-800 border-slate-700 flex flex-col min-h-[200px]">
                         <CardHeader>
                             <div className="flex items-center justify-between">
                                 <CardTitle className="text-base font-medium text-white flex items-center gap-2">
                                     {voice.voice_type === 'global' ? <Globe className="h-4 w-4 text-blue-400"/> : <User className="h-4 w-4 text-green-400"/>}
                                     {voice.name}
                                 </CardTitle>
                             </div>
                         </CardHeader>
                         <CardContent className="flex-grow flex flex-col justify-between">
                            <div className="flex space-x-2">
                                <Button className="flex-1" variant="outline" size="sm" onClick={() => handleEdit(voice)}><Settings className="h-4 w-4 mr-1"/>Настроить</Button>
                                {voice.voice_type === 'user' && whitelistStatus?.can_manage_voices && (
                                   <Button variant="destructive" size="icon" onClick={() => handleDelete(voice.id)}><Trash2 className="h-4 w-4"/></Button>
                                )}
                            </div>
                         </CardContent>
                     </Card>
                 ))}
             </div>

             {/* Диалог редактирования голоса */}
            <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
                <DialogContent 
                    key={`edit-dialog-${currentVoice?.id || 'new'}`}
                    className="max-w-lg" 
                    onOpenAutoFocus={(e) => e.preventDefault()}
                    onCloseAutoFocus={(e) => e.preventDefault()}
                >
                    <DialogHeader>
                        <DialogTitle>Настройки голоса "{currentVoice?.name}"</DialogTitle>
                        <DialogDescription>
                            Настройте параметры синтеза и протестируйте голос
                        </DialogDescription>
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
                                <div className="flex gap-2 mt-2 justify-end">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={handleTranscribe}
                                        disabled={isTranscribing}
                                        className="text-xs px-3"
                                    >
                                        {isTranscribing ? 'Транскрибирую...' : 'Перетранскрибировать'}
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
                                        onValueChange={(value) => {
                                            const newVolume = value[0];
                                            // Clear previous timeout if any
                                            if (voiceVolumeSaveTimeout.current[currentVoice.name]) {
                                                clearTimeout(voiceVolumeSaveTimeout.current[currentVoice.name]);
                                            }
                                            // Set a new timeout to save the volume after a delay
                                            voiceVolumeSaveTimeout.current[currentVoice.name] = setTimeout(() => {
                                                saveVoiceVolume(currentVoice.name, newVolume);
                                            }, 500); // 500ms debounce
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
                                />
                            </div>
                            
                            {/* Настройки генерации TTS */}
                            <div className="space-y-4">
                                <h4 className="text-sm font-medium text-white">Настройки генерации</h4>
                                
                                {/* Единственный настраиваемый параметр */}
                                <div>
                                    <Label htmlFor="cfg-strength">Стабильность синтеза: {currentVoice.cfg_strength}</Label>
                                    <Slider
                                        id="cfg-strength"
                                        min={0.1}
                                        max={10.0}
                                        step={0.1}
                                        value={[currentVoice.cfg_strength]}
                                        onValueChange={(value) => setCurrentVoice(prev => ({ ...prev, cfg_strength: value[0] }))}
                                        className="mt-2"
                                    />
                                    <div className="text-xs text-gray-400 bg-gray-800 p-2 rounded mt-1">
                                        💡 <strong>Стабильность:</strong> Влияет на стабильность и консистентность речи. 
                                        Рекомендуемое значение 2.5. Слишком высокое значение может сделать речь роботизированной.
                                    </div>
                                </div>
                                
                                <div>
                                    <Label htmlFor="speed-preset">Скорость речи: {
                                        currentVoice.speed_preset === 'very_slow' ? 'Очень медленный' :
                                        currentVoice.speed_preset === 'slow' ? 'Медленный' :
                                        currentVoice.speed_preset === 'normal' ? 'Нормальный' :
                                        currentVoice.speed_preset === 'fast' ? 'Быстрый' : 'Очень быстрый'
                                    }</Label>
                                    <Slider
                                        id="speed-preset"
                                        min={0}
                                        max={4}
                                        step={1}
                                        value={[
                                            currentVoice.speed_preset === 'very_slow' ? 0 :
                                            currentVoice.speed_preset === 'slow' ? 1 :
                                            currentVoice.speed_preset === 'normal' ? 2 :
                                            currentVoice.speed_preset === 'fast' ? 3 : 4
                                        ]}
                                        onValueChange={(value) => {
                                            const preset = value[0] === 0 ? 'very_slow' : 
                                                         value[0] === 1 ? 'slow' : 
                                                         value[0] === 2 ? 'normal' :
                                                         value[0] === 3 ? 'fast' : 'very_fast';
                                            console.log('Speed preset changed to:', preset);
                                            setCurrentVoice(prev => ({ ...prev, speed_preset: preset }));
                                        }}
                                        className="mt-2"
                                    />
                                    <div className="flex justify-between text-xs text-muted-foreground mt-1 px-1">
                                        <span className="text-center w-1/5">Очень медл.</span>
                                        <span className="text-center w-1/5">Медленный</span>
                                        <span className="text-center w-1/5">Нормальный</span>
                                        <span className="text-center w-1/5">Быстрый</span>
                                        <span className="text-center w-1/5">Очень быстрый</span>
                                    </div>
                                    <div className="text-xs text-gray-400 bg-gray-800 p-2 rounded mt-1">
                                        💡 <strong>Скорость:</strong> Подберите подходящий пресет. Сильно быстрый может обрывать конец фразы. 
                                        Слишком медленный может тормозить речь. Начните с "Нормальный" и корректируйте по результату.
                                    </div>
                                </div>
                                
                            </div>
                        </div>
                    )}
                    <DialogFooter className="flex-wrap gap-2">
                        <Button onClick={handleTestVoice} variant="outline" disabled={isTestingVoice} className="flex-1 min-w-[100px]">
                            <TestTube2 className="h-4 w-4 mr-2"/>{isTestingVoice ? 'Генерирую...' : 'Тест'}
                        </Button>
                        <Button onClick={handleRenameVoice} variant="outline" className="flex-1 min-w-[140px] text-orange-600 border-orange-600 hover:bg-orange-600 hover:text-white">
                            <Edit className="h-4 w-4 mr-2"/>Переименовать
                        </Button>
                        <Button onClick={handleSaveSettings} className="flex-1 min-w-[120px] bg-blue-600 hover:bg-blue-700">
                            <Settings className="h-4 w-4 mr-2"/>Сохранить
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Диалог переименования голоса */}
            <Dialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
                <DialogContent 
                    key="rename-dialog"
                    className="max-w-md" 
                    onOpenAutoFocus={(e) => e.preventDefault()}
                    onCloseAutoFocus={(e) => e.preventDefault()}
                >
                    <DialogHeader>
                        <DialogTitle>Переименовать голос</DialogTitle>
                        <DialogDescription>
                            Введите новое имя для голоса "{currentVoice?.name}"
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div>
                            <Label htmlFor="new-voice-name">Новое имя</Label>
                            <Input
                                id="new-voice-name"
                                value={newVoiceName}
                                onChange={(e) => setNewVoiceName(e.target.value)}
                                placeholder="Введите новое имя голоса..."
                                className="mt-1"
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        handleConfirmRename();
                                    }
                                }}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button 
                            variant="outline" 
                            onClick={() => setRenameDialogOpen(false)}
                        >
                            Отмена
                        </Button>
                        <Button 
                            onClick={handleConfirmRename}
                            disabled={!newVoiceName.trim() || newVoiceName.trim() === currentVoice?.name}
                        >
                            Переименовать
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </PageWrapper>
    );
};

const VoiceManagementPage = () => {
    return <VoiceManagementPageContent />;
};

export default VoiceManagementPage;