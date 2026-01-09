/**
 * Local TTS Voices Queries - TanStack Query hooks for tts_service_simple
 * 
 * These hooks manage voices on the user's LOCAL TTS server (external endpoint).
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { type CreateVoiceData, type LocalVoice, localVoicesService } from '@/services/api/services/localVoicesService';
import { logger } from '@/shared/utils/prodLogger';

import type { AxiosError } from 'axios';

// Query keys for local voices (separate from main TTS)
export const localVoicesKeys = {
    all: ['local-voices'] as const,
    list: (endpointUrl: string) => [...localVoicesKeys.all, 'list', endpointUrl] as const,
};

/**
 * Query hook to fetch voices from local TTS server
 */
export const useLocalVoicesQuery = (endpointUrl: string | undefined) => {
    return useQuery<LocalVoice[], AxiosError>({
        queryKey: localVoicesKeys.list(endpointUrl || ''),
        queryFn: () => localVoicesService.listVoices(endpointUrl!),
        enabled: !!endpointUrl,
        staleTime: 30 * 1000, // 30 seconds
        gcTime: 5 * 60 * 1000, // 5 minutes
        retry: 1,
    });
};

/**
 * Mutation hook to create a new voice
 */
export const useCreateVoiceMutation = (endpointUrl: string | undefined) => {
    const queryClient = useQueryClient();

    return useMutation<LocalVoice, AxiosError<{ detail?: string }>, CreateVoiceData>({
        mutationFn: (data) => localVoicesService.createVoice(endpointUrl!, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: localVoicesKeys.list(endpointUrl || '') });
            toast.success('[OK] Голос создан! Загрузите референсный аудио.');
        },
        onError: (error) => {
            logger.error('Error creating voice:', error);
            toast.error(error.response?.data?.detail || 'Ошибка создания голоса');
        },
    });
};

/**
 * Mutation hook to upload a voice sample
 */
export const useUploadSampleMutation = (endpointUrl: string | undefined) => {
    const queryClient = useQueryClient();

    return useMutation<
        { success: boolean; transcription?: string },
        AxiosError<{ detail?: string }>,
        { voiceId: number; file: File; sampleText?: string }
    >({
        mutationFn: ({ voiceId, file, sampleText }) =>
            localVoicesService.uploadSample(endpointUrl!, voiceId, file, sampleText),
        onSuccess: (response) => {
            queryClient.invalidateQueries({ queryKey: localVoicesKeys.list(endpointUrl || '') });
            toast.success(
                response.transcription
                    ? '[OK] Сэмпл загружен и транскрибирован'
                    : '[OK] Сэмпл загружен'
            );
        },
        onError: (error) => {
            logger.error('Error uploading sample:', error);
            toast.error(error.response?.data?.detail || 'Ошибка загрузки сэмпла');
        },
    });
};

/**
 * Mutation hook to delete a voice
 */
export const useDeleteVoiceMutation = (endpointUrl: string | undefined) => {
    const queryClient = useQueryClient();

    return useMutation<void, AxiosError, number>({
        mutationFn: (voiceId) => localVoicesService.deleteVoice(endpointUrl!, voiceId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: localVoicesKeys.list(endpointUrl || '') });
            toast.success('[DELETE] Голос удален');
        },
        onError: (error) => {
            logger.error('Error deleting voice:', error);
            toast.error('Ошибка удаления голоса');
        },
    });
};
