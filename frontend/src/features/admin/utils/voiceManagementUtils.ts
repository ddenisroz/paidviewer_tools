import { logger } from '@/shared/utils/prodLogger';

import type { TtsVoice } from '@/types/tts';

type ApiErrorDetail = string | { message?: string } | undefined;

interface ApiErrorData {
    detail?: ApiErrorDetail;
    message?: string;
    error?: string;
}

interface ApiErrorShape {
    message?: string;
    response?: {
        data?: ApiErrorData;
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

const trimmedString = (value: unknown): string | null => (typeof value === 'string' && value.trim() ? value : null);

const extractDetailMessage = (detail: ApiErrorDetail): string | null => {
    const directMessage = trimmedString(detail);
    if (directMessage) {
        return directMessage;
    }

    if (detail && typeof detail === 'object') {
        return trimmedString(detail.message);
    }

    return null;
};

const extractResponseMessage = (data?: ApiErrorData): string | null => {
    if (!data) {
        return null;
    }

    return extractDetailMessage(data.detail) ?? trimmedString(data.message) ?? trimmedString(data.error);
};

export const extractApiErrorMessage = (error: unknown): string | null => {
    const typedError = error as ApiErrorShape;
    return extractResponseMessage(typedError.response?.data) ?? trimmedString(typedError.message);
};

const mergeVoiceLists = (globalVoices?: TtsVoice[], userVoices?: TtsVoice[]): TtsVoice[] => [
    ...(globalVoices ?? []),
    ...(userVoices ?? []),
];

const extractVoicesArray = (payload: unknown): TtsVoice[] => {
    if (Array.isArray(payload)) return payload as TtsVoice[];

    const data = payload as {
        status?: string;
        success?: boolean;
        voices?: TtsVoice[] | VoicesResponse;
        data?: TtsVoice[];
        global_voices?: TtsVoice[];
        user_voices?: TtsVoice[];
    };

    if (Array.isArray(data.voices)) return data.voices;
    if (Array.isArray(data.data)) return data.data;
    if (data.success && data.voices && typeof data.voices === 'object')
        return mergeVoiceLists(data.voices.global_voices, data.voices.user_voices);
    if (data.status === 'success') return [];
    if (Array.isArray(data.global_voices) || Array.isArray(data.user_voices))
        return mergeVoiceLists(data.global_voices, data.user_voices);

    return [];
};

export const parseAdminVoicesResponse = (response: unknown): { voices: TtsVoice[]; warning: string | null } => {
    const apiResponse = response as ApiResponse;
    const data = apiResponse?.data ?? response;
    const warning = (data as { warning?: string })?.warning ?? null;
    const voices = extractVoicesArray(data);

    logger.log('[ADMIN][VOICES] parsed', { count: voices.length, warning });
    return { voices, warning };
};
