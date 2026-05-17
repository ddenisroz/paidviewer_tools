import React from 'react';

import { AlertCircle, Settings } from 'lucide-react';

import PageWrapper from '@/shared/components/PageWrapper';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent } from '@/shared/components/ui/card';

interface SettingsAccessCardProps {
    onLogin: () => void;
}

const SettingsAccessCard: React.FC<SettingsAccessCardProps> = ({ onLogin }) => (
    <PageWrapper title="Настройки">
        <Card className="card-glass border-border/70 bg-card/70">
            <CardContent className="flex flex-col items-center justify-center space-y-6 pb-16 pt-16 text-center">
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-muted">
                    <AlertCircle className="h-10 w-10 text-muted-foreground" />
                </div>
                <div className="max-w-md space-y-2">
                    <h3 className="text-xl font-semibold text-foreground">Требуется авторизация</h3>
                    <p className="text-sm text-muted-foreground">
                        Для доступа к настройкам необходимо войти в систему.
                    </p>
                </div>
                <Button onClick={onLogin} className="gap-2">
                    <Settings className="h-4 w-4" />
                    Войти в систему
                </Button>
            </CardContent>
        </Card>
    </PageWrapper>
);

export default SettingsAccessCard;
