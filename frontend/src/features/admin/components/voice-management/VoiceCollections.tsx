import React from 'react';

import { Badge } from '@/shared/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Input } from '@/shared/components/ui/input';
import { PageLoader } from '@/shared/components/ui/loader';

import GlobalVoicesSection from './GlobalVoicesSection';
import UserVoicesSection from './UserVoicesSection';
import { WarningBanner } from './VoiceCollectionsParts';

import type { VoiceManagementUser } from '@/features/admin/types/voiceManagement';
import type { TtsVoice } from '@/types/tts';

interface VoiceCollectionsProps {
    loading: boolean;
    voices: TtsVoice[];
    users: VoiceManagementUser[];
    searchQuery: string;
    selectedUserFilter: string;
    totalUserVoices: number;
    totalGlobalVoices: number;
    userVoices: TtsVoice[];
    globalVoices: TtsVoice[];
    isAdminVoiceAvailable: boolean;
    providerCapabilityMessage: string | null;
    providerCapabilityHint?: string;
    ttsServiceWarning: string | null;
    onSearchChange: (value: string) => void;
    onUserFilterChange: (value: string) => void;
    onRefreshVoices: () => void;
    onEdit: (voice: TtsVoice) => void;
    onDelete: (voiceId: number) => void;
}

const SURFACE_CARD_CLASS = 'border-border/70 bg-card/80 shadow-[0_20px_60px_rgba(5,10,25,0.22)]';

const VoiceCollections: React.FC<VoiceCollectionsProps> = ({
    loading,
    voices,
    users,
    searchQuery,
    selectedUserFilter,
    totalUserVoices,
    totalGlobalVoices,
    userVoices,
    globalVoices,
    isAdminVoiceAvailable,
    providerCapabilityMessage,
    providerCapabilityHint,
    ttsServiceWarning,
    onSearchChange,
    onUserFilterChange,
    onRefreshVoices,
    onEdit,
    onDelete,
}) => (
    <Card className={SURFACE_CARD_CLASS}>
        <CardHeader className="space-y-4">
            <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold text-foreground">Голоса</CardTitle>
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
                    onChange={(event) => onSearchChange(event.target.value)}
                    className="max-w-xs"
                />
            </div>
        </CardHeader>

        <CardContent>
            {!isAdminVoiceAvailable ? (
                <WarningBanner
                    title="Загрузка и управление недоступны"
                    tone="border-sky-500/40 bg-sky-500/10 text-sky-100/90"
                    message={
                        providerCapabilityMessage ||
                        'Для выбранного провайдера управление голосами временно недоступно.'
                    }
                    hint={providerCapabilityHint}
                />
            ) : null}

            {ttsServiceWarning ? (
                <WarningBanner
                    title="TTS сервис недоступен"
                    tone="border-amber-500/40 bg-amber-500/10 text-amber-100/90"
                    message={ttsServiceWarning}
                    hint="Проверьте upstream-подключение в bot_service и доступность выбранного провайдера."
                    onRefresh={onRefreshVoices}
                />
            ) : null}

            <div className="space-y-8">
                {loading ? (
                    <PageLoader message="Загрузка голосов..." />
                ) : (
                    <>
                        <UserVoicesSection
                            users={users}
                            selectedUserFilter={selectedUserFilter}
                            totalUserVoices={totalUserVoices}
                            userVoices={userVoices}
                            isAdminVoiceAvailable={isAdminVoiceAvailable}
                            onUserFilterChange={onUserFilterChange}
                            onEdit={onEdit}
                            onDelete={onDelete}
                        />

                        <div className="border-t border-border/70" />

                        <GlobalVoicesSection
                            totalGlobalVoices={totalGlobalVoices}
                            globalVoices={globalVoices}
                            isAdminVoiceAvailable={isAdminVoiceAvailable}
                            onEdit={onEdit}
                            onDelete={onDelete}
                        />
                    </>
                )}
            </div>
        </CardContent>
    </Card>
);

export default VoiceCollections;
