import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import ReactDOM from 'react-dom';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Upload, Trash2, Edit, Users, Globe, Settings, TestTube2, Mic, ChevronDown, ChevronRight, Loader2, RefreshCw, Volume2, X, User, AlertCircle } from 'lucide-react';
import { Slider } from "@/components/ui/slider"
import { getAdminVoices, uploadVoice, deleteVoice, updateVoiceSettings, transcribeVoice, retranscribeVoice, testVoice, getUsers, renameVoice } from '../../services/unified-api';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../ui/toast';
import { useButtonPosition } from '../../hooks/useButtonPosition';
import { TTS_SERVICE_URL } from '../../constants';
import { logger } from '../../utils/prodLogger';

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
    
    // Состояние для фильтрации
    const [selectedUserFilter, setSelectedUserFilter] = useState('all'); // 'all' или ID пользователя
    
    // Состояние для загрузки
    const [uploadFile, setUploadFile] = useState(null);
    const [voiceName, setVoiceName] = useState('');
    const [ownerId, setOwnerId] = useState('global'); // 'global' или 'user'
    const [selectedUserId, setSelectedUserId] = useState(''); // ID выбранного пользователя для пользовательского голоса
    const [isUploading, setIsUploading] = useState(false);
    const [isTranscribing, setIsTranscribing] = useState(false);
    const [isTestingVoice, setIsTestingVoice] = useState(false);
    const [isPlaying, setIsPlaying] = useState(false);
    const [ttsServiceWarning, setTtsServiceWarning] = useState(null);
    const isUserClosingRef = useRef(false); // Ref to track if user explicitly closed dialog
    const dialogCloseTimeoutRef = useRef(null); // Ref for close timeout
    const queryClient = useQueryClient();
    
    const { user } = useAuth();
    let audioContext = null;
    let audioSource = null;

    // React Query: загружаем голоса для админа
    const { data: voicesData = [], isLoading: voicesLoading } = useQuery({
        queryKey: ['admin-voices'],
        queryFn: async () => {
            const response = await getAdminVoices();
            const data = response?.data || response;
            
            // Проверяем предупреждение о недоступности TTS сервиса
            if (data?.warning) {
                setTtsServiceWarning(data.warning);
                logger.warn('⚠️ [ADMIN] TTS Service warning:', data.warning);
            } else {
                setTtsServiceWarning(null);
            }
            
            // Извлекаем массив голосов - проверяем несколько вариантов структуры ответа
            let voicesArray = [];
            if (Array.isArray(data)) {
                voicesArray = data;
            } else if (data?.status === 'success' && Array.isArray(data.voices)) {
                voicesArray = data.voices;
            } else if (Array.isArray(data?.voices)) {
                voicesArray = data.voices;
            } else if (Array.isArray(data?.data)) {
                voicesArray = data.data;
            } else if (data?.success && Array.isArray(data.voices)) {
                voicesArray = data.voices;
            } else {
                logger.warn('⚠️ [ADMIN] Could not extract voices array from response:', data);
                voicesArray = [];
            }
            
            logger.log('✅ [ADMIN] Loaded voices:', voicesArray.length, 'voices');
            return voicesArray;
        },
        staleTime: 5 * 60 * 1000,
        refetchOnMount: true,
        refetchOnWindowFocus: false,
        onError: (error) => {
            logger.error('❌ [ADMIN] Error loading voices:', error);
            setVoices([]);
            
            // Показываем предупреждение если ошибка связана с подключением
            if (error.message?.includes('connection') || error.message?.includes('timeout') || error.code === 'ECONNREFUSED') {
                setTtsServiceWarning(`Ошибка подключения к TTS сервису: ${error.message || 'Сервис недоступен'}`);
            } else if (error.response?.status === 500 && error.response?.data?.detail?.includes('connection')) {
                setTtsServiceWarning(error.response.data.detail);
            }
        },
        onSuccess: (data) => {
            setVoices(data);
        },
    });

    // React Query: загружаем пользователей
    const { data: usersData = [], isLoading: usersLoading } = useQuery({
        queryKey: ['admin-voice-users'],
        queryFn: async () => {
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
            
            return usersData;
        },
        staleTime: 5 * 60 * 1000,
        refetchOnMount: true,
        refetchOnWindowFocus: false,
        onError: (error) => {
            logger.error('Error loading users:', error);
            addToast({ type: 'error', title: 'Ошибка', message: `Не удалось загрузить пользователей: ${error.message || 'Неизвестная ошибка'}` });
            setUsers([]);
        },
        onSuccess: (data) => {
            setUsers(data);
        },
    });

    // Комбинированное состояние загрузки
    useEffect(() => {
        setLoading(voicesLoading);
    }, [voicesLoading]);

    // Обработчик клавиши Escape для закрытия модального окна редактирования
    useEffect(() => {
        if (!editDialogOpen) return;
        
        const handleEscape = (e) => {
            if (e.key === 'Escape') {
                setEditDialogOpen(false);
            }
        };
        
        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, [editDialogOpen]);
    
    // Блокируем скролл body при открытом попапе редактирования
    useEffect(() => {
        if (editDialogOpen) {
            document.body.style.overflow = 'hidden';
            return () => {
                document.body.style.overflow = '';
            };
        }
    }, [editDialogOpen]);

    // Обработчик клавиши Escape для закрытия модального окна загрузки
    useEffect(() => {
        if (!uploadDialogOpen) return;
        
        const handleEscape = (e) => {
            if (e.key === 'Escape') {
                setUploadDialogOpen(false);
            }
        };
        
        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, [uploadDialogOpen]);
    
    // Блокируем скролл body при открытом попапе загрузки
    useEffect(() => {
        if (uploadDialogOpen) {
            document.body.style.overflow = 'hidden';
            return () => {
                document.body.style.overflow = '';
            };
        }
    }, [uploadDialogOpen]);

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
            
            if (ownerId === 'user') {
                // Для пользовательских голосов используем endpoint user voices
                formData.append('user_id', selectedUserId);
                const { uploadUserVoice } = await import('../../services/unified-api');
                await uploadUserVoice(selectedUserId, formData);
            } else {
                // Для глобальных голосов используем admin endpoint
                await uploadVoice(formData);
            }

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
            queryClient.invalidateQueries({ queryKey: ['admin-voices'] });
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
            queryClient.invalidateQueries({ queryKey: ['admin-voices'] });
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
            logger.error('Error transcribing voice:', error);
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
            logger.error('Error renaming voice:', error);
            addToast({ type: 'error', title: 'Ошибка', message: 'Не удалось переименовать голос.' });
        }
    };

    const handleSaveSettings = async () => {
        if (!currentVoice) return;
        
        try {
            // ✅ Используем актуальные значения из testCfgStrength и testSpeedPreset (которые синхронизированы с currentVoice)
            const settings = {
                cfg_strength: testCfgStrength, // ✅ Используем актуальное значение из слайдера
                speed_preset: testSpeedPreset, // ✅ Используем актуальное значение из слайдера
                reference_text: currentVoice.reference_text
            };
            
            await updateVoiceSettings(currentVoice.id, settings);
            
            // Обновляем в списке голосов
            setVoices(prev => prev.map(voice => 
                voice.id === currentVoice.id 
                    ? {...voice, ...settings}
                    : voice
            ));
            
            // Обновляем currentVoice с новыми значениями
            setCurrentVoice(prev => ({...prev, ...settings}));
            
            // Помечаем как явное закрытие пользователем
            isUserClosingRef.current = true;
            setEditDialogOpen(false);
            addToast({ type: 'success', title: 'Успех', message: 'Настройки голоса сохранены!' });
        } catch (error) {
            logger.error('Error updating voice settings:', error);
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
            logger.error('Error decoding audio data', error);
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
                        logger.error('Play error:', playError);
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
                        logger.error('Play error (onloadeddata):', playError);
                    });
                };
                
                audio.onerror = (e) => {
                    logger.error('Audio error:', e);
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
                            logger.error('Delayed play error:', playError);
                        });
                    }
                }, 100);
            } else {
                logger.error('No audio URL in response:', response);
                setIsTestingVoice(false);
                addToast({ type: 'error', title: 'Ошибка', message: 'Не удалось получить аудио для воспроизведения.' });
            }
        } catch (error) {
            logger.error('Test voice error:', error);
            setIsTestingVoice(false);
            addToast({ type: 'error', title: 'Ошибка', message: error.message || 'Не удалось протестировать голос.' });
        }
    };

    const handleTranscribeVoice = async () => {
        if (!currentVoice || !currentVoice.reference_text?.trim()) return;
        
        setIsTranscribing(true);
        try {
            // transcribeVoice извлекает reference_text из аудиофайла автоматически
            const response = await transcribeVoice(currentVoice.id);
            
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
            logger.error('Error transcribing voice:', error);
            addToast({ type: 'error', title: 'Ошибка', message: 'Не удалось выполнить транскрипцию аудио.' });
        } finally {
            setIsTranscribing(false);
        }
    };

    const handleRetranscribeVoice = async () => {
        if (!currentVoice || !currentVoice.reference_text?.trim()) return;
        
        setIsTranscribing(true);
        try {
            // retranscribeVoice извлекает reference_text из аудиофайла автоматически
            const response = await retranscribeVoice(currentVoice.id);
            
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
            logger.error('Error retranscribing voice:', error);
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
                    // Помечаем как явное закрытие пользователем
                    isUserClosingRef.current = true;
                    setEditDialogOpen(false);
                    queryClient.invalidateQueries({ queryKey: ['admin-voices'] });
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
                <Button 
                    className="bg-gray-600 hover:bg-gray-700"
                    onClick={() => setUploadDialogOpen(true)}
                >
                    <Upload className="h-4 w-4 mr-2" />
                    Загрузить голос
                </Button>
            </div>

            <Card className="bg-gray-800/50 border-gray-700">
                 <CardHeader className="space-y-4">
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-xl font-bold">Список голосов</CardTitle>
                        <Badge variant="outline" className="text-sm">
                            Всего: {voices.length}
                        </Badge>
                    </div>
                 </CardHeader>
                 <CardContent>
                    {/* Предупреждение о недоступности TTS сервиса */}
                    {ttsServiceWarning && (
                        <div className="mb-6 p-4 bg-yellow-900/20 border border-yellow-600/50 rounded-lg">
                            <div className="flex items-start gap-3">
                                <AlertCircle className="h-5 w-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                                <div className="flex-1">
                                    <p className="text-yellow-300 font-semibold mb-1">⚠️ TTS Сервис недоступен</p>
                                    <p className="text-yellow-400/80 text-sm">{ttsServiceWarning}</p>
                                    <p className="text-yellow-400/60 text-xs mt-2">
                                        Убедитесь, что TTS сервис запущен и доступен по адресу указанному в переменной окружения TTS_SERVICE_URL.
                                    </p>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={loadVoices}
                                    className="text-yellow-300 hover:text-yellow-200"
                                >
                                    <RefreshCw className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    )}
                    <div className="space-y-8">
                         {loading ? (
                             <div className="flex items-center justify-center py-12">
                                 <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
                                 <span className="ml-3 text-gray-400">Загрузка голосов...</span>
                             </div>
                         ) : (
                             <>
                                 {/* Секция пользовательских голосов */}
                                 <div>
                                     <div className="flex items-center justify-between mb-4">
                                         <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                                             <Users className="h-5 w-5 text-green-400" />
                                             Пользовательские голоса
                                             <Badge variant="outline" className="ml-2 text-green-400 border-green-400">
                                                 {voices.filter(v => v.voice_type === 'user').length}
                                             </Badge>
                                         </h3>
                                         {/* Фильтр по пользователю */}
                                         {users.length > 0 && (
                                             <Select value={selectedUserFilter} onValueChange={setSelectedUserFilter}>
                                                 <SelectTrigger className="w-[200px]">
                                                     <SelectValue placeholder="Все пользователи" />
                                                 </SelectTrigger>
                                                 <SelectContent>
                                                     <SelectItem value="all">Все пользователи</SelectItem>
                                                     {users.map(u => (
                                                         <SelectItem key={u.id} value={u.id.toString()}>
                                                             {u.username || `User_${u.id}`}
                                                         </SelectItem>
                                                     ))}
                                                 </SelectContent>
                                             </Select>
                                         )}
                                     </div>
                                     {(() => {
                                         const userVoices = voices.filter(v => 
                                             v.voice_type === 'user' && 
                                             (selectedUserFilter === 'all' || v.owner_id === parseInt(selectedUserFilter))
                                         );
                                         return userVoices.length === 0 ? (
                                             <div className="text-center py-12 bg-gray-800/30 rounded-lg border border-gray-700 border-dashed">
                                                 <Users className="h-16 w-16 text-gray-600 mx-auto mb-4" />
                                                 <p className="text-gray-400 text-lg mb-2">
                                                     {selectedUserFilter !== 'all' ? 'У выбранного пользователя нет голосов' : 'Пользовательских голосов пока нет'}
                                                 </p>
                                             </div>
                                         ) : (
                                             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                                 {userVoices.map((voice) => (
                                                     <Card key={voice.id} className="bg-slate-800 border-slate-700 flex flex-col h-full transition-all hover:border-slate-600 hover:shadow-lg">
                                                         <CardHeader className="pb-3">
                                                             <div className="flex items-center justify-between">
                                                                 <CardTitle className="text-sm font-medium text-white flex items-center gap-2">
                                                                     <Users className="h-4 w-4 text-green-400 flex-shrink-0"/>
                                                                     <span className="truncate">{voice.name}</span>
                                                                 </CardTitle>
                                                             </div>
                                                             <div className="text-xs text-gray-400 truncate mt-2">
                                                                 {(() => {
                                                                     const owner = users.find(u => u.id === voice.owner_id);
                                                                     return owner ? (
                                                                         <span className="truncate flex items-center gap-1">
                                                                             <User className="h-3 w-3" />
                                                                             {owner.username || `User_${owner.id}`}
                                                                         </span>
                                                                     ) : (
                                                                         <span>Owner ID: {voice.owner_id}</span>
                                                                     );
                                                                 })()}
                                                             </div>
                                                         </CardHeader>
                                                         <CardContent className="flex-grow flex flex-col justify-end pt-0">
                                                             <div className="flex gap-2">
                                                                 <Button 
                                                                     onClick={() => handleEdit(voice)} 
                                                                     className="flex-1" 
                                                                     variant="outline"
                                                                     size="sm"
                                                                 >
                                                                     <Settings className="h-4 w-4 mr-1"/>
                                                                     Настроить
                                                                 </Button>
                                                                 <Button 
                                                                     onClick={(e) => handleDelete(voice.id, e)} 
                                                                     variant="destructive"
                                                                     size="sm"
                                                                 >
                                                                     <Trash2 className="h-4 w-4"/>
                                                                 </Button>
                                                             </div>
                                                         </CardContent>
                                                     </Card>
                                                 ))}
                                             </div>
                                         );
                                     })()}
                                 </div>

                                 {/* Разделитель */}
                                 <div className="border-t border-gray-700"></div>

                                 {/* Секция глобальных голосов */}
                                 <div>
                                     <div className="flex items-center justify-between mb-4">
                                         <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                                             <Globe className="h-5 w-5 text-blue-400" />
                                             Глобальные голоса
                                             <Badge variant="outline" className="ml-2 text-blue-400 border-blue-400">
                                                 {voices.filter(v => v.voice_type === 'global').length}
                                             </Badge>
                                         </h3>
                                     </div>
                                     {(() => {
                                         const globalVoices = voices.filter(v => v.voice_type === 'global');
                                         return globalVoices.length === 0 ? (
                                             <div className="text-center py-12 bg-gray-800/30 rounded-lg border border-gray-700 border-dashed">
                                                 <Globe className="h-16 w-16 text-gray-600 mx-auto mb-4" />
                                                 <p className="text-gray-400 text-lg mb-2">Глобальных голосов пока нет</p>
                                                <p className="text-gray-500 text-sm mb-4">Загрузите первый голос через кнопку "Загрузить голос" вверху страницы</p>
                                             </div>
                                         ) : (
                                             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                                 {globalVoices.map((voice) => (
                                                     <Card key={voice.id} className="bg-slate-800 border-slate-700 flex flex-col h-full transition-all hover:border-slate-600 hover:shadow-lg">
                                                         <CardHeader className="pb-3">
                                                             <div className="flex items-center justify-between">
                                                                 <CardTitle className="text-sm font-medium text-white flex items-center gap-2">
                                                                     <Globe className="h-4 w-4 text-blue-400 flex-shrink-0"/>
                                                                     <span className="truncate">{voice.name}</span>
                                                                 </CardTitle>
                                                             </div>
                                                         </CardHeader>
                                                         <CardContent className="flex-grow flex flex-col justify-end pt-0">
                                                             <div className="flex gap-2">
                                                                 <Button 
                                                                     onClick={() => handleEdit(voice)} 
                                                                     className="flex-1" 
                                                                     variant="outline"
                                                                     size="sm"
                                                                 >
                                                                     <Settings className="h-4 w-4 mr-1"/>
                                                                     Настроить
                                                                 </Button>
                                                             </div>
                                                         </CardContent>
                                                     </Card>
                                                 ))}
                                             </div>
                                         );
                                     })()}
                                 </div>
                             </>
                         )}
                     </div>
                 </CardContent>
             </Card>

            {/* Диалог загрузки голоса - используем Portal как в ChatBoxSettingsModal */}
            {uploadDialogOpen && ReactDOM.createPortal(
                <>
                    {/* Backdrop - затемнение заднего фона */}
                    <div 
                        className="fixed inset-0 bg-black/80 z-[9999]"
                        onClick={() => setUploadDialogOpen(false)}
                    />
                    
                    {/* Modal Content */}
                    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 pointer-events-none">
                        <div 
                            className="bg-gray-900 rounded-lg max-w-md w-full max-h-[90vh] overflow-hidden flex flex-col pointer-events-auto shadow-2xl"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {/* Header */}
                            <div className="border-b border-gray-700 p-4 flex items-center justify-between">
                                <div>
                                    <h2 className="text-xl font-bold text-white">Загрузка нового голоса</h2>
                                    <p className="text-sm text-gray-400 mt-1">Загрузите аудио файл для создания нового голоса. Поддерживаются все популярные форматы.</p>
                                </div>
                                <button 
                                    onClick={() => setUploadDialogOpen(false)} 
                                    className="text-gray-400 hover:text-white transition-colors"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                            
                            {/* Content */}
                            <div className="flex-1 overflow-y-auto p-6">
                                <div className="space-y-4">
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
                                                        queryClient.invalidateQueries({ queryKey: ['admin-voice-users'] });
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
                            </div>
                            
                            {/* Footer */}
                            <div className="border-t border-gray-700 p-4 flex justify-center gap-4">
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
                            </div>
                        </div>
                    </div>
                </>,
                document.body
            )}

            {/* Редактирование голоса - используем Portal как в ChatBoxSettingsModal */}
            {editDialogOpen && currentVoice && ReactDOM.createPortal(
                <>
                    {/* Backdrop - затемнение заднего фона */}
                    <div 
                        className="fixed inset-0 bg-black/80 z-[9999]"
                        onClick={() => setEditDialogOpen(false)}
                    />
                    
                    {/* Modal Content */}
                    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 pointer-events-none">
                        <div 
                            className="bg-gray-900 rounded-lg max-w-lg w-full max-h-[90vh] overflow-hidden flex flex-col pointer-events-auto shadow-2xl"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {/* Header */}
                            <div className="border-b border-gray-700 p-4 flex items-center justify-between">
                                <h2 className="text-xl font-bold text-white">Настройки голоса "{currentVoice?.name}"</h2>
                                <button 
                                    onClick={() => setEditDialogOpen(false)} 
                                    className="text-gray-400 hover:text-white transition-colors"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                            
                            {/* Content */}
                            <div className="flex-1 overflow-y-auto p-6">
                                <div className="grid gap-6 py-4">
                                    {/* Референсный текст - ПЕРВЫЙ БЛОК */}
                                    <div className="space-y-4">
                                        <div className="w-full">
                                            <Label>Референсный текст</Label>
                                            <Textarea
                                                value={currentVoice?.reference_text || ''}
                                                onChange={(e) => handleReferenceTextChange(e.target.value)}
                                                placeholder="Введите текст для транскрипции..."
                                                className="mt-1 w-full"
                                                rows={3}
                                            />
                                            <div className="w-full mt-2">
                                                <Button
                                                    onClick={handleRetranscribeVoice}
                                                    disabled={isTranscribing || !currentVoice?.reference_text?.trim()}
                                                    variant="outline"
                                                    size="sm"
                                                    className="w-full justify-center items-center whitespace-nowrap"
                                                >
                                                    {isTranscribing ? (
                                                        <>
                                                            <Loader2 className="h-4 w-4 mr-2 animate-spin flex-shrink-0" />
                                                            <span>Перетранскрибирую...</span>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <RefreshCw className="h-4 w-4 mr-2 flex-shrink-0" />
                                                            <span>Перетранскрибировать</span>
                                                        </>
                                                    )}
                                                </Button>
                                            </div>
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
                            </div>
                            
                            {/* Footer */}
                            <div className="border-t border-gray-700 p-4 flex justify-center gap-4">
                                <Button 
                                    onClick={handleTestVoice} 
                                    variant="outline" 
                                    disabled={isTestingVoice}
                                    className="w-32 whitespace-nowrap overflow-hidden text-ellipsis"
                                >
                                    {isTestingVoice ? (
                                        <>
                                            <Loader2 className="h-4 w-4 mr-2 animate-spin flex-shrink-0"/>
                                            <span className="truncate">Тест...</span>
                                        </>
                                    ) : isPlaying ? (
                                        <>
                                            <Volume2 className="h-4 w-4 mr-2 flex-shrink-0"/>
                                            <span className="truncate">Воспроизводится</span>
                                        </>
                                    ) : (
                                        <>
                                            <TestTube2 className="h-4 w-4 mr-2 flex-shrink-0"/>
                                            <span className="truncate">Тест</span>
                                        </>
                                    )}
                                </Button>
                                <Button 
                                    onClick={handleRenameVoice} 
                                    variant="outline" 
                                    className="w-32 whitespace-nowrap overflow-hidden text-ellipsis text-orange-600 border-orange-600 hover:bg-orange-600 hover:text-white"
                                >
                                    <Edit className="h-4 w-4 mr-2 flex-shrink-0"/>
                                    <span className="truncate">Переименовать</span>
                                </Button>
                                <Button 
                                    onClick={handleSaveSettings} 
                                    className="w-32 whitespace-nowrap overflow-hidden text-ellipsis bg-green-600 hover:bg-green-700"
                                >
                                    <Settings className="h-4 w-4 mr-2 flex-shrink-0"/>
                                    <span className="truncate">Сохранить</span>
                                </Button>
                            </div>
                        </div>
                    </div>
                </>,
                document.body
            )}
        </div>
    );
};

export default VoiceManagement;

