import React, { useEffect, useRef, useState } from 'react';

/* eslint-disable no-alert */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, Edit, Globe, Loader2, Mic, RefreshCw, Settings, TestTube2, Trash2, Upload, User as UserIcon, Users, Volume2, X } from 'lucide-react';
import ReactDOM from 'react-dom';

import { TTS_SERVICE_URL } from '@/constants';
import { useAuth } from '@/context/AuthContext';
import { deleteVoice, getAdminVoices, getUsers, renameVoice, retranscribeVoice, testVoice, updateVoiceSettings, uploadVoice } from '@/services/unified-api';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';
import { PageLoader } from '@/shared/components/ui/loader';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';
import { Slider } from '@/shared/components/ui/slider';
import { Textarea } from '@/shared/components/ui/textarea';
import { useToast } from '@/shared/components/ui/toast';
import { logger } from '@/shared/utils/prodLogger';

import type { TtsVoice } from '@/types/tts';

interface VoiceManagementUser {
    id: number;
    username: string;
}

type SpeedPreset = 'very_slow' | 'slow' | 'normal' | 'fast' | 'very_fast';
type OwnerType = 'global' | 'user';
type VoiceProvider = 'f5' | 'qwen';

interface ApiResponse {
    data?: unknown;
    warning?: string;
}

interface VoicesResponse {
    global_voices?: TtsVoice[];
    user_voices?: TtsVoice[];
}

interface AudioResponse {
    data?: {
        audio_url?: string;
    };
    audio_url?: string;
}

interface TranscribeResponse {
    data: {
        reference_text: string;
    };
}

const SURFACE_CARD_CLASS = 'border-border/70 bg-card/75';
const VOICE_CARD_CLASS = 'border-border/70 bg-card/80 flex h-full flex-col transition-colors';
const MODAL_OVERLAY_CLASS = 'fixed inset-0 z-[9999] bg-black/65 backdrop-blur-[1px]';
const MODAL_PANEL_CLASS = 'pointer-events-auto flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-border/70 bg-background/95 shadow-2xl shadow-black/35';
const DIALOG_FOOTER_CLASS = 'flex justify-center gap-4 border-t border-border/70 p-4';
const INFO_BOX_CLASS = 'mt-1 rounded-md border border-border/60 bg-muted/35 p-2.5 text-xs text-muted-foreground';

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
    const [searchQuery, setSearchQuery] = useState<string>('');

    // Состояние для загрузки
    const [uploadFile, setUploadFile] = useState<File | null>(null);
    const [voiceName, setVoiceName] = useState<string>('');
    const [ownerId, setOwnerId] = useState<OwnerType>('global');
    const [voiceProvider, setVoiceProvider] = useState<VoiceProvider>('f5');
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
    // Note: audioContext and audioSource are declared but not used in this component
    // They are kept for potential future audio processing features
    void audioContext;
    void audioSource;

    // React Query: загружаем голоса для админа
    const { data: voicesData = [], isLoading: voicesLoading, error: voicesError } = useQuery<TtsVoice[]>({
        queryKey: ['admin-voices', voiceProvider],
        queryFn: async (): Promise<TtsVoice[]> => {
            logger.log('[DEBUG] [ADMIN] Fetching voices...');
            const response = await getAdminVoices(voiceProvider);
            logger.log('[DEBUG] [ADMIN] Raw response:', response);

            const apiResponse = response as ApiResponse;
            const data = apiResponse?.data || response;
            logger.log('[DEBUG] [ADMIN] Extracted data:', data);

            const dataWithWarning = data as { warning?: string };
            if (dataWithWarning?.warning) {
                setTtsServiceWarning(dataWithWarning.warning);
                logger.warn('[WARN] [ADMIN] TTS Service warning:', dataWithWarning.warning);
            } else {
                setTtsServiceWarning(null);
            }

            let voicesArray: TtsVoice[] = [];
            if (Array.isArray(data)) {
                voicesArray = data as TtsVoice[];
                logger.log('[OK] [ADMIN] Data is array, using directly');
            } else {
                const dataObj = data as { status?: string; success?: boolean; voices?: TtsVoice[] | VoicesResponse; data?: TtsVoice[]; global_voices?: TtsVoice[]; user_voices?: TtsVoice[] };

                if (dataObj?.status === 'success' && Array.isArray(dataObj.voices)) {
                    voicesArray = dataObj.voices;
                    logger.log('[OK] [ADMIN] Found voices in data.voices (status: success)');
                } else if (Array.isArray(dataObj?.voices)) {
                    voicesArray = dataObj.voices;
                    logger.log('[OK] [ADMIN] Found voices array in data.voices');
                } else if (dataObj?.success && typeof dataObj.voices === 'object' && dataObj.voices !== null) {
                    // [OK] ИСПРАВЛЕНИЕ: Обрабатываем случай когда voices - это объект с global_voices и user_voices
                    const voicesObj = dataObj.voices as VoicesResponse;
                    voicesArray = [
                        ...(voicesObj.global_voices || []),
                        ...(voicesObj.user_voices || [])
                    ];
                    logger.log('[OK] [ADMIN] Found voices object with global/user voices:', voicesArray.length);
                } else if (dataObj?.success && Array.isArray(dataObj.voices)) {
                    voicesArray = dataObj.voices;
                    logger.log('[OK] [ADMIN] Found voices in success response');
                } else if (Array.isArray(dataObj?.data)) {
                    voicesArray = dataObj.data;
                    logger.log('[OK] [ADMIN] Found voices in data.data');
                } else if (Array.isArray(dataObj?.global_voices) || Array.isArray(dataObj?.user_voices)) {
                    voicesArray = [
                        ...(dataObj.global_voices || []),
                        ...(dataObj.user_voices || [])
                    ];
                    logger.log('[OK] [ADMIN] Combined global and user voices:', voicesArray.length);
                } else {
                    logger.warn('[WARN] [ADMIN] Could not extract voices array from response:', data);
                    voicesArray = [];
                }
            }

            logger.log('[OK] [ADMIN] Loaded voices:', voicesArray.length, 'voices');
            if (voicesArray.length > 0) {
                logger.log('[OK] [ADMIN] First voice sample:', voicesArray[0]);
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
            logger.error('[ERROR] [ADMIN] Error loading voices:', voicesError);
            const error = voicesError as { message?: string; code?: string; response?: { status?: number; data?: { detail?: string } } };

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
            } else {
                const responseObj = response as unknown as { data?: VoiceManagementUser[]; users?: VoiceManagementUser[] };
                if (Array.isArray(responseObj.data)) {
                    usersData = responseObj.data;
                } else if (responseObj.users) {
                    usersData = responseObj.users;
                }
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
            const error = usersError as { message?: string };
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
                await uploadUserVoice(parseInt(selectedUserId, 10), formData, voiceProvider);
            } else {
                await uploadVoice(formData, voiceProvider);
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
            queryClient.invalidateQueries({ queryKey: ['admin-voices', voiceProvider] });
        } catch (error: unknown) {
            const err = error as { message?: string };
            addToast({ type: 'error', title: 'Ошибка', message: err.message || 'Не удалось загрузить голос.' });
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
            await deleteVoice(voiceId, voiceProvider);
            addToast({ type: 'success', title: 'Успех', message: `Голос "${voiceToDelete.name}" удален.` });
            queryClient.invalidateQueries({ queryKey: ['admin-voices', voiceProvider] });
        } catch (error: unknown) {
            const err = error as { message?: string };
            addToast({ type: 'error', title: 'Ошибка', message: err.message || 'Не удалось удалить голос.' });
        }
    };

    const handleEdit = (voice: TtsVoice): void => {
        setCurrentVoice({ ...voice });
        setTestCfgStrength(voice.cfg_strength || 2.5);
        setTestSpeedPreset((voice.speed_preset as SpeedPreset) || 'normal');
        setEditDialogOpen(true);
    };


    const handleReferenceTextChange = (value: string): void => {
        setCurrentVoice(prev => prev ? { ...prev, reference_text: value } : null);
    };

    const handleRenameVoice = async (): Promise<void> => {
        if (!currentVoice) return;

        const newName = prompt('Введите новое имя голоса:', currentVoice.name);
        if (!newName || newName.trim() === '' || newName === currentVoice.name) return;

        try {
            await renameVoice(currentVoice.id, newName.trim(), voiceProvider);

            queryClient.setQueryData(['admin-voices', voiceProvider], (prev: TtsVoice[] = []) => prev.map(voice =>
                voice.id === currentVoice.id
                    ? { ...voice, name: newName.trim() }
                    : voice
            ));

            setCurrentVoice(prev => prev ? { ...prev, name: newName.trim() } : null);

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

            await updateVoiceSettings(currentVoice.id, settings, voiceProvider);

            queryClient.setQueryData(['admin-voices', voiceProvider], (prev: TtsVoice[] = []) => prev.map(voice =>
                voice.id === currentVoice.id
                    ? { ...voice, ...settings }
                    : voice
            ));

            setCurrentVoice(prev => prev ? { ...prev, ...settings } : null);

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
            const response = await testVoice(currentVoice.id || 0, testText, voiceProvider);

            const audioResponse = response as AudioResponse;
            const audioUrl = audioResponse.data?.audio_url || audioResponse.audio_url;
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
        } catch (error: unknown) {
            logger.error('Test voice error:', error);
            setIsTestingVoice(false);
            const err = error as { message?: string };
            addToast({ type: 'error', title: 'Ошибка', message: err.message || 'Не удалось протестировать голос.' });
        }
    };



    const handleRetranscribeVoice = async (): Promise<void> => {
        if (!currentVoice || !currentVoice.reference_text?.trim()) return;

        setIsTranscribing(true);
        try {
            const response = await retranscribeVoice(currentVoice.id, voiceProvider);
            const transcribeResponse = response as unknown as TranscribeResponse;

            setCurrentVoice(prev => prev ? { ...prev, reference_text: transcribeResponse.data.reference_text } : null);

            queryClient.setQueryData(['admin-voices', voiceProvider], (prev: TtsVoice[] = []) => prev.map(voice =>
                voice.id === currentVoice.id
                    ? { ...voice, reference_text: transcribeResponse.data.reference_text }
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
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <h2 className="flex items-center gap-2 text-2xl font-semibold text-foreground">
                        <Mic className="h-6 w-6 text-muted-foreground" />
                        Управление голосами
                    </h2>
                    <p className="text-muted-foreground mt-1">Загрузка и управление всеми голосовыми сэмплами</p>
                </div>
                <div className="flex items-end gap-2">
                    <div className="w-44">
                        <Label className="text-xs text-muted-foreground">Провайдер</Label>
                        <Select value={voiceProvider} onValueChange={(value) => setVoiceProvider(value as VoiceProvider)}>
                            <SelectTrigger className="mt-1 h-9">
                                <SelectValue placeholder="Выберите провайдер" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="f5">F5 TTS</SelectItem>
                                <SelectItem value="qwen">Qwen 3 TTS</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <Button
                        className="h-9 bg-primary text-primary-foreground hover:bg-primary/90"
                        onClick={() => setUploadDialogOpen(true)}
                    >
                        <Upload className="h-4 w-4 mr-2" />
                        Загрузить голос
                    </Button>
                </div>
            </div>

            <Card className={SURFACE_CARD_CLASS}>
                <CardHeader className="space-y-4">
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-xl font-semibold text-foreground">Список голосов</CardTitle>
                        <Badge variant="outline" className="text-sm">
                            Всего: {voices.length}
                        </Badge>
                    </div>
                    <div className="flex gap-4">
                        <Input
                            placeholder="Поиск по имени голоса..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="max-w-xs"
                        />
                    </div>
                </CardHeader>
                <CardContent>
                    {ttsServiceWarning && (
                        <div className="mb-6 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4">
                            <div className="flex items-start gap-3">
                                <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-300" />
                                <div className="flex-1">
                                    <p className="mb-1 font-semibold text-amber-200">TTS сервис недоступен</p>
                                    <p className="text-sm text-amber-100/90">{ttsServiceWarning}</p>
                                    <p className="mt-2 text-xs text-amber-100/70">
                                        Убедитесь, что TTS сервис запущен и доступен по адресу указанному в переменной окружения TTS_SERVICE_URL.
                                    </p>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => queryClient.invalidateQueries({ queryKey: ['admin-voices', voiceProvider] })}
                                    className="text-amber-200 hover:bg-amber-500/15 hover:text-amber-100"
                                >
                                    <RefreshCw className="h-4 w-4" />
                                </Button>
                            </div>
                        </div>
                    )}
                    <div className="space-y-8">
                        {loading ? (
                            <PageLoader message="Загрузка голосов..." />
                        ) : (
                            <>
                                <div>
                                    <div className="flex items-center justify-between mb-4">
                                        <h3 className="flex items-center gap-2 text-lg font-semibold text-foreground">
                                            <Users className="h-5 w-5 text-emerald-300" />
                                            Пользовательские голоса
                                            <Badge variant="outline" className="ml-2 border-emerald-500/40 text-emerald-200">
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
                                            (selectedUserFilter === 'all' || v.owner_id === parseInt(selectedUserFilter)) &&
                                            (searchQuery === '' || v.name.toLowerCase().includes(searchQuery.toLowerCase()))
                                        );
                                        return userVoices.length === 0 ? (
                                            <div className="rounded-lg border border-border/60 border-dashed bg-muted/25 py-12 text-center">
                                                <Users className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                                                <p className="text-muted-foreground text-lg mb-2">
                                                    {selectedUserFilter !== 'all' ? 'У выбранного пользователя нет голосов' : 'Пользовательских голосов пока нет'}
                                                </p>
                                            </div>
                                        ) : (
                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                                {userVoices.map((voice) => (
                                                    <Card key={voice.id} className={`${VOICE_CARD_CLASS} hover:border-emerald-500/35`}>
                                                        <CardHeader className="pb-3">
                                                            <div className="flex items-center justify-between">
                                                                <CardTitle className="flex items-center gap-2 text-sm font-medium text-foreground">
                                                                    <Users className="h-4 w-4 flex-shrink-0 text-emerald-300" />
                                                                    <span className="truncate">{voice.name}</span>
                                                                </CardTitle>
                                                            </div>
                                                            <div className="text-xs text-muted-foreground truncate mt-2">
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
                                                                    className="h-8 flex-1 border-border/70 bg-background/60 text-foreground hover:bg-accent/70"
                                                                    variant="outline"
                                                                    size="sm"
                                                                >
                                                                    <Settings className="h-4 w-4 mr-1" />
                                                                    Настроить
                                                                </Button>
                                                                <Button
                                                                    onClick={(e) => handleDelete(voice.id, e)}
                                                                    variant="destructive"
                                                                    size="sm"
                                                                >
                                                                    <Trash2 className="h-4 w-4" />
                                                                </Button>
                                                            </div>
                                                        </CardContent>
                                                    </Card>
                                                ))}
                                            </div>
                                        );
                                    })()}
                                </div>

                                <div className="border-t border-border/70"></div>

                                <div>
                                    <div className="flex items-center justify-between mb-4">
                                        <h3 className="flex items-center gap-2 text-lg font-semibold text-foreground">
                                            <Globe className="h-5 w-5 text-sky-300" />
                                            Глобальные голоса
                                            <Badge variant="outline" className="ml-2 border-sky-500/40 text-sky-200">
                                                {voices.filter(v => v.voice_type === 'global').length}
                                            </Badge>
                                        </h3>
                                    </div>
                                    <div className="mb-4 rounded-lg border border-sky-500/35 bg-sky-500/10 p-3">
                                        <p className="text-sm text-sky-100/95">
                                            <strong>Глобальные голоса</strong> доступны всем пользователям платформы.
                                            Пользователи могут настраивать личные параметры (скорость, громкость, CFG) для каждого глобального голоса,
                                            но не могут изменять сам голос или удалять его.
                                        </p>
                                    </div>
                                    {(() => {
                                        const globalVoices = voices.filter(v =>
                                            v.voice_type === 'global' &&
                                            (searchQuery === '' || v.name.toLowerCase().includes(searchQuery.toLowerCase()))
                                        );
                                        return globalVoices.length === 0 ? (
                                            <div className="rounded-lg border border-border/60 border-dashed bg-muted/25 py-12 text-center">
                                                <Globe className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                                                <p className="text-muted-foreground text-lg mb-2">Глобальных голосов пока нет</p>
                                                <p className="text-muted-foreground text-sm mb-4">Загрузите первый глобальный голос через кнопку "Загрузить голос" вверху страницы и выберите тип "Глобальный голос"</p>
                                            </div>
                                        ) : (
                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                                {globalVoices.map((voice) => (
                                                    <Card key={voice.id} className={`${VOICE_CARD_CLASS} hover:border-sky-500/40`}>
                                                        <CardHeader className="pb-3">
                                                            <div className="flex items-center justify-between">
                                                                <CardTitle className="flex items-center gap-2 text-sm font-medium text-foreground">
                                                                    <Globe className="h-4 w-4 flex-shrink-0 text-sky-300" />
                                                                    <span className="truncate">{voice.name}</span>
                                                                </CardTitle>
                                                                <Badge variant="outline" className="border-sky-500/40 text-xs text-sky-200">
                                                                    Глобальный
                                                                </Badge>
                                                            </div>
                                                            <div className="text-xs text-muted-foreground mt-2">
                                                                Доступен всем пользователям
                                                            </div>
                                                        </CardHeader>
                                                        <CardContent className="flex-grow flex flex-col justify-end pt-0">
                                                            <div className="flex gap-2">
                                                                <Button
                                                                    onClick={() => handleEdit(voice)}
                                                                    className="h-8 flex-1 border-border/70 bg-background/60 text-foreground hover:bg-accent/70"
                                                                    variant="outline"
                                                                    size="sm"
                                                                >
                                                                    <Settings className="h-4 w-4 mr-1" />
                                                                    Настроить
                                                                </Button>
                                                                <Button
                                                                    onClick={(e) => handleDelete(voice.id, e)}
                                                                    variant="destructive"
                                                                    size="sm"
                                                                    title="Удалить глобальный голос"
                                                                >
                                                                    <Trash2 className="h-4 w-4" />
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
                        className={MODAL_OVERLAY_CLASS}
                        onClick={() => setUploadDialogOpen(false)}
                    />

                    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 pointer-events-none">
                        <div
                            className={`${MODAL_PANEL_CLASS} max-w-md`}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="flex items-center justify-between border-b border-border/70 p-4">
                                <div>
                                    <h2 className="text-xl font-semibold text-foreground">Загрузка нового голоса</h2>
                                    <p className="text-sm text-muted-foreground mt-1">Загрузите аудио файл для создания нового голоса. Поддерживаются все популярные форматы.</p>
                                </div>
                                <button
                                    onClick={() => setUploadDialogOpen(false)}
                                    className="text-muted-foreground transition-colors hover:text-foreground"
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
                                                className="cursor-pointer text-xs file:mr-2 file:rounded-md file:border file:border-border/70 file:bg-muted/60 file:px-2 file:py-1 file:text-xs file:text-foreground hover:file:bg-accent/70"
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

                            <div className={DIALOG_FOOTER_CLASS}>
                                <Button
                                    onClick={() => setUploadDialogOpen(false)}
                                    variant="outline"
                                    className="h-9 w-28 border-border/70 bg-background/60 text-foreground hover:bg-accent/70"
                                >
                                    Отмена
                                </Button>
                                <Button
                                    onClick={(e) => handleUpload(e)}
                                    disabled={isUploading || !uploadFile || !voiceName.trim() || (ownerId === 'user' && !selectedUserId)}
                                    className="h-9 w-36 bg-primary text-primary-foreground hover:bg-primary/90"
                                >
                                    {isUploading ? (
                                        <span className="flex items-center gap-2">
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                            Загрузка...
                                        </span>
                                    ) : 'Загрузить'}
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
                        className={MODAL_OVERLAY_CLASS}
                        onClick={() => setEditDialogOpen(false)}
                    />

                    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 pointer-events-none">
                        <div
                            className={MODAL_PANEL_CLASS}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="flex items-center justify-between border-b border-border/70 p-4">
                                <h2 className="text-xl font-semibold text-foreground">Настройки голоса "{currentVoice?.name}"</h2>
                                <button
                                    onClick={() => setEditDialogOpen(false)}
                                    className="text-muted-foreground transition-colors hover:text-foreground"
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
                                        <h4 className="text-sm font-medium text-foreground">Настройки генерации</h4>

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
                                            <div className={INFO_BOX_CLASS}>
                                                <strong>Стабильность:</strong> Влияет на стабильность и консистентность речи.
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
                                            <div className={INFO_BOX_CLASS}>
                                                <strong>Скорость:</strong> Подберите подходящий пресет. Сильно быстрый может обрывать конец фразы.
                                                Слишком медленный может тормозить речь. Начните с "Нормальный" и корректируйте по результату.
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className={DIALOG_FOOTER_CLASS}>
                                <Button
                                    onClick={handleTestVoice}
                                    variant="outline"
                                    disabled={isTestingVoice}
                                    className="h-9 w-32 overflow-hidden text-ellipsis whitespace-nowrap border-border/70 bg-background/60 text-foreground hover:bg-accent/70"
                                >
                                    {isTestingVoice ? (
                                        <>
                                            <Loader2 className="h-4 w-4 mr-2 animate-spin flex-shrink-0" />
                                            <span className="truncate">Тест...</span>
                                        </>
                                    ) : isPlaying ? (
                                        <>
                                            <Volume2 className="h-4 w-4 mr-2 flex-shrink-0" />
                                            <span className="truncate">Воспроизводится</span>
                                        </>
                                    ) : (
                                        <>
                                            <TestTube2 className="h-4 w-4 mr-2 flex-shrink-0" />
                                            <span className="truncate">Тест</span>
                                        </>
                                    )}
                                </Button>
                                <Button
                                    onClick={handleRenameVoice}
                                    variant="outline"
                                    className="h-9 w-32 overflow-hidden text-ellipsis whitespace-nowrap border-amber-500/50 text-amber-200 hover:bg-amber-500/15 hover:text-amber-100"
                                >
                                    <Edit className="h-4 w-4 mr-2 flex-shrink-0" />
                                    <span className="truncate">Переименовать</span>
                                </Button>
                                <Button
                                    onClick={handleSaveSettings}
                                    className="h-9 w-32 overflow-hidden text-ellipsis whitespace-nowrap bg-primary text-primary-foreground hover:bg-primary/90"
                                >
                                    <Settings className="h-4 w-4 mr-2 flex-shrink-0" />
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



