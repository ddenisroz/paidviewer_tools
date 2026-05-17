import React from 'react';

import { Globe } from 'lucide-react';

import { Badge } from '@/shared/components/ui/badge';

import { EmptyVoices, VoiceCard } from './VoiceCollectionsParts';

import type { TtsVoice } from '@/types/tts';

interface GlobalVoicesSectionProps {
    totalGlobalVoices: number;
    globalVoices: TtsVoice[];
    isAdminVoiceAvailable: boolean;
    onEdit: (voice: TtsVoice) => void;
    onDelete: (voiceId: number) => void;
}

const GlobalVoicesSection: React.FC<GlobalVoicesSectionProps> = ({
    totalGlobalVoices,
    globalVoices,
    isAdminVoiceAvailable,
    onEdit,
    onDelete,
}) => (
    <div>
        <div className="mb-4 flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-lg font-semibold text-foreground">
                <Globe className="h-5 w-5 text-sky-300" />
                Глобальные голоса
                <Badge variant="outline" className="ml-2 border-sky-500/40 text-sky-200">
                    {totalGlobalVoices}
                </Badge>
            </h3>
        </div>

        {globalVoices.length === 0 ? (
            <EmptyVoices icon={Globe} text="Глобальных голосов пока нет" />
        ) : (
            <div className="flex flex-wrap gap-4">
                {globalVoices.map((voice) => (
                    <VoiceCard
                        key={voice.id}
                        voice={voice}
                        accent="hover:border-sky-500/35"
                        badge="global"
                        description={
                            <span className="flex items-center gap-2">
                                <span className="inline-flex h-2.5 w-2.5 rounded-full bg-sky-400" />
                                Общий голос для всех пользователей
                            </span>
                        }
                        onEdit={() => onEdit(voice)}
                        onDelete={() => onDelete(voice.id)}
                        isAdminVoiceAvailable={isAdminVoiceAvailable}
                    />
                ))}
            </div>
        )}
    </div>
);

export default GlobalVoicesSection;
