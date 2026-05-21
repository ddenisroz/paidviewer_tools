import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Loader } from '@/shared/components/ui/loader';

interface MemeAlertsCallbackStatusProps {
    status: 'loading' | 'success' | 'error';
    message: string;
}

export const MemeAlertsCallbackStatus: React.FC<MemeAlertsCallbackStatusProps> = ({ status, message }) => (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <Card className="card-glass w-full max-w-md">
            <CardHeader>
                <CardTitle>MemeAlerts</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                {status === 'loading' ? (
                    <div className="flex items-center gap-2 text-muted-foreground">
                        <Loader className="h-4 w-4" />
                        <span>{message}</span>
                    </div>
                ) : (
                    <p className={status === 'success' ? 'text-green-400' : 'text-red-400'}>{message}</p>
                )}
                <Button variant="outline" onClick={() => { window.location.href = '/dashboard/media?tab=memealerts'; }}>
                    Вернуться
                </Button>
            </CardContent>
        </Card>
    </div>
);
