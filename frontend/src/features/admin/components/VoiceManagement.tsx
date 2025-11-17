import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import ReactDOM from 'react-dom';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Upload, Trash2, Edit, Users, Globe, Settings, TestTube2, Mic, Loader2, RefreshCw, Volume2, X, User as UserIcon, AlertCircle } from 'lucide-react';
import { Slider } from "@/components/ui/slider";
import { getAdminVoices, uploadVoice, deleteVoice, updateVoiceSettings, transcribeVoice, retranscribeVoice, testVoice, getUsers, renameVoice } from '../../../services/unified-api';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '@/components/ui/toast';
import { TTS_SERVICE_URL } from '../../../constants';
import { logger } from '../../../utils/prodLogger';
import type { TtsVoice } from '../../../types/tts';

interface VoiceManagementUser {
    id: number;
    username: string;
}

type SpeedPreset = 'very_slow' | 'slow' | 'normal' | 'fast' | 'very_fast';
type OwnerType = 'global' | 'user';

const VoiceManagement: React.FC = () => {
    const { addToast } = useToast();
    const [loading, setLoading] = useState<boolean>(true);
    const [uploadDialogOpen, setUploadDialogOpen] = useState<boolean>(false);
    const [testText, setTestText] = useState<string>("Привет, я бы хотел с тобой постримить, если честно, для меня бы это было честью. Постримить с таким великим стримером было бы реально круто.");
    const [editDialogOpen, setEditDialogOpen] = useState<boolean>(false);
    
    const [currentVoice, setCurrentVoice] = useState<TtsVoice | null>(null);
    
    // Состояние для актуальных значений ползунков при тестировании
    const [testCfgStrength, setTestCfgStrength] = useState<number>(2.5);
    const [testSpeedPreset, setTestSpeedPreset] = useState<SpeedPreset>('normal');
    
    // Состояние для фильтрации
    const [selectedUserFilter, setSelectedUserFilter] = useState<string>('all');
    
    // Состояние для загрузки
    const [uploadFile, setUploadFile] = useState<File | null>(null);
    const [voiceName, setVoiceName] = useState<string>('');
    const [ownerId, setOwnerId] = useState<OwnerType>('global');
    const [selectedUserId, setSelectedUserId] = useState<string>('');
    const [isUploading, setIsUploading] = useState<boolean>(false);
    const [isTranscribing, setIsTranscribing] = useState<boolean>(false);
    const [isTestingVoice, setIsTestingVoice] = useState<boolean>(false);
    const [isPlaying, setIsPlaying] = useState<boolean>(false);
    const [ttsServiceWarning, setTtsServiceWarning] = useState<string | null>(null);
    const isUserClosingRef = useRef<boolean>(false);
    const queryClient = useQueryClient();
    
    const { user } = useAuth();
    const audioContext: AudioContext | null = null;
    const audioSource: AudioBufferSourceNode | null = null;

    // React Query: загружаем голоса для админа
    const { data: voicesData = [], isLoading: voicesLoading, error: voicesError } = useQuery<TtsVoice[]>({
        queryKey: ['admin-voices'],
        queryFn: async (): Promise<TtsVoice[]> => {
            logger.log('🔍 [ADMIN] Fetching voices...');
            const response = await getAdminVoices();
            logger.log('🔍 [ADMIN] Raw response:', response);
            
            const data = (response as any)?.data || response;
            logger.log('🔍 [ADMIN] Extracted data:', data);
            
            if ((data as any)?.warning) {
                setTtsServiceWarning((data as any).warning);
                logger.warn('⚠️ [ADMIN] TTS Service warning:', (data as any).warning);
            } else {
                setTtsServiceWarning(null);
            }
            
            let voicesArray: TtsVoice[] = [];
            if (Array.isArray(data)) {
                voicesArray = data as TtsVoice[];
                logger.log('✅ [ADMIN] Data is array, using directly');
            } else if ((data as any)?.status === 'success' && Array.isArray((data as any).voices)) {
                voicesArray = (data as any).voices as TtsVoice[];
                logger.log('✅ [ADMIN] Found voices in data.voices (status: success)');
            } else if (Array.isArray((data as any)?.voices)) {
                voicesArray = (data as any).voices as TtsVoice[];
                logger.log('✅ [ADMIN] Found voices array in data.voices');
            } else if ((data as any)?.success && Array.isArray((data as any).voices)) {
                voicesArray = (data as any).voices as TtsVoice[];
                logger.log('✅ [ADMIN] Found voices in success response');
            } else if (Array.isArray((data as any)?.data)) {
                voicesArray = (data as any).data as TtsVoice[];
                logger.log('✅ [ADMIN] Found voices in data.data');
            } else if (Array.isArray((data as any)?.global_voices) || Array.isArray((data as any)?.user_voices)) {
                voicesArray = [
                    ...((data as any).global_voices || []),
                    ...((data as any).user_voices || [])
                ] as TtsVoice[];
                logger.log('✅ [ADMIN] Combined global and user voices:', voicesArray.length);
            } else {
                logger.warn('⚠️ [ADMIN] Could not extract voices array from response:', data);
                voicesArray = [];
            }
            
            logger.log('✅ [ADMIN] Loaded voices:', voicesArray.length, 'voices');
            if (voicesArray.length > 0) {
                logger.log('✅ [ADMIN] First voice sample:', voicesArray[0]);
            }
            return voicesArray;
        },
        staleTime: 5 * 60 * 1000,
        refetchOnMount: true,
        refetchOnWindowFocus: false,
    });

    // Handle errors from the query
    useEffect(() => {
        if (voicesError) {
            logger.error('❌ [ADMIN] Error loading voices:', voicesError);
            const error = voicesError as any;
            
            if (error.message?.includes('connection') || error.message?.includes('timeout') || error.code === 'ECONNREFUSED') {
                setTtsServiceWarning(`Ошибка подключения к TTS сервису: ${error.message || 'Сервис недоступен'}`);
            } else if (error.response?.status === 500 && error.response?.data?.detail?.includes('connection')) {
                setTtsServiceWarning(error.response.data.detail);
            }
        }
    }, [voicesError]);

    // React Query: загружаем пользователей
    const { data: usersData = [], isLoading: usersLoadingQuery, error: usersError } = useQuery<VoiceManagementUser[]>({
        queryKey: ['admin-voice-users'],
        queryFn: async (): Promise<VoiceManagementUser[]> => {
            const response = await getUsers();
            
            let usersData: VoiceManagementUser[] = [];
            if (Array.isArray(response)) {
                usersData = response as VoiceManagementUser[];
            } else if (response && Array.isArray((response as any).data)) {
                usersData = (response as any).data as VoiceManagementUser[];
            } else if (response && (response as any).users) {
                usersData = (response as any).users as VoiceManagementUser[];
            }
            
            return usersData;
        },
        staleTime: 5 * 60 * 1000,
        refetchOnMount: true,
        refetchOnWindowFocus: false,
    });

    // Handle errors from the users query
    useEffect(() => {
        if (usersError) {
            logger.error('Error loading users:', usersError);
            const error = usersError as any;
            addToast({ type: 'error', title: 'Ошибка', message: `Не удалось загрузить пользователей: ${error.message || 'Неизвестная ошибка'}` });
        }
    }, [usersError, addToast]);

    const voices = voicesData ?? [];
    const users = usersData ?? [];
    
    useEffect(() => {
        setLoading(voicesLoading);
    }, [voicesLoading]);

    useEffect(() => {
        if (!editDialogOpen) return undefined;
        
        const handleEscape = (e: KeyboardEvent): void => {
            if (e.key === 'Escape') {
                setEditDialogOpen(false);
            }
        };
        
        document.addEventListener('keydown', handleEscape);
        return (): void => {
            document.removeEventListener('keydown', handleEscape);
        };
    }, [editDialogOpen]);
    
    useEffect(() => {
        if (editDialogOpen) {
            document.body.style.overflow = 'hidden';
            return (): void => {
                document.body.style.overflow = '';
            };
        }
        return undefined;
    }, [editDialogOpen]);

    useEffect(() => {
        if (!uploadDialogOpen) return undefined;
        
        const handleEscape = (e: KeyboardEvent): void => {
            if (e.key === 'Escape') {
                setUploadDialogOpen(false);
            }
        };
        
        document.addEventListener('keydown', handleEscape);
        return (): void => {
            document.removeEventListener('keydown', handleEscape);
        };
    }, [uploadDialogOpen]);
    
    useEffect(() => {
        if (uploadDialogOpen) {
            document.body.style.overflow = 'hidden';
            return (): void => {
                document.body.style.overflow = '';
            };
        }
        return undefined;
    }, [uploadDialogOpen]);

    const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>): void => {
        const file = event.target.files?.[0];
        if (!file) {
            return;
        }
        
        const supportedFormats = ['.wav', '.mp3', '.flac', '.ogg', '.m4a', '.aac', '.wma', '.aiff', '.au'];
        const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
        
        if (!supportedFormats.includes(fileExtension)) {
            addToast({ 
                type: 'error', 
                title: 'Ошибка', 
                message: `Неподдерживаемый формат файла. Поддерживаемые форматы: ${supportedFormats.join(', ')}` 
            });
            event.target.value = '';
            return;
        }
        
        setUploadFile(file);
        const nameWithoutExt = file.name.replace(/\.[^/.]+$/, "");
        setVoiceName(nameWithoutExt);
    };

    const handleUpload = async (_event: React.MouseEvent<HTMLButtonElement>): Promise<void> => {
        if (!uploadFile || !voiceName.trim()) {
            addToast({ type: 'error', title: 'Ошибка', message: 'Выберите файл и введите имя голоса.' });
            return;
        }

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
                const { uploadUserVoice } = await import('../../../services/unified-api');
                formData.append('user_id', selectedUserId);
                await uploadUserVoice(parseInt(selectedUserId, 10), formData);
            } else {
                await uploadVoice(formData);
            }

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
        } catch (error: any) {
            addToast({ type: 'error', title: 'Ошибка', message: error.message || 'Не удалось загрузить голос.' });
        } finally {
            setIsUploading(false);
        }
    };

    const handleDelete = async (voiceId: number, _event: React.MouseEvent<HTMLButtonElement>): Promise<void> => {
        const voiceToDelete = voices.find(v => v.id === voiceId);
        if (!voiceToDelete || !window.confirm(`Вы уверены, что хотите удалить голос "${voiceToDelete.name}"?`)) {
            return;
        }

        try {
            await deleteVoice(voiceId);
            addToast({ type: 'success', title: 'Успех', message: `Голос "${voiceToDelete.name}" удален.` });
            queryClient.invalidateQueries({ queryKey: ['admin-voices'] });
        } catch (error: any) {
            addToast({ type: 'error', title: 'Ошибка', message: error.message || 'Не удалось удалить голос.' });
        }
    };
    
    const handleEdit = (voice: TtsVoice): void => {
        setCurrentVoice({ ...voice });
        setTestCfgStrength(voice.cfg_strength || 2.5);
        setTestSpeedPreset((voice.speed_preset as SpeedPreset) || 'normal');
        setEditDialogOpen(true);
    };


    const handleReferenceTextChange = (value: string): void => {
        setCurrentVoice(prev => prev ? {...prev, reference_text: value} : null);
    };

    const handleRenameVoice = async (): Promise<void> => {
        if (!currentVoice) return;
        
        const newName = prompt('Введите новое имя голоса:', currentVoice.name);
        if (!newName || newName.trim() === '' || newName === currentVoice.name) return;
        
        try {
            await renameVoice(currentVoice.id, newName.trim());
            
            queryClient.setQueryData(['admin-voices'], (prev: TtsVoice[] = []) => prev.map(voice => 
                voice.id === currentVoice.id 
                    ? {...voice, name: newName.trim()}
                    : voice
            ));
            
            setCurrentVoice(prev => prev ? {...prev, name: newName.trim()} : null);
            
            addToast({ type: 'success', title: 'Успех', message: 'Голос переименован успешно!' });
        } catch (error) {
            logger.error('Error renaming voice:', error);
            addToast({ type: 'error', title: 'Ошибка', message: 'Не удалось переименовать голос.' });
        }
    };

    const handleSaveSettings = async (): Promise<void> => {
        if (!currentVoice) return;
        
        try {
            const settings = {
                cfg_strength: testCfgStrength,
                speed_preset: testSpeedPreset,
                reference_text: currentVoice.reference_text
            };
            
            await updateVoiceSettings(currentVoice.id, settings);
            
            queryClient.setQueryData(['admin-voices'], (prev: TtsVoice[] = []) => prev.map(voice => 
                voice.id === currentVoice.id 
                    ? {...voice, ...settings}
                    : voice
            ));
            
            setCurrentVoice(prev => prev ? {...prev, ...settings} : null);
            
            isUserClosingRef.current = true;
            setEditDialogOpen(false);
            addToast({ type: 'success', title: 'Успех', message: 'Настройки голоса сохранены!' });
        } catch (error) {
            logger.error('Error updating voice settings:', error);
            addToast({ type: 'error', title: 'Ошибка', message: 'Не удалось сохранить настройки.' });
        }
    };
    

    const handleTestVoice = async (): Promise<void> => {
        if (!currentVoice || !user) return;

        setIsTestingVoice(true);
        try {
            const response = await testVoice(
                currentVoice.id || 0,
                testText
            );
            
            const audioUrl = (response as any).data?.audio_url || (response as any).audio_url;
            if (audioUrl) {
                const fullAudioUrl = audioUrl.startsWith('http') ? audioUrl : `${TTS_SERVICE_URL}${audioUrl}`;
                
                const audio = new Audio(fullAudioUrl);
                
                audio.oncanplay = () => {
                    setIsTestingVoice(false);
                    
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
                    audio.play().then(() => {
                        // Audio playing successfully
                    }).catch((playError) => {
                        logger.error('Play error (onloadeddata):', playError);
                    });
                };
                
                audio.onerror = () => {
                    logger.error('Audio error');
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
                
                setTimeout(() => {
                    if (audio.readyState >= 2) {
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
        } catch (error: any) {
            logger.error('Test voice error:', error);
            setIsTestingVoice(false);
            addToast({ type: 'error', title: 'Ошибка', message: error.message || 'Не удалось протестировать голос.' });
        }
    };

    const handleTranscribeVoice = async (): Promise<void> => {
        if (!currentVoice || !currentVoice.reference_text?.trim()) return;
        
        setIsTranscribing(true);
        try {
            const response = await transcribeVoice(currentVoice.id);
            
            setCurrentVoice(prev => prev ? {...prev, reference_text: (response as any).data.reference_text} : null);
            
            queryClient.setQueryData(['admin-voices'], (prev: TtsVoice[] = []) => prev.map(voice => 
                voice.id === currentVoice.id 
                    ? {...voice, reference_text: (response as any).data.reference_text}
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

    const handleRetranscribeVoice = async (): Promise<void> => {
        if (!currentVoice || !currentVoice.reference_text?.trim()) return;
        
        setIsTranscribing(true);
        try {
            const response = await retranscribeVoice(currentVoice.id);
            
            setCurrentVoice(prev => prev ? {...prev, reference_text: (response as any).data.reference_text} : null);
            
            queryClient.setQueryData(['admin-voices'], (prev: TtsVoice[] = []) => prev.map(voice => 
                voice.id === currentVoice.id 
                    ? {...voice, reference_text: (response as any).data.reference_text}
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
                                    onClick={() => queryClient.invalidateQueries({ queryKey: ['admin-voices'] })}
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
                                 <div>
                                     <div className="flex items-center justify-between mb-4">
                                         <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                                             <Users className="h-5 w-5 text-green-400" />
                                             Пользовательские голоса
                                             <Badge variant="outline" className="ml-2 text-green-400 border-green-400">
                                                 {voices.filter(v => v.voice_type === 'user').length}
                                             </Badge>
                                         </h3>
                                         {users.length > 0 && (
                                             <Select value={selectedUserFilter} onValueChange={setSelectedUserFilter}>
                                                 <SelectTrigger className="w-48">
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
                                                                             <UserIcon className="h-3 w-3" />
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

                                 <div className="border-t border-gray-700"></div>

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
                                     <div className="mb-4 p-3 bg-blue-900/20 border border-blue-500/30 rounded-lg">
                                         <p className="text-blue-200 text-sm">
                                             <strong>Глобальные голоса</strong> доступны всем пользователям платформы. 
                                             Пользователи могут настраивать личные параметры (скорость, громкость, CFG) для каждого глобального голоса, 
                                             но не могут изменять сам голос или удалять его.
                                         </p>
                                     </div>
                                     {(() => {
                                         const globalVoices = voices.filter(v => v.voice_type === 'global');
                                         return globalVoices.length === 0 ? (
                                             <div className="text-center py-12 bg-gray-800/30 rounded-lg border border-gray-700 border-dashed">
                                                 <Globe className="h-16 w-16 text-gray-600 mx-auto mb-4" />
                                                 <p className="text-gray-400 text-lg mb-2">Глобальных голосов пока нет</p>
                                                <p className="text-gray-500 text-sm mb-4">Загрузите первый глобальный голос через кнопку "Загрузить голос" вверху страницы и выберите тип "Глобальный голос"</p>
                                             </div>
                                         ) : (
                                             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                                 {globalVoices.map((voice) => (
                                                     <Card key={voice.id} className="bg-slate-800 border-blue-500/30 flex flex-col h-full transition-all hover:border-blue-400 hover:shadow-lg hover:shadow-blue-500/20">
                                                         <CardHeader className="pb-3">
                                                             <div className="flex items-center justify-between">
                                                                 <CardTitle className="text-sm font-medium text-white flex items-center gap-2">
                                                                     <Globe className="h-4 w-4 text-blue-400 flex-shrink-0"/>
                                                                     <span className="truncate">{voice.name}</span>
                                                                 </CardTitle>
                                                                 <Badge variant="outline" className="text-xs text-blue-400 border-blue-400">
                                                                     Глобальный
                                                                 </Badge>
                                                             </div>
                                                             <div className="text-xs text-gray-400 mt-2">
                                                                 Доступен всем пользователям
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
                                                                     title="Удалить глобальный голос"
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
                             </>
                         )}
                     </div>
                 </CardContent>
             </Card>

            {uploadDialogOpen && ReactDOM.createPortal(
                <>
                    <div 
                        className="fixed inset-0 bg-black/80 z-[9999]"
                        onClick={() => setUploadDialogOpen(false)}
                    />
                    
                    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 pointer-events-none">
                        <div 
                            className="bg-gray-900 rounded-lg max-w-md w-full max-h-[90vh] overflow-hidden flex flex-col pointer-events-auto shadow-2xl"
                            onClick={(e) => e.stopPropagation()}
                        >
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
                                        <Select value={ownerId} onValueChange={(value: OwnerType) => {
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
                                                    {usersLoadingQuery ? (
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

            {editDialogOpen && currentVoice && ReactDOM.createPortal(
                <>
                    <div 
                        className="fixed inset-0 bg-black/80 z-[9999]"
                        onClick={() => setEditDialogOpen(false)}
                    />
                    
                    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 pointer-events-none">
                        <div 
                            className="bg-gray-900 rounded-lg max-w-lg w-full max-h-[90vh] overflow-hidden flex flex-col pointer-events-auto shadow-2xl"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="border-b border-gray-700 p-4 flex items-center justify-between">
                                <h2 className="text-xl font-bold text-white">Настройки голоса "{currentVoice?.name}"</h2>
                                <button 
                                    onClick={() => setEditDialogOpen(false)} 
                                    className="text-gray-400 hover:text-white transition-colors"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                            
                            <div className="flex-1 overflow-y-auto p-6">
                                <div className="grid gap-6 py-4">
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
                                    
                                    <div className="space-y-4">
                                        <h4 className="text-sm font-medium text-white">Настройки генерации</h4>
                                        
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
                                                    setCurrentVoice(prev => prev ? ({ ...prev, cfg_strength: value[0] }) : null);
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
                                                    const preset: SpeedPreset = value[0] === 0 ? 'very_slow' : 
                                                                 value[0] === 1 ? 'slow' : 
                                                                 value[0] === 2 ? 'normal' :
                                                                 value[0] === 3 ? 'fast' : 'very_fast';
                                                    setTestSpeedPreset(preset);
                                                    setCurrentVoice(prev => prev ? ({ ...prev, speed_preset: preset }) : null);
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



