import React, { useEffect, useRef, useState } from 'react';

/* eslint-disable no-alert */
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, Edit, Globe, Loader2, Mic, RefreshCw, Settings, TestTube2, Trash2, Upload, User as UserIcon, Users, Volume2, X } from 'lucide-react';
import ReactDOM from 'react-dom';

import { useAuth } from '@/context/AuthContext';
import { ttsService } from '@/services/api/services';
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
import { resolveAudioUrl } from '@/shared/utils/urlUtils';

import type { TtsVoice } from '@/types/tts';

interface VoiceManagementUser {
    id: number;
    username: string;
}

type SpeedPreset = 'very_slow' | 'slow' | 'normal' | 'fast' | 'very_fast';
type OwnerType = 'global' | 'user';
type VoiceProvider = 'f5' | 'qwen';

interface ProviderCapability {
    provider?: string;
    voice_crud?: boolean;
    voice_admin?: boolean;
    voice_detail?: {
        message?: string;
        hint?: string;
    };
}

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

const extractApiErrorMessage = (error: unknown): string | null => {
    if (!error) return null;

    const typedError = error as {
        message?: string;
        response?: {
            data?: {
                detail?: string | { message?: string };
                message?: string;
                error?: string;
            };
        };
    };

    const detail = typedError.response?.data?.detail;
    if (typeof detail === 'string' && detail.trim()) {
        return detail;
    }
    if (detail && typeof detail === 'object' && typeof detail.message === 'string' && detail.message.trim()) {
        return detail.message;
    }
    if (typedError.response?.data?.message?.trim()) {
        return typedError.response.data.message;
    }
    if (typedError.response?.data?.error?.trim()) {
        return typedError.response.data.error;
    }
    if (typedError.message?.trim()) {
        return typedError.message;
    }
    return null;
};

interface TranscribeResponse {
    data: {
        reference_text: string;
    };
}

const SURFACE_CARD_CLASS = 'border-border/70 bg-card/80 shadow-[0_20px_60px_rgba(5,10,25,0.22)]';
const VOICE_CARD_CLASS = 'w-full max-w-[360px] border-border/70 bg-card/90 flex min-h-[180px] min-w-0 flex-col overflow-hidden rounded-2xl transition-all duration-200 hover:-translate-y-0.5';
const VOICE_GRID_CLASS = 'flex flex-wrap gap-4';
const EMPTY_STATE_CLASS = 'rounded-2xl border border-border/60 border-dashed bg-muted/20 py-10 text-center';
const MODAL_OVERLAY_CLASS = 'fixed inset-0 z-[9999] bg-black/65 backdrop-blur-[1px]';
const MODAL_PANEL_CLASS = 'pointer-events-auto flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-border/70 bg-background/95 shadow-2xl shadow-black/35';
const DIALOG_FOOTER_CLASS = 'flex flex-col gap-3 border-t border-border/70 bg-background/70 p-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end';
const DIALOG_ACTION_CLASS = 'h-10 w-full justify-center px-4 text-sm whitespace-nowrap sm:min-w-[148px] sm:flex-1';

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
    const previewAudioRef = useRef<HTMLAudioElement | null>(null);
    const queryClient = useQueryClient();

    const { user } = useAuth();
    const audioContext: AudioContext | null = null;
    const audioSource: AudioBufferSourceNode | null = null;
    // Note: audioContext and audioSource are declared but not used in this component
    // They are kept for potential future audio processing features
    void audioContext;
    void audioSource;

    const stopPreviewAudio = (): void => {
        const previewAudio = previewAudioRef.current;
        if (!previewAudio) {
            return;
        }

        previewAudioRef.current = null;
        previewAudio.onerror = null;
        previewAudio.onabort = null;
        previewAudio.onended = null;
        previewAudio.onpause = null;
        previewAudio.pause();
        previewAudio.src = '';
        setIsPlaying(false);
    };

    const { data: providerCapabilities = {} } = useQuery<Record<string, ProviderCapability>>({
        queryKey: ['voice-provider-capabilities'],
        queryFn: async (): Promise<Record<string, ProviderCapability>> => {
            const response = await ttsService.getProviderCapabilities();
            const payload = response.data as {
                providers?: Record<string, ProviderCapability>;
                data?: { providers?: Record<string, ProviderCapability> };
            };
            return payload.providers || payload.data?.providers || {};
        },
        staleTime: 60 * 1000,
        refetchOnWindowFocus: false,
    });

    const selectedProviderCapabilities = providerCapabilities[voiceProvider];
    const isAdminVoiceAvailable = selectedProviderCapabilities?.voice_admin !== false;
    const providerCapabilityMessage =
        selectedProviderCapabilities?.voice_detail?.message
        || (voiceProvider === 'qwen' ? 'Админское управление голосами Qwen недоступно в текущем окружении.' : null);
    const providerCapabilityHint = selectedProviderCapabilities?.voice_detail?.hint;

    // React Query: загружаем голоса для админа
    const { data: voicesData = [], isLoading: voicesLoading, error: voicesError } = useQuery<TtsVoice[]>({
        queryKey: ['admin-voices', voiceProvider, isAdminVoiceAvailable],
        queryFn: async (): Promise<TtsVoice[]> => {
            if (!isAdminVoiceAvailable) {
                setTtsServiceWarning(null);
                return [];
            }
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
        enabled: isAdminVoiceAvailable,
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
            const payload = response.data as {
                users?: VoiceManagementUser[];
                data?: VoiceManagementUser[] | { users?: VoiceManagementUser[] };
            };

            if (Array.isArray(payload.users)) {
                return payload.users;
            }

            if (Array.isArray(payload.data)) {
                return payload.data;
            }

            if (Array.isArray(payload.data?.users)) {
                return payload.data.users;
            }

            return [];
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
        if (!editDialogOpen) {
            stopPreviewAudio();
        }
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
        if (!isAdminVoiceAvailable) {
            addToast({
                type: 'warning',
                title: 'Недоступно',
                message: providerCapabilityMessage || 'Админское управление голосами недоступно для выбранного провайдера.',
            });
            return;
        }

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
        if (!isAdminVoiceAvailable) {
            addToast({
                type: 'warning',
                title: 'Недоступно',
                message: providerCapabilityMessage || 'Админское управление голосами недоступно для выбранного провайдера.',
            });
            return;
        }

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
        if (!isAdminVoiceAvailable) {
            addToast({
                type: 'warning',
                title: 'Недоступно',
                message: providerCapabilityMessage || 'Админское управление голосами недоступно для выбранного провайдера.',
            });
            return;
        }
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
        if (!isAdminVoiceAvailable) {
            addToast({
                type: 'warning',
                title: 'Недоступно',
                message: providerCapabilityMessage || 'Админское управление голосами недоступно для выбранного провайдера.',
            });
            return;
        }
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
        if (!isAdminVoiceAvailable) {
            addToast({
                type: 'warning',
                title: 'Недоступно',
                message: providerCapabilityMessage || 'Админское управление голосами недоступно для выбранного провайдера.',
            });
            return;
        }
        if (!currentVoice || !user) return;

        setIsTestingVoice(true);
        setIsPlaying(false);
        try {
            const response = await testVoice(currentVoice.id || 0, testText, voiceProvider);

            const audioResponse = response as AudioResponse;
            const audioUrl = audioResponse.data?.audio_url || audioResponse.audio_url;
            if (audioUrl) {
                stopPreviewAudio();

                const audio = new Audio(resolveAudioUrl(audioUrl));
                audio.preload = 'auto';
                previewAudioRef.current = audio;

                const failPlayback = (message: string, error?: unknown): void => {
                    if (error) {
                        logger.error('Play error:', error);
                    }
                    if (previewAudioRef.current === audio) {
                        previewAudioRef.current = null;
                    }
                    setIsTestingVoice(false);
                    setIsPlaying(false);
                    addToast({ type: 'error', title: 'Ошибка', message });
                };

                audio.onerror = () => {
                    if (previewAudioRef.current !== audio) {
                        return;
                    }
                    failPlayback('Не удалось загрузить аудио файл.');
                };

                audio.onabort = () => {
                    if (previewAudioRef.current === audio) {
                        previewAudioRef.current = null;
                    }
                    setIsTestingVoice(false);
                    setIsPlaying(false);
                };

                audio.onended = () => {
                    if (previewAudioRef.current === audio) {
                        previewAudioRef.current = null;
                    }
                    setIsPlaying(false);
                };

                audio.onpause = () => {
                    if (previewAudioRef.current !== audio) {
                        return;
                    }
                    if (!audio.ended) {
                        setIsPlaying(false);
                    }
                };

                try {
                    await audio.play();
                    setIsTestingVoice(false);
                    setIsPlaying(true);
                    addToast({ type: 'success', title: 'Успех', message: 'Аудио воспроизводится!' });
                } catch (playError) {
                    failPlayback('Не удалось воспроизвести аудио. Проверьте настройки браузера.', playError);
                }
            } else {
                logger.error('No audio URL in response:', response);
                setIsTestingVoice(false);
                addToast({ type: 'error', title: 'Ошибка', message: 'Не удалось получить аудио для воспроизведения.' });
            }
        } catch (error: unknown) {
            logger.error('Test voice error:', error);
            setIsTestingVoice(false);
            addToast({
                type: 'error',
                title: 'Ошибка',
                message: extractApiErrorMessage(error) || 'Не удалось протестировать голос.',
            });
        }
    };



    const handleRetranscribeVoice = async (): Promise<void> => {
        if (!isAdminVoiceAvailable) {
            addToast({
                type: 'warning',
                title: 'Недоступно',
                message: providerCapabilityMessage || 'Админское управление голосами недоступно для выбранного провайдера.',
            });
            return;
        }
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

    const parsedSelectedUserId = Number.parseInt(selectedUserFilter, 10);
    const userVoices = voices.filter((voice) =>
        voice.voice_type === 'user'
        && (selectedUserFilter === 'all' || voice.owner_id === parsedSelectedUserId)
        && (searchQuery === '' || voice.name.toLowerCase().includes(searchQuery.toLowerCase()))
    );
    const globalVoices = voices.filter((voice) =>
        voice.voice_type === 'global'
        && (searchQuery === '' || voice.name.toLowerCase().includes(searchQuery.toLowerCase()))
    );
    const totalUserVoices = voices.filter((voice) => voice.voice_type === 'user').length;
    const totalGlobalVoices = voices.filter((voice) => voice.voice_type === 'global').length;


    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div className="space-y-3">
                    <h2 className="flex items-center gap-2 text-2xl font-semibold text-foreground">
                        <Mic className="h-6 w-6 text-muted-foreground" />
                        Управление голосами
                    </h2>
                    <div className="flex flex-wrap gap-2">
                        <Badge variant="outline" className="border-border/70 px-3 py-1 text-sm text-foreground">
                            Всего: {voices.length}
                        </Badge>
                        <Badge variant="outline" className="border-emerald-500/30 px-3 py-1 text-sm text-emerald-200">
                            Пользовательские: {totalUserVoices}
                        </Badge>
                        <Badge variant="outline" className="border-sky-500/30 px-3 py-1 text-sm text-sky-200">
                            Глобальные: {totalGlobalVoices}
                        </Badge>
                    </div>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                    <div className="w-full sm:w-48">
                        <Label htmlFor="voiceProvider" className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Провайдер</Label>
                        <Select value={voiceProvider} onValueChange={(value) => setVoiceProvider(value as VoiceProvider)}>
                            <SelectTrigger id="voiceProvider" name="voiceProvider" className="mt-1 h-10 bg-background/70">
                                <SelectValue placeholder="Выберите провайдер" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="f5">F5 TTS</SelectItem>
                                <SelectItem value="qwen">Qwen 3 TTS</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <Button
                        className="h-10 bg-primary px-5 text-primary-foreground hover:bg-primary/90"
                        onClick={() => setUploadDialogOpen(true)}
                        disabled={!isAdminVoiceAvailable}
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
                            aria-label="Поиск по имени голоса"
                            name="voiceSearch"
                            placeholder="Поиск по имени голоса..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="max-w-xs"
                        />
                    </div>
                </CardHeader>
                <CardContent>
                    {!isAdminVoiceAvailable && (
                        <div className="mb-6 rounded-lg border border-sky-500/40 bg-sky-500/10 p-4">
                            <div className="flex items-start gap-3">
                                <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-sky-300" />
                                <div className="flex-1">
                                    <p className="mb-1 font-semibold text-sky-200">Операции с голосами недоступны</p>
                                    <p className="text-sm text-sky-100/90">
                                        {providerCapabilityMessage || 'Для выбранного провайдера недоступно админское управление голосами.'}
                                    </p>
                                    {providerCapabilityHint && (
                                        <p className="mt-2 text-xs text-sky-100/70">
                                            {providerCapabilityHint}
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                    {ttsServiceWarning && (
                        <div className="mb-6 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4">
                            <div className="flex items-start gap-3">
                                <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-300" />
                                <div className="flex-1">
                                    <p className="mb-1 font-semibold text-amber-200">TTS сервис недоступен</p>
                                    <p className="text-sm text-amber-100/90">{ttsServiceWarning}</p>
                                    <p className="mt-2 text-xs text-amber-100/70">
                                        Проверьте upstream-конфигурацию в `bot_service` и доступность выбранного провайдера/шлюза.
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
                                                {totalUserVoices}
                                            </Badge>
                                        </h3>
                                        {users.length > 0 && (
                                            <Select value={selectedUserFilter} onValueChange={setSelectedUserFilter}>
                                                <SelectTrigger className="w-52 bg-background/70">
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
                                    {userVoices.length === 0 ? (
                                            <div className={EMPTY_STATE_CLASS}>
                                                <Users className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                                                <p className="text-muted-foreground text-lg mb-2">
                                                    {selectedUserFilter !== 'all' ? 'У выбранного пользователя нет голосов' : 'Пользовательских голосов пока нет'}
                                                </p>
                                            </div>
                                        ) : (
                                            <div className={VOICE_GRID_CLASS}>
                                                {userVoices.map((voice) => (
                                                    <Card key={voice.id} className={`${VOICE_CARD_CLASS} hover:border-emerald-500/35`}>
                                                        <CardHeader className="pb-4">
                                                            <div className="flex items-center justify-between">
                                                                <CardTitle className="flex min-w-0 items-center gap-2 text-sm font-medium text-foreground">
                                                                    <Users className="h-4 w-4 flex-shrink-0 text-emerald-300" />
                                                                    <span className="min-w-0 break-words">{voice.name}</span>
                                                                </CardTitle>
                                                                <Badge variant="outline" className="border-emerald-500/30 text-[11px] text-emerald-200">
                                                                    user
                                                                </Badge>
                                                            </div>
                                                            <div className="mt-4 min-w-0 text-sm text-muted-foreground">
                                                                {(() => {
                                                                    const owner = users.find(u => u.id === voice.owner_id);
                                                                    return owner ? (
                                                                        <span className="flex min-w-0 items-center gap-1 break-words">
                                                                            <UserIcon className="h-3 w-3" />
                                                                            {owner.username || `User_${owner.id}`}
                                                                        </span>
                                                                    ) : (
                                                                        <span>Owner ID: {voice.owner_id}</span>
                                                                    );
                                                                })()}
                                                            </div>
                                                        </CardHeader>
                                                        <CardContent className="mt-auto flex flex-col justify-end pt-0">
                                                            <div className="flex flex-wrap gap-2 border-t border-border/60 pt-4">
                                                                <Button
                                                                    onClick={() => handleEdit(voice)}
                                                                    className="h-9 flex-1 border-border/70 bg-background/60 text-foreground hover:bg-accent/70"
                                                                    variant="outline"
                                                                    size="sm"
                                                                    disabled={!isAdminVoiceAvailable}
                                                                >
                                                                    <Settings className="h-4 w-4 mr-1" />
                                                                    Настроить
                                                                </Button>
                                                                <Button
                                                                    onClick={(e) => handleDelete(voice.id, e)}
                                                                    variant="destructive"
                                                                    size="sm"
                                                                    disabled={!isAdminVoiceAvailable}
                                                                >
                                                                    <Trash2 className="h-4 w-4" />
                                                                </Button>
                                                            </div>
                                                        </CardContent>
                                                    </Card>
                                                ))}
                                            </div>
                                        )}
                                </div>

                                <div className="border-t border-border/70"></div>

                                <div>
                                    <div className="flex items-center justify-between mb-4">
                                        <h3 className="flex items-center gap-2 text-lg font-semibold text-foreground">
                                            <Globe className="h-5 w-5 text-sky-300" />
                                            Глобальные голоса
                                            <Badge variant="outline" className="ml-2 border-sky-500/40 text-sky-200">
                                                {totalGlobalVoices}
                                            </Badge>
                                        </h3>
                                    </div>
                                    {globalVoices.length === 0 ? (
                                            <div className={EMPTY_STATE_CLASS}>
                                                <Globe className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                                                <p className="text-muted-foreground text-lg mb-2">Глобальных голосов пока нет</p>
                                            </div>
                                        ) : (
                                            <div className={VOICE_GRID_CLASS}>
                                                {globalVoices.map((voice) => (
                                                    <Card key={voice.id} className={`${VOICE_CARD_CLASS} hover:border-sky-500/40`}>
                                                        <CardHeader className="pb-4">
                                                            <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-start sm:justify-between">
                                                                <CardTitle className="flex min-w-0 items-center gap-2 text-sm font-medium text-foreground">
                                                                    <Globe className="h-4 w-4 flex-shrink-0 text-sky-300" />
                                                                    <span className="min-w-0 break-words">{voice.name}</span>
                                                                </CardTitle>
                                                                <Badge variant="outline" className="w-fit shrink-0 border-sky-500/40 text-xs text-sky-200">
                                                                    Глобальный
                                                                </Badge>
                                                            </div>
                                                            <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
                                                                <span className="inline-flex h-2.5 w-2.5 rounded-full bg-sky-400" />
                                                                Общий голос для всех пользователей
                                                            </div>
                                                        </CardHeader>
                                                        <CardContent className="mt-auto flex flex-col justify-end pt-0">
                                                            <div className="flex flex-wrap gap-2 border-t border-border/60 pt-4">
                                                                <Button
                                                                    onClick={() => handleEdit(voice)}
                                                                    className="h-9 flex-1 border-border/70 bg-background/60 text-foreground hover:bg-accent/70"
                                                                    variant="outline"
                                                                    size="sm"
                                                                    disabled={!isAdminVoiceAvailable}
                                                                >
                                                                    <Settings className="h-4 w-4 mr-1" />
                                                                    Настроить
                                                                </Button>
                                                                <Button
                                                                    onClick={(e) => handleDelete(voice.id, e)}
                                                                    variant="destructive"
                                                                    size="sm"
                                                                    title="Удалить глобальный голос"
                                                                    disabled={!isAdminVoiceAvailable}
                                                                >
                                                                    <Trash2 className="h-4 w-4" />
                                                                </Button>
                                                            </div>
                                                        </CardContent>
                                                    </Card>
                                                ))}
                                            </div>
                                        )}
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
                                <h2 className="text-xl font-semibold text-foreground">Загрузка нового голоса</h2>
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
                                                name="file"
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
                                            name="voiceName"
                                            value={voiceName}
                                            onChange={(e) => setVoiceName(e.target.value)}
                                            placeholder="Например, narrator_ru"
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
                                            <SelectTrigger id="ownerType" name="ownerType" className="mt-1">
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
                                                <SelectTrigger id="selectedUserId" name="selectedUserId" className="mt-1">
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
                                            className={`${DIALOG_ACTION_CLASS} border-border/70 bg-background/60 text-foreground hover:bg-accent/70`}
                                        >
                                            Отмена
                                        </Button>
                                        <Button
                                            onClick={(e) => handleUpload(e)}
                                            disabled={!isAdminVoiceAvailable || isUploading || !uploadFile || !voiceName.trim() || (ownerId === 'user' && !selectedUserId)}
                                            className={`${DIALOG_ACTION_CLASS} bg-primary text-primary-foreground hover:bg-primary/90`}
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
                                            <Label htmlFor="reference-text">Референсный текст</Label>
                                            <Textarea
                                                id="reference-text"
                                                name="reference_text"
                                                value={currentVoice?.reference_text || ''}
                                                onChange={(e) => handleReferenceTextChange(e.target.value)}
                                                placeholder="Введите текст для транскрипции..."
                                                className="mt-1 w-full"
                                                rows={3}
                                            />
                                            <div className="w-full mt-2">
                                                <Button
                                                    onClick={handleRetranscribeVoice}
                                                    disabled={!isAdminVoiceAvailable || isTranscribing || !currentVoice?.reference_text?.trim()}
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
                                        </div>
                                    </div>

                                    <div>
                                        <Label htmlFor="test-text">Текст для тестирования</Label>
                                        <Textarea
                                            id="test-text"
                                            name="test_text"
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
                                            <div className="text-sm font-medium text-foreground">Стабильность синтеза: {testCfgStrength}</div>
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
                                        </div>

                                        <div>
                                            <div className="text-sm font-medium text-foreground">Скорость речи: {
                                                testSpeedPreset === 'very_slow' ? 'Очень медленный' :
                                                    testSpeedPreset === 'slow' ? 'Медленный' :
                                                        testSpeedPreset === 'normal' ? 'Нормальный' :
                                                            testSpeedPreset === 'fast' ? 'Быстрый' : 'Очень быстрый'
                                            }</div>
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
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className={DIALOG_FOOTER_CLASS}>
                                <Button
                                    onClick={handleTestVoice}
                                    variant="outline"
                                    disabled={!isAdminVoiceAvailable || isTestingVoice}
                                    className={`${DIALOG_ACTION_CLASS} border-border/70 bg-background/60 text-foreground hover:bg-accent/70`}
                                >
                                    {isTestingVoice ? (
                                        <>
                                            <Loader2 className="h-4 w-4 mr-2 animate-spin flex-shrink-0" />
                                            <span>Тест...</span>
                                        </>
                                    ) : isPlaying ? (
                                        <>
                                            <Volume2 className="h-4 w-4 mr-2 flex-shrink-0" />
                                            <span>Воспроизводится</span>
                                        </>
                                    ) : (
                                        <>
                                            <TestTube2 className="h-4 w-4 mr-2 flex-shrink-0" />
                                            <span>Тест</span>
                                        </>
                                    )}
                                </Button>
                                <Button
                                    onClick={handleRenameVoice}
                                    variant="outline"
                                    disabled={!isAdminVoiceAvailable}
                                    className={`${DIALOG_ACTION_CLASS} border-amber-500/50 text-amber-200 hover:bg-amber-500/15 hover:text-amber-100`}
                                >
                                    <Edit className="h-4 w-4 mr-2 flex-shrink-0" />
                                    <span>Переименовать</span>
                                </Button>
                                <Button
                                    onClick={handleSaveSettings}
                                    disabled={!isAdminVoiceAvailable}
                                    className={`${DIALOG_ACTION_CLASS} bg-primary text-primary-foreground hover:bg-primary/90`}
                                >
                                    <Settings className="h-4 w-4 mr-2 flex-shrink-0" />
                                    <span>Сохранить</span>
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



