export interface VoiceManagementUser {
    id: number;
    username: string;
}

export type SpeedPreset = 'very_slow' | 'slow' | 'normal' | 'fast' | 'very_fast';
export type OwnerType = 'global' | 'user';
export type VoiceProvider = 'f5';

export interface ProviderCapability {
    provider?: string;
    voice_crud?: boolean;
    voice_admin?: boolean;
    voice_detail?: {
        message?: string;
        hint?: string;
    };
}
