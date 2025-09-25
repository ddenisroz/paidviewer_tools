// src/context/TtsCardContext.jsx
import React, { createContext, useState, useEffect, useContext } from 'react';
import { useLocation } from 'react-router-dom';
import { TtsHealthContext } from './TtsHealthContext';
import { ttsService } from '../services/microservices';

const TtsCardContext = createContext();

export const useTtsCard = () => {
    const context = useContext(TtsCardContext);
    if (!context) {
        throw new Error('useTtsCard must be used within a TtsCardProvider');
    }
    return context;
};

export const TtsCardProvider = ({ children }) => {
    const [ttsCardStatus, setTtsCardStatus] = useState({
        isHealthy: false,
        isLoading: true,
        error: null
    });

    const checkTtsHealth = async () => {
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
        checkTtsHealth();
        const interval = setInterval(checkTtsHealth, 30000); // Check every 30 seconds
        return () => clearInterval(interval);
    }, []);
    
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
