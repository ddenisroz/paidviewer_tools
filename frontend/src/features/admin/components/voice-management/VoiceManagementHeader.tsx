import React from 'react';

import { Mic, Upload } from 'lucide-react';

import type { VoiceProvider } from '@/features/admin/types/voiceManagement';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Label } from '@/shared/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/components/ui/select';

interface VoiceManagementHeaderProps {
  totalVoices: number;
  totalUserVoices: number;
  totalGlobalVoices: number;
  voiceProvider: VoiceProvider;
  isAdminVoiceAvailable: boolean;
  onVoiceProviderChange: (provider: VoiceProvider) => void;
  onOpenUpload: () => void;
}

const VoiceManagementHeader: React.FC<VoiceManagementHeaderProps> = ({
  totalVoices,
  totalUserVoices,
  totalGlobalVoices,
  voiceProvider,
  isAdminVoiceAvailable,
  onVoiceProviderChange,
  onOpenUpload,
}) => (
  <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
    <div className="space-y-3">
      <h2 className="flex items-center gap-2 text-2xl font-semibold text-foreground">
        <Mic className="h-6 w-6 text-muted-foreground" />
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
          Глобальные: {totalGlobalVoices}
        </Badge>
      </div>
    </div>

    <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <div className="w-full sm:w-48">
        <Label htmlFor="voiceProvider" className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          Провайдер
        </Label>
        <Select value={voiceProvider} onValueChange={(value) => onVoiceProviderChange(value as VoiceProvider)}>
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
        onClick={onOpenUpload}
        disabled={!isAdminVoiceAvailable}
      >
        <Upload className="mr-2 h-4 w-4" />
        Загрузить голос
      </Button>
    </div>
  </div>
);

export default VoiceManagementHeader;
