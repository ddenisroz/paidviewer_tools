/**
 * Local TTS Voices Queries - TanStack Query hooks for provider-specific local TTS endpoints.
 */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { type CreateVoiceData, type LocalVoice, localVoicesService } from '@/services/api/services/localVoicesService';
import { logger } from '@/shared/utils/prodLogger';

import type { AxiosError } from 'axios';

export type LocalTtsProvider = 'f5' | 'qwen';

// Query keys for local voices (separate from main TTS)
export const localVoicesKeys = {
    all: ['local-voices'] as const,
    list: (provider: LocalTtsProvider, endpointUrl: string) => [...localVoicesKeys.all, provider, 'list', endpointUrl] as const,
};

/**
 * Query hook to fetch voices from local TTS server
 */
export const useLocalVoicesQuery = (provider: LocalTtsProvider, endpointUrl: string | undefined) => {
    return useQuery<LocalVoice[], AxiosError>({
        queryKey: localVoicesKeys.list(provider, endpointUrl || ''),
        queryFn: () => localVoicesService.listVoices(endpointUrl!),
        enabled: !!endpointUrl,
        staleTime: 30 * 1000,
        gcTime: 5 * 60 * 1000,
        retry: 1,
    });
};

/**
 * Mutation hook to create a new voice
 */
export const useCreateVoiceMutation = (provider: LocalTtsProvider, endpointUrl: string | undefined) => {
    const queryClient = useQueryClient();

    return useMutation<LocalVoice, AxiosError<{ detail?: string }>, CreateVoiceData>({
        mutationFn: (data) => localVoicesService.createVoice(endpointUrl!, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: localVoicesKeys.list(provider, endpointUrl || '') });
            toast.success('Voice created. Upload a sample to continue.');
        },
        onError: (error) => {
            logger.error('Error creating voice:', error);
            toast.error(error.response?.data?.detail || 'Failed to create voice');
        },
    });
};

/**
 * Mutation hook to upload a voice sample
 */
export const useUploadSampleMutation = (provider: LocalTtsProvider, endpointUrl: string | undefined) => {
    const queryClient = useQueryClient();

    return useMutation<
        { success: boolean; transcription?: string },
        AxiosError<{ detail?: string }>,
        { voiceId: number; file: File; sampleText?: string }
    >({
        mutationFn: ({ voiceId, file, sampleText }) =>
            localVoicesService.uploadSample(endpointUrl!, voiceId, file, sampleText),
        onSuccess: (response) => {
            queryClient.invalidateQueries({ queryKey: localVoicesKeys.list(provider, endpointUrl || '') });
            toast.success(response.transcription ? 'Sample uploaded and transcribed' : 'Sample uploaded');
        },
        onError: (error) => {
            logger.error('Error uploading sample:', error);
            toast.error(error.response?.data?.detail || 'Failed to upload sample');
        },
    });
};

/**
 * Mutation hook to delete a voice
 */
export const useDeleteVoiceMutation = (provider: LocalTtsProvider, endpointUrl: string | undefined) => {
    const queryClient = useQueryClient();

    return useMutation<void, AxiosError, number>({
        mutationFn: (voiceId) => localVoicesService.deleteVoice(endpointUrl!, voiceId),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: localVoicesKeys.list(provider, endpointUrl || '') });
            toast.success('Voice deleted');
        },
        onError: (error) => {
            logger.error('Error deleting voice:', error);
            toast.error('Failed to delete voice');
        },
    });
};
