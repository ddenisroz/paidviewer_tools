import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Upload, Trash2, Settings, TestTube2, Globe, User, Edit, Lock, AlertCircle } from 'lucide-react';
import { Slider } from "@/components/ui/slider";
import { Checkbox } from '@/components/ui/checkbox';
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
import { logger } from '../../utils/prodLogger';


const VoiceManagementPageContent = () => {
    const { addToast } = useToast();
    const { getButtonPosition } = useButtonPosition();
    // УДАЛЕНО: useState для голосов - теперь используется напрямую из React Query
    // const [globalVoices, setGlobalVoices] = useState([]); - УДАЛЕНО
    // const [userVoices, setUserVoices] = useState([]); - УДАЛЕНО
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
    const fileInputRef = React.useRef(null);
    const voiceVolumeSaveTimeout = React.useRef({});
    
    const { user } = useAuth();
    const { initializeTts, engineStatus } = useTts();
    const { isHealthy, isChecking, lastCheck, checkTtsHealth } = useTtsHealth();
    const queryClient = useQueryClient();
    let audioContext = null;
    let audioSource = null;
    
    // Используем хук для управления состоянием загрузки
    const showLoader = useLoadingState(isChecking);

    // NOTE: Voice volume management moved to admin panel via UserVoiceSettings
    // These functions are no longer needed but kept as stubs for backward compatibility
    const loadVoiceVolume = async (voiceName) => {
        return 50.0; // Default volume
    };

    const saveVoiceVolume = async (voiceName, volumeLevel) => {
        // No-op: volume is managed via UserVoiceSettings in admin panel
    };

    // Инициализируем TTS только при загрузке этой страницы
    useEffect(() => {
        initializeTts();
    }, [initializeTts]);

    // React Query: проверяем whitelist статус пользователя
    const { data: whitelistStatusData } = useQuery({
        queryKey: ['voices-whitelist-status'],
        queryFn: async () => {
            if (!user) {
                return {
                    is_whitelisted: false,
                    can_manage_voices: false,
                    message: "Пользователь не авторизован"
                };
            }
            const response = await botService.get('/api/voices/whitelist-status');
            return response.data;
        },
        enabled: !!user,
        staleTime: 30 * 1000, // 30 секунд
        refetchOnMount: true,
        refetchOnWindowFocus: false,
    });

    // React Query: загружаем глобальные голоса
    const { data: globalVoicesData = [], isLoading: globalVoicesLoading } = useQuery({
        queryKey: ['global-voices'],
        queryFn: async () => {
            const response = await getGlobalVoices();
            const data = response?.data || response || [];
            return Array.isArray(data) ? data : [];
        },
        enabled: !!whitelistStatusData?.can_manage_voices,
        staleTime: 5 * 60 * 1000,
        refetchOnMount: true,
        onError: (error) => {
            logger.error('Error loading global voices:', error);
        },
    });

    // React Query: загружаем пользовательские голоса
    const userId = user?.isGuest ? -1 : user?.id;
    const { data: userVoicesData = [], isLoading: userVoicesLoading } = useQuery({
        queryKey: ['user-voices', userId],
        queryFn: async () => {
            if (!userId) return [];
            const response = await getUserVoices(userId);
            const data = response?.data || response || [];
            return Array.isArray(data) ? data : [];
        },
        enabled: !!userId, // Загружаем пользовательские голоса всегда, если есть userId
        staleTime: 5 * 60 * 1000,
        refetchOnMount: true,
        onError: (error) => {
            logger.error('Error loading user voices:', error);
        },
    });

    // React Query Mutations
    const uploadVoiceMutation = useMutation({
        mutationFn: async ({ userId, formData }) => {
            setIsUploading(true);
            return await uploadUserVoice(userId, formData);
        },
        onSuccess: () => {
            addToast({ type: 'success', title: 'Успех', message: 'Голос успешно загружен!' });
            setUploadDialogOpen(false);
            setUploadFile(null);
            setVoiceName('');
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
            queryClient.invalidateQueries({ queryKey: ['user-voices', userId] });
        },
        onError: (error) => {
            addToast({ type: 'error', title: 'Ошибка', message: error.message || 'Не удалось загрузить голос.' });
        },
        onSettled: () => {
            setIsUploading(false);
        }
    });

    const deleteVoiceMutation = useMutation({
        mutationFn: async ({ voiceId, userId, voiceName }) => {
            return await deleteUserVoice(voiceId, userId);
        },
        onSuccess: (data, variables) => {
            addToast({ type: 'success', title: 'Успех', message: `Голос "${variables.voiceName}" удалён.` });
            queryClient.invalidateQueries({ queryKey: ['user-voices', userId] });
        },
        onError: (error) => {
            addToast({ type: 'error', title: 'Ошибка', message: error.message || 'Не удалось удалить голос.' });
        }
    });

    const renameVoiceMutation = useMutation({
        mutationFn: async ({ voiceId, userId, newName }) => {
            return await renameUserVoice(voiceId, userId, newName);
        },
        onSuccess: () => {
            addToast({ type: 'success', title: 'Успех', message: 'Голос успешно переименован!' });
            setRenameDialogOpen(false);
            setEditDialogOpen(false);
            queryClient.invalidateQueries({ queryKey: ['user-voices', userId] });
        },
        onError: (error) => {
            addToast({ type: 'error', title: 'Ошибка', message: error.message || 'Не удалось переименовать голос.' });
        }
    });

    const updateVoiceSettingsMutation = useMutation({
        mutationFn: async ({ voiceId, userId, settings }) => {
            return await updateUserVoiceSettings(voiceId, userId, settings);
        },
        onSuccess: () => {
            setEditDialogOpen(false);
            queryClient.invalidateQueries({ queryKey: ['user-voices', userId] });
            queryClient.invalidateQueries({ queryKey: ['global-voices'] });
        },
        onError: (error) => {
            addToast({ type: 'error', title: 'Ошибка', message: error.message || 'Не удалось обновить настройки.' });
            queryClient.invalidateQueries({ queryKey: ['user-voices', userId] });
            queryClient.invalidateQueries({ queryKey: ['global-voices'] });
        }
    });

    const transcribeVoiceMutation = useMutation({
        mutationFn: async ({ voiceId, userId }) => {
            setIsTranscribing(true);
            return await retranscribeUserVoice(voiceId, userId);
        },
        onSuccess: (response) => {
            const newReferenceText = response?.data?.reference_text || response?.reference_text;
            if (newReferenceText) {
                setCurrentVoice(prev => ({...prev, reference_text: newReferenceText}));
                addToast({ type: 'success', title: 'Успех', message: 'Референсный текст обновлён!' });
            }
            queryClient.invalidateQueries({ queryKey: ['user-voices', userId] });
        },
        onError: (error) => {
            addToast({ type: 'error', title: 'Ошибка', message: error.message || 'Не удалось перетранскрибировать голос.' });
        },
        onSettled: () => {
            setIsTranscribing(false);
        }
    });

    // React Query: загружаем включенные голоса пользователя
    const { data: enabledVoicesData, isLoading: enabledVoicesLoading } = useQuery({
        queryKey: ['enabled-voices', userId],
        queryFn: async () => {
            if (!userId) return [];
            try {
                const response = await botService.get(`/api/user/voices/enabled/${userId}`);
                return response.data.enabled_voice_ids || [];
            } catch (error) {
                logger.error('Error loading enabled voices:', error);
                return [];
            }
        },
        enabled: !!userId && !!whitelistStatusData?.can_manage_voices,
        staleTime: 5 * 60 * 1000,
        refetchOnMount: true,
    });

    // Mutation для обновления включенных голосов
    const updateEnabledVoicesMutation = useMutation({
        mutationFn: async ({ userId, voiceIds }) => {
            return await botService.post(`/api/user/voices/enabled/${userId}`, voiceIds);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['enabled-voices', userId] });
        },
        onError: (error) => {
            logger.error('Error updating enabled voices:', error);
            addToast({ type: 'error', title: 'Ошибка', message: 'Не удалось обновить включенные голоса' });
        }
    });

    // Используем данные из React Query напрямую
    // Важно: используем ?? для fallback, если данные еще не загружены
    const globalVoices = globalVoicesData ?? [];
    const userVoices = userVoicesData ?? [];
    const enabledVoiceIds = enabledVoicesData ?? [];
    
    // Используем whitelistStatusData напрямую из React Query
    const whitelistStatus = whitelistStatusData;
    
    // Логируем статус whitelist для диагностики
    useEffect(() => {
        if (whitelistStatus) {
            logger.info('Voice management whitelist status:', {
                isWhitelisted: whitelistStatus.is_whitelisted,
                canManageVoices: whitelistStatus.can_manage_voices,
                platform: whitelistStatus.platform,
                message: whitelistStatus.message,
                user: user?.id,
                isGuest: user?.isGuest
            });
        }
    }, [whitelistStatus, user]);

    // Комбинированное состояние загрузки
    useEffect(() => {
        if (!whitelistStatusData?.can_manage_voices) {
            setLoading(false);
            return;
        }
        setLoading(globalVoicesLoading || userVoicesLoading);
    }, [globalVoicesLoading, userVoicesLoading, whitelistStatusData]);

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
        if (!uploadFile || !voiceName.trim()) {
            addToast({ type: 'error', title: 'Ошибка', message: 'Выберите файл и введите имя голоса.' });
            return;
        }
        
        // Проверяем, что пользователь авторизован (не гость)
        if (user?.isGuest) {
            addToast({ type: 'error', title: 'Ошибка', message: 'Гости не могут загружать свои голоса. Авторизуйтесь через Twitch или VK.' });
            return;
        }
        
        const uploadUserId = user?.id;
        if (!uploadUserId) {
            addToast({ type: 'error', title: 'Ошибка', message: 'Не удалось определить пользователя.' });
            return;
        }
        
        const formData = new FormData();
        formData.append('file', uploadFile);
        formData.append('voice_name', voiceName.trim());
        formData.append('user_id', uploadUserId);
        
        uploadVoiceMutation.mutate({ userId: uploadUserId, formData });
    };

    const handleDelete = async (voiceId, voiceType) => {
        // Проверяем whitelist статус
        if (!whitelistStatus?.can_manage_voices) {
            addToast({ 
                type: 'error', 
                title: 'Ошибка', 
                message: 'У вас нет доступа к удалению голосов. Обратитесь к администратору.' 
            });
            return;
        }
        
        // Нельзя удалять глобальные голоса
        if (voiceType === 'global') {
            addToast({ type: 'error', title: 'Ошибка', message: 'Вы не можете удалять глобальные голоса.' });
            return;
        }
        
        const voiceToDelete = userVoices.find(v => v.id === voiceId);
        if (!voiceToDelete || !user || !window.confirm(`Вы уверены, что хотите удалить свой голос "${voiceToDelete.name}"?`)) {
            return;
        }

        deleteVoiceMutation.mutate({ 
            voiceId, 
            userId: user.id,
            voiceName: voiceToDelete.name 
        });
    };

    const handleEdit = (voice) => {
        setCurrentVoice({ ...voice });
        setEditDialogOpen(true);
    };

    const handleTranscribe = async () => {
        if (!currentVoice || !user) return;
        
        // Глобальные голоса нельзя перетранскрибировать
        if (currentVoice.voice_type === 'global') {
            addToast({ type: 'error', title: 'Ошибка', message: 'Вы не можете изменять глобальные голоса.' });
            return;
        }
        
        transcribeVoiceMutation.mutate({ 
            voiceId: currentVoice.id, 
            userId: user.id 
        });
    };

    const handleReferenceTextChange = (value) => {
        setCurrentVoice(prev => ({...prev, reference_text: value}));
    };

    const handleRenameVoice = () => {
        if (!currentVoice) return;
        
        // Глобальные голоса нельзя переименовывать
        if (currentVoice.voice_type === 'global') {
            addToast({ type: 'error', title: 'Ошибка', message: 'Вы не можете переименовывать глобальные голоса.' });
            return;
        }
        
        setNewVoiceName(currentVoice.name);
        setRenameDialogOpen(true);
    };

    const handleConfirmRename = async () => {
        if (!currentVoice || !user || !newVoiceName.trim()) return;
        
        if (newVoiceName.trim() === currentVoice.name) {
            setRenameDialogOpen(false);
            return;
        }
        
        renameVoiceMutation.mutate({
            voiceId: currentVoice.id,
            userId: user.id,
            newName: newVoiceName.trim()
        });
    };

    const handleSaveSettings = async () => {
        if (!currentVoice || !user) return;
        
        const settings = {
            cfg_strength: currentVoice.cfg_strength,
            speed_preset: currentVoice.speed_preset,
            reference_text: currentVoice.reference_text
        };
        
        // Optimistic update через React Query
        if (currentVoice.voice_type === 'global') {
            queryClient.setQueryData(['global-voices'], (prev = []) => prev.map(voice => 
                voice.id === currentVoice.id 
                    ? {...voice, ...settings}
                    : voice
            ));
        } else {
            queryClient.setQueryData(['user-voices', userId], (prev = []) => prev.map(voice => 
                voice.id === currentVoice.id 
                    ? {...voice, ...settings}
                    : voice
            ));
        }
        
        updateVoiceSettingsMutation.mutate(
            { voiceId: currentVoice.id, userId: user.id, settings },
            {
                onSuccess: () => {
                    addToast({ 
                        type: 'success', 
                        title: 'Успех', 
                        message: currentVoice.voice_type === 'global' 
                            ? 'Настройки применены к вашему профилю' 
                            : 'Настройки голоса сохранены!' 
                    });
                },
                onError: () => {
                    // Rollback при ошибке - React Query сам обновит через invalidateQueries
                }
            }
        );
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
            logger.log('Testing voice with parameters:', {
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
                    
                    logger.log('Playing test audio:', fullAudioUrl);
                    const audio = new Audio(fullAudioUrl);
                    
                    // Применяем индивидуальную громкость для этого голоса
                    const volumeLevel = voiceVolumes[currentVoice.name] || 50;
                    audio.volume = volumeLevel / 100; // Конвертируем 0-100 в 0-1
                    
                    // Добавляем обработчики событий
                    audio.oncanplaythrough = () => {
                        logger.log('Test audio ready to play with volume:', audio.volume);
                        audio.play().catch(e => {
                            logger.error("Test audio play failed:", e);
                            addToast({ type: 'error', title: 'Ошибка', message: 'Не удалось воспроизвести аудио.' });
                        });
                    };
                    
                    audio.onended = () => {
                        logger.log('Test audio playback ended');
                    };
                    
                    audio.onerror = (e) => {
                        logger.error("Error loading test audio:", fullAudioUrl, e);
                        addToast({ type: 'error', title: 'Ошибка', message: 'Не удалось загрузить аудио файл.' });
                    };
                    
                    // Загружаем аудио
                    audio.load();
                } catch (error) {
                    logger.error("Error creating audio:", error);
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
                    // Данные обновятся автоматически через React Query
                    queryClient.invalidateQueries({ queryKey: ['user-voices', userId] });
                    queryClient.invalidateQueries({ queryKey: ['global-voices'] });
                } catch (error) {
                    addToast({ type: 'error', title: 'Ошибка', message: error.message || 'Не удалось обновить настройки.' });
                }
            };

    const handleSliderChange = (value, field) => {
        if (currentVoice) {
            setCurrentVoice(prev => ({ ...prev, [field]: value[0] }));
        }
    };

    // Функция для переключения включения/выключения голоса
    const handleToggleVoiceEnabled = async (voiceId) => {
        if (!userId) return;
        
        const isCurrentlyEnabled = enabledVoiceIds.includes(voiceId);
        const newEnabledIds = isCurrentlyEnabled
            ? enabledVoiceIds.filter(id => id !== voiceId)
            : [...enabledVoiceIds, voiceId];
        
        // Проверяем что хотя бы один голос останется включенным
        if (newEnabledIds.length === 0) {
            addToast({ type: 'error', title: 'Ошибка', message: 'Необходимо оставить хотя бы один голос включенным' });
            return;
        }
        
        updateEnabledVoicesMutation.mutate({ userId, voiceIds: newEnabledIds });
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
                    ? "Гостевой режим: используйте только глобальные голоса. Для загрузки собственных голосов авторизуйтесь через Twitch или VK."
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

            {/* Уведомление для пользователей без whitelist */}
            {!user?.isGuest && !loading && whitelistStatus && whitelistStatus.can_manage_voices === false && (
                <div className="mb-6 bg-orange-900/20 border border-orange-500/50 rounded-lg p-4 flex items-start gap-3">
                    <Lock className="h-5 w-5 text-orange-400 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                        <h3 className="text-orange-300 font-semibold mb-1">Вы не состоите в whitelist</h3>
                        <p className="text-orange-200/80 text-sm">
                            Для доступа к управлению голосами необходимо быть в белом списке (whitelist). 
                            Обратитесь к администратору для получения доступа.
                        </p>
                        <p className="text-orange-200/60 text-xs mt-2">
                            💡 Вам доступна только базовая озвучка (gTTS) через основные настройки TTS.
                        </p>
                    </div>
                </div>
            )}
            
            {/* Уведомление для гостевого режима */}
            {user?.isGuest && !loading && whitelistStatus && whitelistStatus.can_manage_voices === false && (
                <div className="mb-6 bg-blue-900/20 border border-blue-500/50 rounded-lg p-4 flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-blue-400 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                        <h3 className="text-blue-300 font-semibold mb-1">Канал не в whitelist</h3>
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

            {loading ? (
                <div className="col-span-full text-center py-12">
                    <p className="text-slate-400">Загрузка голосов...</p>
                </div>
            ) : whitelistStatus && whitelistStatus.can_manage_voices === false ? (
                // Показываем плашку, если нет whitelist
                <div className="col-span-full">
                    <div className="text-center py-12 bg-slate-800/50 rounded-lg border border-slate-700">
                        <Lock className="h-16 w-16 mx-auto mb-4 text-orange-500" />
                        <p className="text-slate-300 text-lg mb-2 font-semibold">Вы не состоите в whitelist</p>
                        <p className="text-slate-400 text-sm mb-4">
                            Для доступа к управлению голосами необходимо быть в белом списке (whitelist)
                        </p>
                        <p className="text-slate-500 text-xs">
                            Обратитесь к администратору для получения доступа
                        </p>
                    </div>
                </div>
            ) : !user?.isGuest && whitelistStatus?.can_manage_voices && globalVoices.length === 0 && userVoices.length === 0 ? (
                // Показываем кнопку загрузки даже если нет голосов, но есть whitelist
                <div className="col-span-full">
                    <div className="text-center py-12">
                        <User className="h-16 w-16 mx-auto mb-4 text-slate-500" />
                        <p className="text-slate-300 text-lg mb-4">Загрузите свой первый голос</p>
                        <Dialog open={uploadDialogOpen} onOpenChange={(open) => {
                            setUploadDialogOpen(open);
                            if (!open) {
                                setUploadFile(null);
                                setVoiceName('');
                                if (fileInputRef.current) {
                                    fileInputRef.current.value = '';
                                }
                            }
                        }}>
                            <DialogTrigger asChild>
                                <Button className="bg-purple-600 hover:bg-purple-700">
                                    <Upload className="h-4 w-4 mr-2" />
                                    Загрузить свой голос
                                </Button>
                            </DialogTrigger>
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
                                        <Label htmlFor="voice-name">Имя голоса</Label>
                                        <Input 
                                            id="voice-name"
                                            type="text"
                                            value={voiceName} 
                                            onChange={(e) => setVoiceName(e.target.value)} 
                                            placeholder="Введите имя голоса"
                                            className="mt-1" 
                                        />
                                        <p className="text-xs text-slate-400 mt-1">
                                            Имя будет использоваться для выбора голоса в TTS
                                        </p>
                                    </div>
                                    <div className="bg-blue-900/20 border border-blue-500/50 rounded-lg p-3">
                                        <p className="text-sm text-slate-300">
                                            Голос будет доступен только вам и загружен в вашу личную папку голосов.
                                        </p>
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
                    </div>
                </div>
            ) : (
                <div className="space-y-8">
                    {/* Пользовательские голоса (верхняя секция) - показываем только если есть whitelist */}
                    {/* Показываем секцию даже если нет голосов, но есть whitelist */}
                    {!user?.isGuest && whitelistStatus?.can_manage_voices && (
                        <div>
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-2">
                                    <User className="h-5 w-5 text-green-400" />
                                    <h3 className="text-lg font-semibold text-white">Мои голоса</h3>
                                    {userVoices.length > 0 && (
                                        <Badge variant="outline" className="text-green-400 border-green-400">
                                            {userVoices.length}
                                        </Badge>
                                    )}
                                </div>
                                {/* Кнопка загрузки - всегда показываем если есть whitelist */}
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
                                    <DialogTrigger asChild>
                                        <Button className="bg-purple-600 hover:bg-purple-700">
                                            <Upload className="h-4 w-4 mr-2" />
                                            Загрузить свой голос
                                        </Button>
                                    </DialogTrigger>
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
                                    <Label htmlFor="voice-name">Имя голоса</Label>
                                 <Input 
                                        id="voice-name"
                                        type="text"
                                     value={voiceName} 
                                     onChange={(e) => setVoiceName(e.target.value)} 
                                        placeholder="Введите имя голоса"
                                     className="mt-1" 
                                 />
                                    <p className="text-xs text-slate-400 mt-1">
                                        Имя будет использоваться для выбора голоса в TTS
                                    </p>
                             </div>
                                <div className="bg-blue-900/20 border border-blue-500/50 rounded-lg p-3">
                                     <p className="text-sm text-slate-300">
                                         Голос будет доступен только вам и загружен в вашу личную папку голосов.
                                     </p>
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
                            </div>
                            {userVoices.length === 0 ? (
                                <div className="text-center py-8 bg-slate-800/50 rounded-lg border border-slate-700 border-dashed">
                                    <User className="h-10 w-10 mx-auto mb-3 text-slate-600" />
                                    <p className="text-slate-400 mb-2">У вас пока нет личных голосов</p>
                                    <p className="text-sm text-slate-500">Загрузите свой первый голос, чтобы начать</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-2">
                                    {userVoices.map((voice) => {
                                        const isEnabled = enabledVoiceIds.includes(voice.id);
                                        return (
                                            <Card key={voice.id} className={`bg-slate-800 border-slate-700 flex flex-col transition-opacity ${!isEnabled ? 'opacity-50' : ''}`}>
                                                <CardHeader className="pb-2 pt-3 px-3">
                                                    <div className="flex items-center justify-between gap-2">
                                                        <CardTitle className="text-xs font-medium text-white flex items-center gap-1.5 flex-1 min-w-0">
                                                            <Checkbox
                                                                checked={isEnabled}
                                                                onCheckedChange={() => handleToggleVoiceEnabled(voice.id)}
                                                                className="flex-shrink-0"
                                                            />
                                                            <User className="h-3.5 w-3.5 text-green-400 flex-shrink-0"/>
                                                            <span className="truncate">{voice.name}</span>
                                                        </CardTitle>
                                                    </div>
                                                </CardHeader>
                                                <CardContent className="flex-grow flex flex-col justify-end pt-0 px-3 pb-3">
                                                    <div className="flex gap-1.5">
                                                        <Button 
                                                            className="flex-1 h-7 text-xs px-2" 
                                                            variant="outline" 
                                                            size="sm" 
                                                            onClick={() => handleEdit(voice)}
                                                        >
                                                            <Settings className="h-3 w-3 mr-1"/>
                                                            Настроить
                                                        </Button>
                                                        <Button 
                                                            className="h-7 w-7 p-0 text-red-400 hover:text-red-300 hover:bg-red-900/20" 
                                                            variant="ghost" 
                                                            size="sm" 
                                                            onClick={() => handleDelete(voice.id)}
                                                            title="Удалить голос"
                                                        >
                                                            <Trash2 className="h-3 w-3"/>
                                                        </Button>
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Разделитель между секциями */}
                    {!user?.isGuest && userVoices.length > 0 && whitelistStatus?.can_manage_voices && globalVoices.length > 0 && (
                        <hr className="border-slate-700" />
                    )}

                    {/* Глобальные голоса (нижняя секция) - только для пользователей с whitelist */}
                    {whitelistStatus?.can_manage_voices && (
                        <div>
                            <div className="flex items-center gap-2 mb-4">
                                <Globe className="h-5 w-5 text-blue-400" />
                                <h3 className="text-lg font-semibold text-white">Глобальные голоса</h3>
                                <Badge variant="outline" className="text-blue-400 border-blue-400">
                                    {globalVoices.length}
                                </Badge>
                            </div>
                            {globalVoices.length === 0 ? (
                                <div className="text-center py-12 bg-slate-800/50 rounded-lg border border-slate-700 border-dashed">
                                    <Globe className="h-16 w-16 mx-auto mb-4 text-slate-600" />
                                    <p className="text-slate-400 text-lg mb-2">Глобальных голосов пока нет</p>
                                    <p className="text-sm text-slate-500">Глобальные голоса доступны всем пользователям</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-2">
                                    {globalVoices.map((voice) => {
                                        const isEnabled = enabledVoiceIds.includes(voice.id);
                                        return (
                                            <Card key={voice.id} className={`bg-slate-800 border-slate-700 flex flex-col transition-opacity ${!isEnabled ? 'opacity-50' : ''}`}>
                                                <CardHeader className="pb-2 pt-3 px-3">
                                                    <div className="flex items-center justify-between gap-2">
                                                        <CardTitle className="text-xs font-medium text-white flex items-center gap-1.5 flex-1 min-w-0">
                                                            <Checkbox
                                                                checked={isEnabled}
                                                                onCheckedChange={() => handleToggleVoiceEnabled(voice.id)}
                                                                className="flex-shrink-0"
                                                            />
                                                            <Globe className="h-3.5 w-3.5 text-blue-400 flex-shrink-0"/>
                                                            <span className="truncate">{voice.name}</span>
                                                        </CardTitle>
                                                    </div>
                                                </CardHeader>
                                                <CardContent className="flex-grow flex flex-col justify-end pt-0 px-3 pb-3">
                                                    <Button 
                                                        className="w-full h-7 text-xs px-2" 
                                                        variant="outline" 
                                                        size="sm" 
                                                        onClick={() => handleEdit(voice)}
                                                    >
                                                        <Settings className="h-3 w-3 mr-1"/>
                                                        Настроить
                                                    </Button>
                                                </CardContent>
                                            </Card>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

             {/* Диалог редактирования голоса */}
            <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
                <DialogContent 
                    key={`edit-dialog-${currentVoice?.id || 'new'}`}
                    className="max-w-lg" 
                    onOpenAutoFocus={(e) => e.preventDefault()}
                    onCloseAutoFocus={(e) => e.preventDefault()}
                >
                    <DialogHeader>
                        <DialogTitle>{`Настройки голоса "${currentVoice?.name}"`}</DialogTitle>
                    </DialogHeader>
                    {currentVoice && (
                        <div className="space-y-4 py-4">
                            {/* Уведомление для глобальных голосов */}
                            {currentVoice.voice_type === 'global' && (
                                <div className="bg-blue-900/20 border border-blue-500/50 rounded-lg p-2 flex items-center gap-2">
                                    <Lock className="h-4 w-4 text-blue-400 flex-shrink-0" />
                                    <p className="text-blue-200/80 text-xs">
                                        Настройки применяются только к вашему профилю
                                    </p>
                                </div>
                            )}
                            
                            <div>
                                <Label htmlFor="reference-text">Референсный текст</Label>
                                <Textarea
                                  id="reference-text"
                                  value={currentVoice.reference_text || ''}
                                  onChange={(e) => handleReferenceTextChange(e.target.value)}
                                  className="mt-1 bg-slate-800"
                                  rows={3}
                                  placeholder="Введите референсный текст для синтеза..."
                                  disabled={currentVoice.voice_type === 'global'}
                                />
                                {currentVoice.voice_type === 'user' && (
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
                                )}
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
                                            logger.log('Speed preset changed to:', preset);
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
                                </div>
                                
                            </div>
                        </div>
                    )}
                    <DialogFooter className="flex-wrap gap-2">
                        <Button onClick={handleTestVoice} variant="outline" disabled={isTestingVoice} className="flex-1 min-w-[100px]">
                            <TestTube2 className="h-4 w-4 mr-2"/>{isTestingVoice ? 'Генерирую...' : 'Тест'}
                        </Button>
                        {currentVoice?.voice_type === 'user' && (
                        <Button onClick={handleRenameVoice} variant="outline" className="flex-1 min-w-[140px] text-orange-600 border-orange-600 hover:bg-orange-600 hover:text-white">
                            <Edit className="h-4 w-4 mr-2"/>Переименовать
                        </Button>
                        )}
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