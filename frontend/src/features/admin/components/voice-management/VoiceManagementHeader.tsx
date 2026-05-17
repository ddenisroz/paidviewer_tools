import React from 'react';

import { Mic, Upload } from 'lucide-react';

import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';

interface VoiceManagementHeaderProps {
    totalVoices: number;
    totalUserVoices: number;
    totalGlobalVoices: number;
    voiceProvider?: 'f5';
    isAdminVoiceAvailable: boolean;
    onVoiceProviderChange?: React.Dispatch<React.SetStateAction<'f5'>>;
    onOpenUpload: () => void;
}

const VoiceManagementHeader: React.FC<VoiceManagementHeaderProps> = ({
    totalVoices,
    totalUserVoices,
    totalGlobalVoices,
    isAdminVoiceAvailable,
    onOpenUpload,
}) => (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-3">
            <h2 className="flex items-center gap-2 text-xl font-semibold text-foreground">
                <Mic className="h-5 w-5 text-muted-foreground" />
                Управление голосами
            </h2>
            <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className="border-border/70 px-3 py-1 text-sm text-foreground">
                    Всего: {totalVoices}
                </Badge>
                <Badge variant="outline" className="border-emerald-500/30 px-3 py-1 text-sm text-emerald-200">
                    Пользовательские: {totalUserVoices}
                </Badge>
                <Badge variant="outline" className="border-sky-500/30 px-3 py-1 text-sm text-sky-200">
                    Базовые: {totalGlobalVoices}
                </Badge>
            </div>
        </div>

        <Button
            className="h-10 bg-primary px-5 text-primary-foreground hover:bg-primary/90"
            onClick={onOpenUpload}
            disabled={!isAdminVoiceAvailable}
        >
            <Upload className="mr-2 h-4 w-4" />
            Загрузить голос
        </Button>
    </div>
);

export default VoiceManagementHeader;
