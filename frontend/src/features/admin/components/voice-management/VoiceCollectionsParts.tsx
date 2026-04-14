import React from 'react';

import { AlertCircle, Settings, Trash2 } from 'lucide-react';

import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';

import type { TtsVoice } from '@/types/tts';

const VOICE_CARD_CLASS = 'w-full max-w-[360px] min-h-[180px] min-w-0 rounded-2xl border border-border/70 bg-card/90 transition-all duration-200 hover:-translate-y-0.5';
const EMPTY_STATE_CLASS = 'rounded-2xl border border-border/60 border-dashed bg-muted/20 py-10 text-center';

export const VoiceCard: React.FC<{
  voice: TtsVoice;
  accent: string;
  badge: string;
  description: React.ReactNode;
  onEdit: () => void;
  onDelete: () => void;
  isAdminVoiceAvailable: boolean;
}> = ({ voice, accent, badge, description, onEdit, onDelete, isAdminVoiceAvailable }) => (
  <Card className={`${VOICE_CARD_CLASS} ${accent}`}>
    <CardHeader className="pb-4">
      <div className="flex items-start justify-between gap-2">
        <CardTitle className="min-w-0 text-sm font-medium text-foreground">
          <span className="min-w-0 break-words">{voice.name}</span>
        </CardTitle>
        <Badge variant="outline" className="text-xs">
          {badge}
        </Badge>
      </div>
      <div className="mt-4 text-sm text-muted-foreground">{description}</div>
    </CardHeader>
    <CardContent className="mt-auto pt-0">
      <div className="flex flex-wrap gap-2 border-t border-border/60 pt-4">
        <Button
          onClick={onEdit}
          className="h-9 flex-1 border-border/70 bg-background/60 text-foreground hover:bg-accent/70"
          variant="outline"
          size="sm"
          disabled={!isAdminVoiceAvailable}
        >
          <Settings className="mr-1 h-4 w-4" />
          Настроить
        </Button>
        <Button onClick={onDelete} variant="destructive" size="sm" disabled={!isAdminVoiceAvailable}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </CardContent>
  </Card>
);

export const WarningBanner: React.FC<{
  title: string;
  tone: string;
  message: string;
  hint?: string;
  onRefresh?: () => void;
}> = ({ title, tone, message, hint, onRefresh }) => (
  <div className={`mb-6 rounded-lg border p-4 ${tone}`}>
    <div className="flex items-start gap-3">
      <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0" />
      <div className="flex-1">
        <p className="mb-1 font-semibold">{title}</p>
        <p className="text-sm">{message}</p>
        {hint ? <p className="mt-2 text-xs">{hint}</p> : null}
      </div>
      {onRefresh ? (
        <Button variant="ghost" size="sm" onClick={onRefresh}>
          Обновить
        </Button>
      ) : null}
    </div>
  </div>
);

export const EmptyVoices: React.FC<{ icon: React.ElementType; text: string }> = ({ icon: Icon, text }) => (
  <div className={EMPTY_STATE_CLASS}>
    <Icon className="mx-auto mb-4 h-16 w-16 text-muted-foreground" />
    <p className="mb-2 text-lg text-muted-foreground">{text}</p>
  </div>
);
