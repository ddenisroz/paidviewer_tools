import { Button } from '@/shared/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/shared/components/ui/dialog';

interface LocalTtsTutorialDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onClose: () => void;
}

const tutorialSteps = [
    {
        badge: 'Шаг 1',
        title: 'Запустите агент',
        text: 'Кнопка подключения сама попробует найти локальное приложение.',
        className: 'border-cyan-500/30 bg-cyan-500/10 text-cyan-200',
    },
    {
        badge: 'Шаг 2',
        title: 'Свяжите сайт',
        text: 'Если агент не найден, будет скачан файл подключения.',
        className: 'border-blue-500/30 bg-blue-500/10 text-blue-200',
    },
    {
        badge: 'Шаг 3',
        title: 'Проверьте голос',
        text: 'После online-статуса переходите к управлению голосами.',
        className: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200',
    },
];

export function LocalTtsTutorialDialog({ open, onOpenChange, onClose }: LocalTtsTutorialDialogProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-xl">
                <DialogHeader>
                    <DialogTitle>Подключение локального движка</DialogTitle>
                </DialogHeader>
                <div className="grid gap-3 sm:grid-cols-3">
                    {tutorialSteps.map((step) => (
                        <div key={step.badge} className={`rounded-lg border p-3 ${step.className}`}>
                            <p className="brand-wordmark text-xs uppercase">{step.badge}</p>
                            <p className="mt-1 text-sm font-medium text-foreground">{step.title}</p>
                            <p className="mt-1 text-xs text-muted-foreground">{step.text}</p>
                        </div>
                    ))}
                </div>
                <div className="rounded-lg border border-border/70 bg-background/55 p-3 text-sm text-muted-foreground">
                    Ручной URL и API ключ спрятаны в расширенных настройках. В обычном сценарии они не нужны.
                </div>
                <DialogFooter>
                    <Button type="button" onClick={onClose}>
                        Понятно
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
