import { ArrowsClockwise, Lock, WarningCircle } from '@phosphor-icons/react';

import { Button } from '@/shared/components/ui/button';

interface VoiceAccessNoticeProps {
    serviceError: boolean;
    accessBlocked: boolean;
    serviceMessage: string;
    accessMessage?: string;
    onRetry: () => void;
}

export function VoiceAccessNotice({
    serviceError,
    accessBlocked,
    serviceMessage,
    accessMessage,
    onRetry,
}: VoiceAccessNoticeProps) {
    if (!serviceError && !accessBlocked) return null;

    const tone = serviceError ? 'red' : 'orange';
    const title = serviceError ? 'Сервис голосов временно недоступен' : 'Управление голосами недоступно';
    const message = serviceError
        ? serviceMessage
        : accessMessage || 'Для текущего аккаунта управление голосами закрыто.';

    return (
        <div
            className={`mb-6 flex items-start gap-3 rounded-lg border p-4 ${
                tone === 'red' ? 'border-red-500/50 bg-red-900/20' : 'border-orange-500/50 bg-orange-900/20'
            }`}
        >
            {serviceError ? (
                <WarningCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-400" weight="duotone" />
            ) : (
                <Lock className="mt-0.5 h-5 w-5 flex-shrink-0 text-orange-400" weight="duotone" />
            )}
            <div className="flex-1">
                <h3 className={`mb-1 font-semibold ${tone === 'red' ? 'text-red-300' : 'text-orange-300'}`}>{title}</h3>
                <p className={`text-sm ${tone === 'red' ? 'text-red-200/80' : 'text-orange-200/80'}`}>{message}</p>
            </div>
            {serviceError && (
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={onRetry}
                    className="border-red-400/50 text-red-200 hover:bg-red-500/20 hover:text-white"
                >
                    <ArrowsClockwise className="h-4 w-4 mr-2" weight="bold" />
                    Повторить
                </Button>
            )}
        </div>
    );
}
