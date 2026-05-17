import React, { useEffect, useRef, useState } from 'react';

import { useQuery, useQueryClient } from '@tanstack/react-query';

import VoiceCollections from '@/features/admin/components/voice-management/VoiceCollections';
import VoiceEditDialog from '@/features/admin/components/voice-management/VoiceEditDialog';
import VoiceManagementHeader from '@/features/admin/components/voice-management/VoiceManagementHeader';
import VoiceUploadDialog from '@/features/admin/components/voice-management/VoiceUploadDialog';
import VoiceDeleteDialog from '@/features/admin/components/VoiceDeleteDialog';
import { extractApiErrorMessage, parseAdminVoicesResponse } from '@/features/admin/utils/voiceManagementUtils';
import { ttsService } from '@/services/api/services';
import {
    deleteVoice,
    getAdminVoices,
    getUsers,
    renameVoice,
    retranscribeVoice,
    testVoice,
    updateVoiceSettings,
    uploadVoice,
} from '@/services/unified-api';
import { useToast } from '@/shared/components/ui/toast';
import { logger } from '@/shared/utils/prodLogger';
import { resolveAudioUrl } from '@/shared/utils/urlUtils';

import type {
    OwnerType,
    ProviderCapability,
    SpeedPreset,
    VoiceManagementUser,
    VoiceProvider,
} from '@/features/admin/types/voiceManagement';
import type { TtsVoice } from '@/types/tts';

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

const VoiceManagement: React.FC = () => {
    const { addToast } = useToast();
    const [loading, setLoading] = useState<boolean>(true);
    const [uploadDialogOpen, setUploadDialogOpen] = useState<boolean>(false);
    const [testText, setTestText] = useState<string>(
        'Привет, я бы хотел с тобой постримить, если честно, для меня бы это было честью. Постримить с таким великим стримером было бы реально круто.'
    );
    const [editDialogOpen, setEditDialogOpen] = useState<boolean>(false);

    const [currentVoice, setCurrentVoice] = useState<TtsVoice | null>(null);
    const [originalVoiceName, setOriginalVoiceName] = useState<string>('');
    const [voiceToDelete, setVoiceToDelete] = useState<TtsVoice | null>(null);
    const [isDeletingVoice, setIsDeletingVoice] = useState<boolean>(false);

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
    const providerCapabilityMessage = selectedProviderCapabilities?.voice_detail?.message || null;
    const providerCapabilityHint = selectedProviderCapabilities?.voice_detail?.hint;

    // React Query: загружаем голоса для админа
    const {
        data: voicesData = [],
        isLoading: voicesLoading,
        error: voicesError,
    } = useQuery<TtsVoice[]>({
        queryKey: ['admin-voices', voiceProvider, isAdminVoiceAvailable],
        queryFn: async (): Promise<TtsVoice[]> => {
            if (!isAdminVoiceAvailable) {
                setTtsServiceWarning(null);
                return [];
            }
            const response = await getAdminVoices(voiceProvider);
            const parsed = parseAdminVoicesResponse(response);
            setTtsServiceWarning(parsed.warning);
            return parsed.voices;
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
            const error = voicesError as {
                message?: string;
                code?: string;
                response?: { status?: number; data?: { detail?: string } };
            };

            if (
                error.message?.includes('connection') ||
                error.message?.includes('timeout') ||
                error.code === 'ECONNREFUSED'
            ) {
                setTtsServiceWarning(`Ошибка подключения к TTS сервису: ${error.message || 'Сервис недоступен'}`);
            } else if (error.response?.status === 500 && error.response?.data?.detail?.includes('connection')) {
                setTtsServiceWarning(error.response.data.detail);
            }
        }
    }, [voicesError]);

    // React Query: загружаем пользователей
    const {
        data: usersData = [],
        isLoading: usersLoadingQuery,
        error: usersError,
    } = useQuery<VoiceManagementUser[]>({
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
            addToast({
                type: 'error',
                title: 'Ошибка',
                message: `Не удалось загрузить пользователей: ${error.message || 'Неизвестная ошибка'}`,
            });
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
                message: `Неподдерживаемый формат файла. Поддерживаемые форматы: ${supportedFormats.join(', ')}`,
            });
            event.target.value = '';
            return;
        }

        setUploadFile(file);
        const nameWithoutExt = file.name.replace(/\.[^/.]+$/, '');
        setVoiceName(nameWithoutExt);
    };

    const handleUpload = async (): Promise<void> => {
        if (!isAdminVoiceAvailable) {
            addToast({
                type: 'warning',
                title: 'Недоступно',
                message:
                    providerCapabilityMessage || 'Админское управление голосами недоступно для выбранного провайдера.',
            });
            return;
        }

        if (!uploadFile || !voiceName.trim()) {
            addToast({ type: 'error', title: 'Ошибка', message: 'Выберите файл и введите имя голоса.' });
            return;
        }

        if (ownerId === 'user' && !selectedUserId) {
            addToast({
                type: 'error',
                title: 'Ошибка',
                message: 'Выберите пользователя для пользовательского голоса.',
            });
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

            const message =
                ownerId === 'global'
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

    const handleDelete = (voiceId: number): void => {
        if (!isAdminVoiceAvailable) {
            addToast({
                type: 'warning',
                title: 'Недоступно',
                message:
                    providerCapabilityMessage || 'Админское управление голосами недоступно для выбранного провайдера.',
            });
            return;
        }

        const voiceToDelete = voices.find((v) => v.id === voiceId);
        if (!voiceToDelete) {
            return;
        }

        setVoiceToDelete(voiceToDelete);
    };

    const confirmDeleteVoice = async (): Promise<void> => {
        if (!voiceToDelete) {
            return;
        }

        try {
            setIsDeletingVoice(true);
            await deleteVoice(voiceToDelete.id, voiceProvider);
            addToast({ type: 'success', title: 'Успех', message: `Голос "${voiceToDelete.name}" удален.` });
            queryClient.invalidateQueries({ queryKey: ['admin-voices', voiceProvider] });
            setVoiceToDelete(null);
        } catch (error: unknown) {
            const err = error as { message?: string };
            addToast({ type: 'error', title: 'Ошибка', message: err.message || 'Не удалось удалить голос.' });
        } finally {
            setIsDeletingVoice(false);
        }
    };

    const handleEdit = (voice: TtsVoice): void => {
        setCurrentVoice({ ...voice });
        setOriginalVoiceName(voice.name);
        setTestCfgStrength(voice.cfg_strength || 2.5);
        setTestSpeedPreset((voice.speed_preset as SpeedPreset) || 'normal');
        setEditDialogOpen(true);
    };

    const handleReferenceTextChange = (value: string): void => {
        setCurrentVoice((prev) => (prev ? { ...prev, reference_text: value } : null));
    };

    const handleRenameVoice = async (): Promise<void> => {
        if (!isAdminVoiceAvailable) {
            addToast({
                type: 'warning',
                title: 'Недоступно',
                message:
                    providerCapabilityMessage || 'Админское управление голосами недоступно для выбранного провайдера.',
            });
            return;
        }
        if (!currentVoice) return;

        const newName = currentVoice.name?.trim() || '';
        if (!newName || newName === originalVoiceName) {
            addToast({ type: 'warning', title: 'Без изменений', message: 'Введите новое имя перед сохранением.' });
            return;
        }

        try {
            await renameVoice(currentVoice.id, newName, voiceProvider);

            queryClient.setQueryData(['admin-voices', voiceProvider], (prev: TtsVoice[] = []) =>
                prev.map((voice) => (voice.id === currentVoice.id ? { ...voice, name: newName } : voice))
            );

            setCurrentVoice((prev) => (prev ? { ...prev, name: newName } : null));
            setOriginalVoiceName(newName);

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
                message:
                    providerCapabilityMessage || 'Админское управление голосами недоступно для выбранного провайдера.',
            });
            return;
        }
        if (!currentVoice) return;

        try {
            const settings = {
                cfg_strength: testCfgStrength,
                speed_preset: testSpeedPreset,
                reference_text: currentVoice.reference_text,
            };

            await updateVoiceSettings(currentVoice.id, settings, voiceProvider);

            queryClient.setQueryData(['admin-voices', voiceProvider], (prev: TtsVoice[] = []) =>
                prev.map((voice) => (voice.id === currentVoice.id ? { ...voice, ...settings } : voice))
            );

            setCurrentVoice((prev) => (prev ? { ...prev, ...settings } : null));

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
                message:
                    providerCapabilityMessage || 'Админское управление голосами недоступно для выбранного провайдера.',
            });
            return;
        }
        if (!currentVoice) return;

        setIsTestingVoice(true);
        setIsPlaying(false);
        try {
            const response = await testVoice(
                currentVoice.id || 0,
                testText,
                voiceProvider,
                voiceProvider === 'f5'
                    ? {
                          cfg_strength: testCfgStrength,
                          speed_preset: testSpeedPreset,
                      }
                    : undefined
            );

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
                message:
                    providerCapabilityMessage || 'Админское управление голосами недоступно для выбранного провайдера.',
            });
            return;
        }
        if (!currentVoice) return;

        setIsTranscribing(true);
        try {
            const response = await retranscribeVoice(currentVoice.id, voiceProvider);
            const transcribeResponse = response as unknown as TranscribeResponse;

            setCurrentVoice((prev) =>
                prev ? { ...prev, reference_text: transcribeResponse.data.reference_text } : null
            );

            queryClient.setQueryData(['admin-voices', voiceProvider], (prev: TtsVoice[] = []) =>
                prev.map((voice) =>
                    voice.id === currentVoice.id
                        ? { ...voice, reference_text: transcribeResponse.data.reference_text }
                        : voice
                )
            );

            addToast({ type: 'success', title: 'Успех', message: 'Перетранскрипция завершена успешно!' });
        } catch (error) {
            logger.error('Error retranscribing voice:', error);
            addToast({ type: 'error', title: 'Ошибка', message: 'Не удалось выполнить перетранскрипцию аудио.' });
        } finally {
            setIsTranscribing(false);
        }
    };

    const parsedSelectedUserId = Number.parseInt(selectedUserFilter, 10);
    const userVoices = voices.filter(
        (voice) =>
            voice.voice_type === 'user' &&
            (selectedUserFilter === 'all' || voice.owner_id === parsedSelectedUserId) &&
            (searchQuery === '' || voice.name.toLowerCase().includes(searchQuery.toLowerCase()))
    );
    const globalVoices = voices.filter(
        (voice) =>
            voice.voice_type === 'global' &&
            (searchQuery === '' || voice.name.toLowerCase().includes(searchQuery.toLowerCase()))
    );
    const totalUserVoices = voices.filter((voice) => voice.voice_type === 'user').length;
    const totalGlobalVoices = voices.filter((voice) => voice.voice_type === 'global').length;

    const handleVoiceDialogChange = (voice: TtsVoice | null): void => {
        setCurrentVoice(voice);
    };

    const handleCfgStrengthChange = (value: number): void => {
        setTestCfgStrength(value);
        setCurrentVoice((prev) => (prev ? { ...prev, cfg_strength: value } : null));
    };

    const handleSpeedPresetChange = (preset: SpeedPreset): void => {
        setTestSpeedPreset(preset);
        setCurrentVoice((prev) => (prev ? { ...prev, speed_preset: preset } : null));
    };

    return (
        <div className="space-y-6">
            <VoiceManagementHeader
                totalVoices={voices.length}
                totalUserVoices={totalUserVoices}
                totalGlobalVoices={totalGlobalVoices}
                voiceProvider={voiceProvider}
                isAdminVoiceAvailable={isAdminVoiceAvailable}
                onVoiceProviderChange={setVoiceProvider}
                onOpenUpload={() => setUploadDialogOpen(true)}
            />
            <VoiceCollections
                loading={loading}
                voices={voices}
                users={users}
                searchQuery={searchQuery}
                selectedUserFilter={selectedUserFilter}
                totalUserVoices={totalUserVoices}
                totalGlobalVoices={totalGlobalVoices}
                userVoices={userVoices}
                globalVoices={globalVoices}
                isAdminVoiceAvailable={isAdminVoiceAvailable}
                providerCapabilityMessage={providerCapabilityMessage}
                providerCapabilityHint={providerCapabilityHint}
                ttsServiceWarning={ttsServiceWarning}
                onSearchChange={setSearchQuery}
                onUserFilterChange={setSelectedUserFilter}
                onRefreshVoices={() => queryClient.invalidateQueries({ queryKey: ['admin-voices', voiceProvider] })}
                onEdit={handleEdit}
                onDelete={handleDelete}
            />
            <VoiceUploadDialog
                open={uploadDialogOpen}
                uploadFile={uploadFile}
                voiceName={voiceName}
                ownerId={ownerId}
                selectedUserId={selectedUserId}
                users={users}
                usersLoading={usersLoadingQuery}
                isUploading={isUploading}
                isAdminVoiceAvailable={isAdminVoiceAvailable}
                onClose={() => setUploadDialogOpen(false)}
                onFileChange={handleFileUpload}
                onVoiceNameChange={setVoiceName}
                onOwnerChange={(value) => {
                    setOwnerId(value);
                    if (value === 'global') {
                        setSelectedUserId('');
                    }
                }}
                onUserChange={setSelectedUserId}
                onUsersOpen={() => queryClient.invalidateQueries({ queryKey: ['admin-voice-users'] })}
                onUpload={() => void handleUpload()}
            />
            <VoiceEditDialog
                open={editDialogOpen}
                currentVoice={currentVoice}
                voiceProvider={voiceProvider}
                testText={testText}
                testCfgStrength={testCfgStrength}
                testSpeedPreset={testSpeedPreset}
                isAdminVoiceAvailable={isAdminVoiceAvailable}
                isTranscribing={isTranscribing}
                isTestingVoice={isTestingVoice}
                isPlaying={isPlaying}
                onClose={() => setEditDialogOpen(false)}
                onVoiceChange={handleVoiceDialogChange}
                onTestTextChange={setTestText}
                onCfgStrengthChange={handleCfgStrengthChange}
                onSpeedPresetChange={handleSpeedPresetChange}
                onReferenceTextChange={handleReferenceTextChange}
                onRetranscribe={() => void handleRetranscribeVoice()}
                onTest={() => void handleTestVoice()}
                onRename={() => void handleRenameVoice()}
                onSave={() => void handleSaveSettings()}
            />
            <VoiceDeleteDialog
                voice={voiceToDelete}
                isDeleting={isDeletingVoice}
                onClose={() => setVoiceToDelete(null)}
                onConfirm={() => void confirmDeleteVoice()}
            />
        </div>
    );
};

export default VoiceManagement;
