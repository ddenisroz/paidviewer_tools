import React, { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react';

import { logger } from '@/shared/utils/prodLogger';

type AudioSource = 'youtube' | 'tts' | null;

interface AudioPriorityState {
    activeSource: AudioSource;
    isPaused: boolean;
    ttsPreference: 'pause' | 'duck' | 'none';
}

interface AudioPriorityContextValue extends AudioPriorityState {
    requestAudioFocus: (source: AudioSource) => void;
    releaseAudioFocus: (source: AudioSource) => void;
    setTtsPreference: (preference: 'pause' | 'duck' | 'none') => void;
}

const AudioPriorityContext = createContext<AudioPriorityContextValue | undefined>(undefined);

interface AudioPriorityProviderProps {
    children: ReactNode;
}

export const AudioPriorityProvider: React.FC<AudioPriorityProviderProps> = ({ children }) => {
    const [state, setState] = useState<AudioPriorityState>({
        activeSource: null,
        isPaused: false,
        ttsPreference: 'pause' // Default: pause YouTube when TTS plays
    });

    const requestAudioFocus = useCallback((source: AudioSource) => {
        setState(prev => {
            // If TTS requests focus and YouTube is playing
            if (source === 'tts' && prev.activeSource === 'youtube') {
                // Check user preference for audio priority
                if (prev.ttsPreference === 'none') {
                    logger.debug('[AUDIO] [AudioPriority] TTS requesting focus, but preference is "none" - no action');
                    return {
                        ...prev,
                        activeSource: 'tts'
                    };
                }
                
                if (prev.ttsPreference === 'pause') {
                    logger.debug('[AUDIO] [AudioPriority] TTS requesting focus, pausing YouTube (preference: pause)');
                    
                    // Dispatch event to pause YouTube
                    window.dispatchEvent(new CustomEvent('audio_priority_change', {
                        detail: { action: 'pause_youtube', reason: 'tts_started' }
                    }));
                    
                    return {
                        ...prev,
                        activeSource: 'tts',
                        isPaused: true
                    };
                }
                
                if (prev.ttsPreference === 'duck') {
                    logger.debug('[AUDIO] [AudioPriority] TTS requesting focus, ducking YouTube volume (preference: duck)');
                    
                    // Dispatch event to duck YouTube volume
                    window.dispatchEvent(new CustomEvent('audio_priority_change', {
                        detail: { action: 'duck_youtube', reason: 'tts_started' }
                    }));
                    
                    return {
                        ...prev,
                        activeSource: 'tts',
                        isPaused: false
                    };
                }
            }
            
            // If YouTube requests focus and TTS is not playing
            if (source === 'youtube' && prev.activeSource !== 'tts') {
                logger.debug('[AUDIO] [AudioPriority] YouTube requesting focus');
                return {
                    ...prev,
                    activeSource: 'youtube',
                    isPaused: false
                };
            }
            
            // If TTS requests focus and nothing is playing
            if (source === 'tts' && prev.activeSource === null) {
                logger.debug('[AUDIO] [AudioPriority] TTS requesting focus (no conflict)');
                return {
                    ...prev,
                    activeSource: 'tts'
                };
            }
            
            return prev;
        });
    }, []);

    const releaseAudioFocus = useCallback((source: AudioSource) => {
        setState(prev => {
            // Only release if the source matches the active source
            if (prev.activeSource === source) {
                logger.debug(`[AUDIO] [AudioPriority] ${source} releasing focus`);
                
                // If TTS is releasing and YouTube was paused, resume it
                if (source === 'tts' && prev.isPaused) {
                    logger.debug('[AUDIO] [AudioPriority] TTS finished, resuming YouTube');
                    
                    // Dispatch event to resume YouTube
                    window.dispatchEvent(new CustomEvent('audio_priority_change', {
                        detail: { action: 'resume_youtube', reason: 'tts_finished' }
                    }));
                    
                    return {
                        ...prev,
                        activeSource: 'youtube',
                        isPaused: false
                    };
                }
                
                // If TTS is releasing and YouTube was ducked, restore volume
                if (source === 'tts' && prev.ttsPreference === 'duck') {
                    logger.debug('[AUDIO] [AudioPriority] TTS finished, restoring YouTube volume');
                    
                    // Dispatch event to restore YouTube volume
                    window.dispatchEvent(new CustomEvent('audio_priority_change', {
                        detail: { action: 'unduck_youtube', reason: 'tts_finished' }
                    }));
                    
                    return {
                        ...prev,
                        activeSource: 'youtube',
                        isPaused: false
                    };
                }
                
                return {
                    ...prev,
                    activeSource: null,
                    isPaused: false
                };
            }
            
            return prev;
        });
    }, []);

    const setTtsPreference = useCallback((preference: 'pause' | 'duck' | 'none') => {
        setState(prev => ({
            ...prev,
            ttsPreference: preference
        }));
        
        // Save preference to localStorage
        localStorage.setItem('audio_priority_preference', preference);
        logger.debug(`[AUDIO] [AudioPriority] TTS preference set to: ${preference}`);
    }, []);

    // Load preference from localStorage on mount
    useEffect(() => {
        const savedPreference = localStorage.getItem('audio_priority_preference') as 'pause' | 'duck' | 'none' | null;
        if (savedPreference) {
            setState(prev => ({
                ...prev,
                ttsPreference: savedPreference
            }));
        }
    }, []);

    const value: AudioPriorityContextValue = {
        ...state,
        requestAudioFocus,
        releaseAudioFocus,
        setTtsPreference
    };

    return (
        <AudioPriorityContext.Provider value={value}>
            {children}
        </AudioPriorityContext.Provider>
    );
};

export const useAudioPriority = (): AudioPriorityContextValue => {
    const context = useContext(AudioPriorityContext);
    if (!context) {
        throw new Error('useAudioPriority must be used within an AudioPriorityProvider');
    }
    return context;
};

export default AudioPriorityContext;
