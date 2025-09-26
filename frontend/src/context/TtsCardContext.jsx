// src/context/TtsCardContext.jsx
import React, { createContext, useState, useEffect, useContext } from 'react';
import { useLocation } from 'react-router-dom';
import { TtsHealthContext, useTtsHealth } from './TtsHealthContext';
import { ttsService } from '../services/microservices';
import { useAuth } from './AuthContext';

const TtsCardContext = createContext();

export const useTtsCard = () => {
    const context = useContext(TtsCardContext);
    if (!context) {
        throw new Error('useTtsCard must be used within a TtsCardProvider');
    }
    return context;
};

export const TtsCardProvider = ({ children }) => {
    const { user } = useAuth();
    
    const [ttsCardStatus, setTtsCardStatus] = useState({
        isHealthy: false,
        isLoading: true,
        error: null
    });

    // Проверяем, является ли пользователь гостем
    const isGuest = user?.is_guest || user?.id === -1;

    const checkTtsHealth = async () => {
        // Не проверяем TTS для гостевых пользователей
        if (isGuest) {
            setTtsCardStatus({ isHealthy: false, isLoading: false, error: 'Guest mode - TTS not available' });
            return;
        }
        
        setTtsCardStatus(prev => ({ ...prev, isLoading: true }));
        try {
            const response = await ttsService.get('/health');
            if (response.status === 200 && response.data.tts_engine_loaded) {
                setTtsCardStatus({ isHealthy: true, isLoading: false, error: null });
            } else {
                setTtsCardStatus({ isHealthy: false, isLoading: false, error: 'TTS service is not responding correctly.' });
            }
        } catch (error) {
            setTtsCardStatus({ isHealthy: false, isLoading: false, error: 'Failed to connect to TTS service.' });
            console.error("TTS Health Check Error:", error);
        }
    };

    useEffect(() => {
        // Используем данные из TtsHealthContext вместо собственных проверок
        const ttsHealth = useTtsHealth();
        
        // Обновляем статус на основе данных из TtsHealthContext
        setTtsCardStatus({
            isHealthy: ttsHealth.isHealthy,
            isLoading: ttsHealth.isChecking,
            error: ttsHealth.isHealthy ? null : 'TTS service is not available'
        });
        
        // Не делаем собственные health check'и - используем общий контекст
    }, [isGuest]);
    
    const value = {
        ttsCardStatus,
        refreshStatus: checkTtsHealth
    };

    return (
        <TtsCardContext.Provider value={value}>
            {children}
        </TtsCardContext.Provider>
    );
};
