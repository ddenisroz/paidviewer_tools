import React, { useEffect, useState } from 'react';

import { RefreshCw } from 'lucide-react';
import { useInterval } from 'react-use';

import { Button } from '@/shared/components/ui/button';

interface HealthStatusProps {
    isHealthy: boolean;
    isChecking: boolean;
    checkTtsHealth?: () => void;
    isWhitelisted?: boolean | null;
}

const HealthStatus: React.FC<HealthStatusProps> = ({ isHealthy, isChecking, checkTtsHealth, isWhitelisted }) => {
    const [checkingDuration, setCheckingDuration] = useState(0);

    // Используем современный хук useInterval вместо ручного setInterval
    useInterval(
        () => {
            if (isChecking) {
                setCheckingDuration((prev) => prev + 1);
            }
        },
        isChecking ? 1000 : null
    );

    // Сбрасываем счетчик при начале проверки
    useEffect(() => {
        if (isChecking) {
            setCheckingDuration(0);
        }
    }, [isChecking]);

    // Проверяем есть ли локальный TTS setup
    const hasLocalSetup = localStorage.getItem('tts_has_local_setup') === 'true';

    if (isChecking) {
        return (
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4 mb-6">
                <div className="flex items-start gap-3">
                    <div className="w-5 h-5 bg-blue-500 rounded-full flex-shrink-0 mt-0.5 animate-pulse"></div>
                    <div className="flex-1">
                        <h3 className="text-md font-semibold text-blue-400 mb-1">Проверка состояния TTS</h3>
                        <p className="text-sm text-blue-300">
                            Проверяем доступность TTS сервера... {checkingDuration > 0 && `(${checkingDuration}с)`}
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    // Если TTS сервер здоров, но пользователь не в whitelist И нет локального setup - показываем warning
    if (isHealthy && isWhitelisted === false && !hasLocalSetup) {
        return (
            <div className="bg-orange-500/10 border border-orange-500/30 rounded-xl p-4 mb-6">
                <div className="flex items-start gap-3">
                    <div className="w-5 h-5 bg-orange-500 rounded-full flex-shrink-0 mt-0.5"></div>
                    <div className="flex-1">
                        <h3 className="text-md font-semibold text-orange-400 mb-1">
                            Доступ к облачному F5-TTS ограничен
                        </h3>
                        <p className="text-sm text-orange-300">
                            Ваш канал не в белом списке (whitelist). Доступна только базовая озвучка (gTTS).
                        </p>
                        <p className="text-xs text-gray-400 mt-2">
                            Для использования F5-TTS настройте Self Hosted TTS (`tts_service`, single-node профиль) или
                            обратитесь к администратору для whitelist.
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    // Если TTS сервер недоступен
    if (!isHealthy) {
        return (
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 mb-6">
                <div className="flex items-start gap-3">
                    <div className="w-5 h-5 bg-yellow-500 rounded-full flex-shrink-0 mt-0.5"></div>
                    <div className="flex-1">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="text-md font-semibold text-yellow-400 mb-1">
                                    TTS ИИ озвучка недоступна
                                </h3>
                                <p className="text-sm text-yellow-300">
                                    TTS сервер временно недоступен. Базовая озвучка продолжает работать.
                                </p>
                            </div>
                            {checkTtsHealth && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={checkTtsHealth}
                                    className="border-yellow-500/50 text-yellow-400 hover:bg-yellow-500/10"
                                >
                                    <RefreshCw className="w-4 h-4 mr-2" />
                                    Проверить снова
                                </Button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return null;
};

export default HealthStatus;
