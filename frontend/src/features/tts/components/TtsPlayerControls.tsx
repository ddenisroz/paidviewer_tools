import { SkipForward, Square, Volume2 } from 'lucide-react';

import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Slider } from '@/shared/components/ui/slider';

interface TtsPlayerControlsProps {
    compact: boolean;
    hasItems: boolean;
    isAudioUnlocked: boolean;
    isSocketConnected: boolean;
    websiteVolume: number;
    onClearQueue: () => void;
    onSkipCurrent: () => void;
    onUnlockAudio: () => void;
    onVolumeChange: (value: number) => void;
}

export const TtsPlayerControls: React.FC<TtsPlayerControlsProps> = ({
    compact,
    hasItems,
    isAudioUnlocked,
    isSocketConnected,
    websiteVolume,
    onClearQueue,
    onSkipCurrent,
    onUnlockAudio,
    onVolumeChange,
}) => (
    <Card className="card-glass shrink-0 border-border/70">
        <CardHeader className="border-b border-white/5 pb-3">
            <div className="flex items-center justify-between gap-3">
                <CardTitle className="text-base">TTS Player</CardTitle>
                <div className={`text-xs font-bold uppercase tracking-wide ${isSocketConnected ? 'text-emerald-300' : 'text-red-300'}`}>
                    {isSocketConnected ? 'online' : 'offline'}
                </div>
            </div>
        </CardHeader>
        <CardContent className={compact ? 'space-y-3 p-3' : 'grid gap-3 p-4 md:grid-cols-[auto_minmax(260px,1fr)_auto]'}>
            <div className="grid grid-cols-2 gap-2">
                <Button type="button" variant="destructive" className="h-10" onClick={onClearQueue} disabled={!hasItems}>
                    <Square className="mr-2 h-4 w-4" />
                    Стоп
                </Button>
                <Button type="button" variant="secondary" className="h-10" onClick={onSkipCurrent} disabled={!hasItems}>
                    <SkipForward className="mr-2 h-4 w-4" />
                    Скип
                </Button>
            </div>
            <div className="rounded-lg border border-border/70 bg-background/35 px-3 py-2">
                <div className="mb-2 flex items-center justify-between gap-3">
                    <span className="inline-flex items-center gap-2 text-sm font-bold text-foreground">
                        <Volume2 className="h-4 w-4 text-emerald-300" />
                        Громкость
                    </span>
                    <span className="text-sm font-bold text-foreground">{websiteVolume}%</span>
                </div>
                <Slider value={[websiteVolume]} min={0} max={100} step={1} onValueChange={(values) => onVolumeChange(values[0])} />
            </div>
            {!isAudioUnlocked ? (
                <Button type="button" variant="outline" className="h-10" onClick={onUnlockAudio}>
                    Включить звук
                </Button>
            ) : null}
        </CardContent>
    </Card>
);
