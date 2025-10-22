// src/context/TtsCardContext.jsx
import React, { createContext, useContext, useMemo } from 'react';
import { useTtsHealth } from './TtsHealthContext';
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
    const ttsHealth = useTtsHealth();
    
    // Проверяем, является ли пользователь гостем
    const isGuest = user?.is_guest || user?.id === -1;

    // Мемоизируем статус карточки на основе данных из TtsHealthContext
    const ttsCardStatus = useMemo(() => {
        if (isGuest) {
            return {
                isHealthy: false,
                isLoading: false,
                error: 'Guest mode - TTS not available'
            };
        }
        
        return {
            isHealthy: ttsHealth.isHealthy,
            isLoading: ttsHealth.isChecking,
            error: ttsHealth.isHealthy ? null : 'TTS service is not available'
        };
    }, [ttsHealth.isHealthy, ttsHealth.isChecking, isGuest]);
    
    const value = {
        ttsCardStatus,
        refreshStatus: ttsHealth.checkTtsHealth
    };

    return (
        <TtsCardContext.Provider value={value}>
            {children}
        </TtsCardContext.Provider>
    );
};
