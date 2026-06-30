import {
    ArrowsClockwise,
    CaretDown,
    CheckCircle,
    DownloadSimple,
    Headphones,
    Plug,
    SpeakerHigh,
} from '@phosphor-icons/react';

import { GuideLink, StatusChip } from '@/features/tts/components/LocalTtsGuideParts';
import { agentStatus, serviceStatus, voiceStatus } from '@/features/tts/components/LocalTtsGuideState';
import { cn } from '@/lib/utils';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';

import type React from 'react';

interface LocalTtsConnectionGuideProps {
    agentOnline: boolean;
    canOpenVoiceManagement: boolean;
    onOpenVoices: () => void;
    onRequestPairing: () => void;
    onTestConnection: () => void;
    pairingLoading: boolean;
    providerLabel: string;
    testing: boolean;
    workerRepoUrl: string;
    runtimeRepoUrl?: string;
}

const stepClass = 'group rounded-lg border border-border/70 bg-background/55 px-3 py-2';
const stepTextClass = 'mt-2 max-w-3xl text-xs leading-relaxed text-muted-foreground';

export function LocalTtsConnectionGuide({
    agentOnline,
    canOpenVoiceManagement,
    onOpenVoices,
    onRequestPairing,
    onTestConnection,
    pairingLoading,
    providerLabel,
    testing,
    workerRepoUrl,
    runtimeRepoUrl,
}: LocalTtsConnectionGuideProps) {
    const agent = agentStatus(agentOnline);
    const service = serviceStatus(agentOnline, canOpenVoiceManagement);
    const voices = voiceStatus(canOpenVoiceManagement);
    const settingsState = pairingLoading ? 'передаются' : 'готовы';
    const settingsStepState = pairingLoading ? 'готовлю файл' : 'готово';
    const steps: Array<{
        title: string;
        state: string;
        tone: string;
        icon: React.ReactNode;
        body: React.ReactNode;
        action?: React.ReactNode;
    }> = [
        {
            title: '1. Установите Self Hosted программу',
            state: agent.state,
            tone: agent.tone,
            icon: <Plug className="h-4 w-4" weight="duotone" />,
            body: (
                <>
                    Она работает на вашем компьютере и связывает сайт с голосовым сервисом. Откройте инструкцию,
                    скачайте Self Hosted пакет и запустите его рядом с проектом.
                    <div className="mt-2 flex flex-wrap gap-2">
                        <GuideLink href={workerRepoUrl}>Self Hosted программа</GuideLink>
                        {runtimeRepoUrl ? (
                            <GuideLink href={runtimeRepoUrl}>Документация {providerLabel}</GuideLink>
                        ) : null}
                    </div>
                </>
            ),
        },
        {
            title: '2. Передайте настройки',
            state: settingsStepState,
            tone: 'text-sky-300',
            icon: <DownloadSimple className="h-4 w-4" weight="duotone" />,
            action: (
                <Button type="button" size="sm" onClick={onRequestPairing} disabled={pairingLoading}>
                    <DownloadSimple className="h-4 w-4" weight="bold" />
                    Передать настройки
                </Button>
            ),
            body: 'Кнопка передает сайту и Self Hosted программе один набор настроек. Если программа еще не отвечает, файл скачивается и подхватывается при следующем запуске.',
        },
        {
            title: `3. Проверьте ${providerLabel}`,
            state: service.value,
            tone: service.tone,
            icon: <SpeakerHigh className="h-4 w-4" weight="duotone" />,
            action: (
                <Button type="button" size="sm" onClick={onTestConnection} disabled={testing}>
                    <ArrowsClockwise className={cn('h-4 w-4', testing && 'animate-spin')} weight="bold" />
                    Проверить сервис
                </Button>
            ),
            body: `Проверка показывает, отвечает ли выбранный голосовой сервис. Если статус не отвечает, запустите ${providerLabel} в Self Hosted режиме и повторите проверку.`,
        },
        {
            title: '4. Откройте голоса',
            state: voices.state,
            tone: voices.tone,
            icon: <Headphones className="h-4 w-4" weight="duotone" />,
            action: (
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={onOpenVoices}
                    disabled={!canOpenVoiceManagement}
                >
                    <CheckCircle className="h-4 w-4" weight="duotone" />
                    Открыть голоса
                </Button>
            ),
            body: 'После успешной проверки здесь откроется управление голосами: загрузка, тест и настройки пользовательских голосов.',
        },
    ];

    return (
        <section className="w-full rounded-lg border border-border/70 bg-card/90 p-4 shadow-sm shadow-black/10 ring-1 ring-white/5">
            <div className="flex min-w-0 items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-sky-500/35 bg-sky-500/10 text-sky-300">
                    <Plug className="h-5 w-5" weight="duotone" />
                </div>
                <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-base font-semibold text-foreground">Подключение Self Hosted TTS</h2>
                        <Badge variant="outline" className="border-blue-500/35 bg-blue-500/10 text-blue-200">
                            {providerLabel}
                        </Badge>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Сайт отправляет задачу вашей Self Hosted программе, а голосовой сервис создает звук на этом
                        компьютере.
                    </p>
                </div>
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-4">
                <StatusChip label="Программа" value={agent.value} tone={agent.tone} />
                <StatusChip label="Настройки" value={settingsState} tone="text-sky-300" />
                <StatusChip label="Сервис" value={service.value} tone={service.tone} />
                <StatusChip label="Голоса" value={voices.value} tone={voices.tone} />
            </div>

            <div className="mt-3 space-y-2">
                {steps.map((step, index) => (
                    <details key={step.title} className={stepClass} open={index === 0}>
                        <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
                            <span className="flex min-w-0 items-center gap-2">
                                <span className={step.tone}>{step.icon}</span>
                                <span className="truncate text-sm font-medium text-foreground">{step.title}</span>
                                <Badge variant="outline" className={cn('border-border/70 bg-background/70', step.tone)}>
                                    {step.state}
                                </Badge>
                            </span>
                            <span className="flex shrink-0 items-center gap-2">
                                <CaretDown
                                    className="h-4 w-4 text-muted-foreground transition-transform duration-150 group-open:rotate-180"
                                    weight="bold"
                                />
                            </span>
                        </summary>
                        <div className={stepTextClass}>{step.body}</div>
                        {step.action ? <div className="mt-3">{step.action}</div> : null}
                    </details>
                ))}
            </div>
        </section>
    );
}
