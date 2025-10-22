// src/components/tts/HealthStatus.jsx
import React from 'react';

const HealthStatus = ({ isHealthy, isChecking }) => {
    if (isChecking) {
        return (
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 mb-6">
                <div className="flex items-start gap-3">
                    <div className="w-5 h-5 bg-blue-500 rounded-full flex-shrink-0 mt-0.5 animate-pulse"></div>
                    <div className="flex-1">
                        <h3 className="text-md font-semibold text-blue-400 mb-1">
                            Проверка состояния TTS
                        </h3>
                        <p className="text-sm text-blue-300">
                            Проверяем доступность TTS сервера...
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    if (!isHealthy) {
        return (
            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 mb-6">
                <div className="flex items-start gap-3">
                    <div className="w-5 h-5 bg-yellow-500 rounded-full flex-shrink-0 mt-0.5"></div>
                    <div className="flex-1">
                        <h3 className="text-md font-semibold text-yellow-400 mb-1">
                            TTS ИИ озвучка недоступна
                        </h3>
                        <p className="text-sm text-yellow-300">
                            TTS сервер временно недоступен. Базовая озвучка продолжает работать.
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    return null;
};

export default HealthStatus;

