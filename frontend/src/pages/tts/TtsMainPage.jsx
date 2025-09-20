// src/pages/tts/TtsMainPage.jsx
import React, { useContext } from 'react';
import { useTts } from '../context/TtsContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader } from 'lucide-react';
import { toast } from 'sonner';

const TtsMainPage = () => {
    const { ttsEnabled, toggleTts, isWhitelisted, engineStatus } = useTts();

    const handleToggle = () => {
        if (engineStatus.error) {
            toast.error(engineStatus.error);
            return;
        }
        toggleTts();
    };

    return (
        <div className="container mx-auto p-4">
            <h1 className="text-2xl font-bold mb-4">Озвучка сообщений</h1>
            <Card>
                <CardHeader>
                    <CardTitle>Управление озвучкой</CardTitle>
                    <CardDescription>
                        Включите или выключите озвучку сообщений из чата.
                        {isWhitelisted === false && <span className="text-red-500 block mt-2">Ваш канал не в белом списке для этой функции.</span>}
                        {engineStatus.error && <span className="text-red-500 block mt-2">Ошибка сервиса: {engineStatus.error}</span>}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center space-x-4">
                        <Button
                            onClick={handleToggle}
                            disabled={!isWhitelisted || !engineStatus.loaded}
                        >
                            {ttsEnabled ? 'Выключить озвучку' : 'Включить озвучку'}
                        </Button>
                        <p className={`text-sm ${ttsEnabled ? 'text-green-500' : 'text-red-500'}`}>
                            Статус: {ttsEnabled ? 'Включено' : 'Выключено'}
                        </p>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

export default TtsMainPage;
