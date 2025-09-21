// src/components/StreamTitleCard.jsx
import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Edit3, CheckCircle, XCircle, Circle } from 'lucide-react';

const TwitchIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
        <path d="M11.571 4.714h1.714v5.143H11.57zm4.714 0h1.714v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0H6zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714v9.429z" />
    </svg>
);

const getStatusIcon = (status) => {
    switch (status) {
        case 'loading': return <Circle size="sm" className="text-purple-500" />;
        case 'success': return <CheckCircle className="h-4 w-4 text-green-500" />;
        case 'error': return <XCircle className="h-4 w-4 text-red-500" />;
        default: return null;
    }
};

const getStatusText = (status) => {
    switch (status) {
        case 'loading': return 'Обновление...';
        case 'success': return 'Успешно обновлено';
        case 'error': return 'Ошибка обновления';
        default: return '';
    }
};

const StreamTitleCard = ({ 
    integrations, 
    streamTitle, 
    setStreamTitle, 
    status, 
    updateStreamTitle 
}) => {
    return (
        <Card className={`h-80 transition-all duration-300 ${integrations.twitch?.enabled ? 'border-green-500/50 bg-green-500/5 shadow-lg' : 'border-muted/30 bg-muted/20 opacity-60'}`}>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Edit3 className={`h-6 w-6 ${integrations.twitch?.enabled ? 'text-green-500' : 'text-muted-foreground'}`} />
                    Смена названия
                </CardTitle>
            </CardHeader>
            <CardContent>
                {integrations.twitch?.enabled ? (
                    <div className="h-full flex flex-col justify-between">
                        <div className="space-y-4">
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <TwitchIcon />
                                <span>Twitch</span>
                            </div>
                            <Input
                                value={streamTitle}
                                onChange={(e) => setStreamTitle(e.target.value)}
                                placeholder="Название стрима"
                                className="w-full"
                            />
                        </div>
                        <div className="flex flex-col gap-2">
                            <Button 
                                onClick={updateStreamTitle}
                                disabled={status.title === 'loading'}
                                className="w-full"
                            >
                                <Save className="h-4 w-4 mr-2" />
                                Сохранить
                            </Button>
                            {status.title && (
                                <div className="flex items-center gap-2 text-sm">
                                    {getStatusIcon(status.title)}
                                    <span className={status.title === 'success' ? 'text-green-500' : status.title === 'error' ? 'text-red-500' : 'text-purple-500'}>
                                        {getStatusText(status.title)}
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="h-full flex items-center justify-center text-muted-foreground">
                        <div className="text-center">
                            <Circle className="h-12 w-12 mx-auto mb-2" />
                            <p className="text-sm">Интеграция с Twitch отключена</p>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
};

export default StreamTitleCard;
