import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { formatAppDateTime } from '@/shared/utils/dateTime';

type TtsMessageStatus = 'not_voiced' | 'queued' | 'playing' | 'played' | 'failed';

export interface TtsPlayerMessage {
    id: string;
    username?: string;
    platform?: string;
    text: string;
    status: TtsMessageStatus;
    timestamp: Date;
}

const STATUS_TEXT_CLASS: Record<TtsMessageStatus, string> = {
    not_voiced: 'text-[#ff4d5f]',
    failed: 'text-[#ff4d5f]',
    queued: 'text-[#ffd21f]',
    playing: 'text-[#ffd21f]',
    played: 'text-[#28ff94]',
};

const STATUS_LABEL: Record<TtsMessageStatus, string> = {
    not_voiced: 'Пропуск',
    failed: 'Пропуск',
    queued: 'Очередь',
    playing: 'Ждёт',
    played: 'Озвучено',
};

const formatMessage = (text: string, maxLength: number): string =>
    text.length <= maxLength ? text : `${text.slice(0, maxLength)}...`;

const formatQueuedAt = (date: Date): string =>
    formatAppDateTime(date, { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });

export const TtsPlayerMessages: React.FC<{ compact: boolean; messages: TtsPlayerMessage[] }> = ({
    compact,
    messages,
}) => (
    <Card
        className={
            compact
                ? 'flex min-h-0 flex-col border-white/6 bg-[#090612]/96 shadow-[0_12px_40px_rgba(0,0,0,0.22)]'
                : 'card-glass flex min-h-0 max-h-[min(430px,calc(100vh-160px))] flex-1 flex-col border-border/70'
        }
    >
        <CardHeader className={compact ? 'border-b border-white/6 px-3 py-2.5' : 'border-b border-white/5 px-4 py-2.5'}>
            <CardTitle className={compact ? 'text-sm font-bold text-slate-50' : 'text-base'}>Лента озвучки</CardTitle>
        </CardHeader>
        <CardContent className="min-h-0 flex-1 p-2">
            {messages.length === 0 ? (
                <div className={compact ? 'rounded-lg border border-dashed border-white/10 bg-white/[0.03] px-3 py-5 text-center text-sm text-slate-400' : 'rounded-md border border-dashed border-border/70 px-3 py-5 text-center text-sm text-muted-foreground'}>
                    Жду сообщения
                </div>
            ) : (
                <div className={compact ? 'h-full min-h-0 overflow-y-auto rounded-lg border border-white/10 bg-black/20 px-2 py-1 custom-scrollbar' : 'h-full min-h-0 overflow-y-auto rounded-md border border-white/10 bg-background/45 px-2 py-1 custom-scrollbar'}>
                    {messages.map((message) => (
                        <TtsPlayerMessageRow
                            key={message.id}
                            message={message}
                            maxLength={compact ? 90 : 130}
                        />
                    ))}
                </div>
            )}
        </CardContent>
    </Card>
);

const TtsPlayerMessageRow: React.FC<{ message: TtsPlayerMessage; maxLength: number }> = ({ message, maxLength }) => {
    const textClass = STATUS_TEXT_CLASS[message.status] || STATUS_TEXT_CLASS.not_voiced;
    const statusLabel = STATUS_LABEL[message.status] || STATUS_LABEL.not_voiced;
    const platform = message.platform ? ` / ${message.platform}` : '';

    return (
        <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 border-b border-white/5 py-1.5 leading-tight last:border-b-0">
            <div className="min-w-0">
                <div className="mb-0.5 flex min-w-0 items-center gap-1.5 text-[11px] leading-none">
                    <span className="truncate font-bold text-sky-200">{message.username || 'chat'}</span>
                    <span className="shrink-0 font-semibold text-muted-foreground">{platform}</span>
                    <span className="shrink-0 text-muted-foreground">{formatQueuedAt(message.timestamp)}</span>
                </div>
                <p className={`break-words text-[13px] font-bold leading-snug ${textClass}`}>
                    {formatMessage(message.text, maxLength)}
                </p>
            </div>
            <span className={`self-start pt-0.5 text-[11px] font-bold uppercase ${textClass}`}>{statusLabel}</span>
        </div>
    );
};
