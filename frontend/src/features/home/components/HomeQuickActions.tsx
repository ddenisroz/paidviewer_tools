import { ExternalLink, MonitorSmartphone } from 'lucide-react';

import { Button } from '@/shared/components/ui/button';
import { Card, CardContent } from '@/shared/components/ui/card';

interface HomeQuickActionsProps {
    onOpenChatBox: () => void;
    onOpenChatWindow: () => void;
}

export const HomeQuickActions = ({ onOpenChatBox, onOpenChatWindow }: HomeQuickActionsProps) => (
    <Card className="card-glass border-border">
        <CardContent className="p-4">
            <div className="w-full">
                <div className="flex items-start justify-center gap-3">
                    <Button
                        variant="ghost"
                        onClick={onOpenChatBox}
                        className="flex h-16 w-24 flex-col items-center justify-center gap-1 bg-transparent text-muted-foreground shadow-none hover:bg-transparent hover:text-blue-400"
                        title="OBS ChatOverlay"
                        aria-label="OBS ChatOverlay"
                    >
                        <MonitorSmartphone className="h-5 w-5" strokeWidth={2.25} />
                        <span className="font-sans text-xs font-medium leading-none">OBS Chat</span>
                    </Button>
                    <Button
                        variant="ghost"
                        onClick={onOpenChatWindow}
                        className="flex h-16 w-24 flex-col items-center justify-center gap-1 bg-transparent text-muted-foreground shadow-none hover:bg-transparent hover:text-blue-400"
                        title="Чат в отдельном окне"
                        aria-label="Чат в отдельном окне"
                    >
                        <ExternalLink className="h-5 w-5" strokeWidth={2.25} />
                        <span className="font-sans text-xs font-medium leading-none">Открыть чат</span>
                    </Button>
                </div>
            </div>
        </CardContent>
    </Card>
);
