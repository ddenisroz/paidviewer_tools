import { Zap } from 'lucide-react';

import { Badge } from '@/shared/components/ui/badge';
import { TooltipHelp } from '@/shared/components/ui/tooltip-help';

interface LocalTtsConnectionGuideProps {
    providerLabel: string;
    officialSelfHostPath: string;
    selfHostWarning: string;
}

const steps = [
    {
        title: '1. Запустить агент',
        text: 'Откройте локальное приложение или скачайте файл подключения.',
    },
    {
        title: '2. Связать',
        text: 'Индикатор покажет, что worker online.',
    },
    {
        title: '3. Проверить голос',
        text: 'После подключения откройте голоса и сделайте короткий тест.',
    },
];

export function LocalTtsConnectionGuide({
    providerLabel,
    officialSelfHostPath,
    selfHostWarning,
}: LocalTtsConnectionGuideProps) {
    return (
        <div className="space-y-4">
            <div className="grid gap-3 lg:grid-cols-3">
                {steps.map((step) => (
                    <div key={step.title} className="rounded-lg border border-border/70 bg-background/55 p-4">
                        <p className="brand-wordmark mb-2 text-xs font-semibold uppercase text-cyan-300">{step.title}</p>
                        <p className="text-sm text-muted-foreground">
                            {step.text} {step.title === '2. Связать' ? providerLabel : ''}
                        </p>
                    </div>
                ))}
            </div>

            <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-4">
                <div className="flex items-center gap-2">
                    <Zap className="h-4 w-4 text-blue-300" />
                    <p className="text-sm font-semibold text-blue-200">Основной self-host путь</p>
                    <TooltipHelp content={selfHostWarning} />
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                    <Badge variant="outline" className="border-blue-500/40 text-blue-300">
                        official_mode: self_host
                    </Badge>
                    <Badge variant="outline" className="border-blue-500/40 text-blue-300">
                        recommended_path: {officialSelfHostPath}
                    </Badge>
                </div>
            </div>
        </div>
    );
}
