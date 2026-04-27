import { CheckCircle, DownloadSimple, Plug, SpeakerHigh } from '@phosphor-icons/react';

import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { TooltipHelp } from '@/shared/components/ui/tooltip-help';

interface LocalTtsConnectionGuideProps {
    canOpenVoiceManagement: boolean;
    onOpenVoices: () => void;
    onRequestPairing: () => void;
    pairingLoading: boolean;
    providerLabel: string;
    providerLampClass: string;
    officialSelfHostPath: string;
    selfHostWarning: string;
}

export function LocalTtsConnectionGuide({
    canOpenVoiceManagement,
    onOpenVoices,
    onRequestPairing,
    pairingLoading,
    providerLabel,
    providerLampClass,
    officialSelfHostPath,
    selfHostWarning,
}: LocalTtsConnectionGuideProps) {
    return (
        <div className="space-y-4">
            <div className="grid gap-3 lg:grid-cols-3">
                <div className="rounded-lg border border-border/70 bg-background/55 p-4">
                    <div className="mb-3 flex items-center gap-2">
                        <DownloadSimple className="h-5 w-5 text-cyan-300" weight="duotone" />
                        <p className="brand-wordmark text-xs font-semibold uppercase text-cyan-300">1. Запустить агент</p>
                    </div>
                    <p className="text-sm text-muted-foreground">
                        Откройте локальный агент на компьютере. Если его нет, кнопка подключения скачает файл для пары.
                    </p>
                </div>

                <div className="rounded-lg border border-blue-500/30 bg-blue-500/10 p-4">
                    <div className="mb-3 flex items-center gap-2">
                        <Plug className="h-5 w-5 text-blue-300" weight="duotone" />
                        <p className="brand-wordmark text-xs font-semibold uppercase text-blue-200">2. Связать с сайтом</p>
                    </div>
                    <Button
                        type="button"
                        onClick={onRequestPairing}
                        disabled={pairingLoading}
                        className="h-9 w-full bg-blue-700 text-white hover:bg-blue-800"
                    >
                        <span className={`mr-2 inline-block h-2.5 w-2.5 rounded-full ${providerLampClass}`} />
                        Подключить устройство
                    </Button>
                    <p className="mt-2 text-xs text-muted-foreground">{providerLabel} будет готов, когда индикатор станет зеленым.</p>
                </div>

                <div className="rounded-lg border border-border/70 bg-background/55 p-4">
                    <div className="mb-3 flex items-center gap-2">
                        <SpeakerHigh className="h-5 w-5 text-emerald-300" weight="duotone" />
                        <p className="brand-wordmark text-xs font-semibold uppercase text-emerald-300">3. Проверить голос</p>
                    </div>
                    <Button
                        type="button"
                        variant="outline"
                        onClick={onOpenVoices}
                        disabled={!canOpenVoiceManagement}
                        className="h-9 w-full border-emerald-500/40 text-emerald-200 hover:bg-emerald-500/10"
                    >
                        <CheckCircle className="mr-2 h-4 w-4" weight="duotone" />
                        Открыть проверку
                    </Button>
                    <p className="mt-2 text-xs text-muted-foreground">После подключения загрузите sample и сделайте короткий тест.</p>
                </div>
            </div>

            <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-4">
                <div className="flex items-center gap-2">
                    <Plug className="h-4 w-4 text-blue-300" weight="duotone" />
                    <p className="text-sm font-semibold text-blue-200">Основной путь подключения</p>
                    <TooltipHelp content={selfHostWarning} />
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                    <Badge variant="outline" className="border-blue-500/40 text-blue-300">
                        Локальный режим
                    </Badge>
                    <Badge variant="outline" className="border-blue-500/40 text-blue-300">
                        {officialSelfHostPath}
                    </Badge>
                </div>
            </div>
        </div>
    );
}
