/**
 * Local TTS Voices Service - API calls to external tts_service_simple
 * 
 * These endpoints are on the user's local TTS server, not our backend.
 */
import axios, { AxiosError } from 'axios';

import { logger } from '@/shared/utils/prodLogger';

export interface LocalVoice {
    id: number;
    name: string;
    language: string;
    description?: string;
    samples_count?: number;
    created_at?: string;
}

export interface LocalVoicesResponse {
    success: boolean;
    voices: LocalVoice[];
}

export interface CreateVoiceData {
    name: string;
    language: string;
    description: string;
}

export interface UploadSampleResponse {
    success: boolean;
    message?: string;
    transcription?: string;
}

/**
 * Service for interacting with local TTS server voices API
 */
export const localVoicesService = {
    /**
     * Get list of voices from local TTS server
     */
    async listVoices(endpointUrl: string): Promise<LocalVoice[]> {
        try {
            const response = await axios.get<LocalVoicesResponse>(
                `${endpointUrl}/api/voices/list`
            );
            return response.data.voices || [];
        } catch (error) {
            logger.error('Error loading local voices:', error);
            throw error;
        }
    },

    /**
     * Create a new voice on local TTS server
     */
    async createVoice(endpointUrl: string, data: CreateVoiceData): Promise<LocalVoice> {
        const formData = new FormData();
        formData.append('name', data.name);
        formData.append('language', data.language);
        formData.append('description', data.description);

        const response = await axios.post<{ success: boolean; voice: LocalVoice }>(
            `${endpointUrl}/api/voices/create`,
            formData
        );
        return response.data.voice;
    },

    /**
     * Upload a sample for a voice
     */
    async uploadSample(
        endpointUrl: string,
        voiceId: number,
        file: File,
        sampleText?: string
    ): Promise<UploadSampleResponse> {
        const formData = new FormData();
        formData.append('file', file);
        if (sampleText) {
            formData.append('sample_text', sampleText);
        }

        const response = await axios.post<UploadSampleResponse>(
            `${endpointUrl}/api/voices/${voiceId}/upload`,
            formData
        );
        return response.data;
    },

    /**
     * Delete a voice from local TTS server
     */
    async deleteVoice(endpointUrl: string, voiceId: number): Promise<void> {
        await axios.delete(`${endpointUrl}/api/voices/${voiceId}`);
    },
};

export type { AxiosError };
