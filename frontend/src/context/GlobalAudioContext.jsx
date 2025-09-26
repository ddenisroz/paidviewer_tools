import React, { createContext, useContext, useRef, useState, useEffect } from 'react';
import api from '@/lib/api';

const GlobalAudioContext = createContext();

export const useGlobalAudio = () => {
    const context = useContext(GlobalAudioContext);
    if (!context) {
        throw new Error('useGlobalAudio must be used within a GlobalAudioProvider');
    }
    return context;
};

export const GlobalAudioProvider = ({ children }) => {
    const [currentAudio, setCurrentAudio] = useState(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [volume, setVolume] = useState(50);
    const [isMuted, setIsMuted] = useState(false);
    const [audioType, setAudioType] = useState(null); // 'tts', 'youtube', 'other'
    
    const audioRef = useRef(null);
    const ttsAudioRef = useRef(null);
    const youtubeAudioRef = useRef(null);

    // Инициализация аудио элементов
    useEffect(() => {
        if (!audioRef.current) {
            audioRef.current = new Audio();
            audioRef.current.preload = 'auto';
            audioRef.current.volume = volume / 100;
        }
        
        if (!ttsAudioRef.current) {
            ttsAudioRef.current = new Audio();
            ttsAudioRef.current.preload = 'auto';
            ttsAudioRef.current.volume = volume / 100;
        }
        
        if (!youtubeAudioRef.current) {
            youtubeAudioRef.current = new Audio();
            youtubeAudioRef.current.preload = 'auto';
            youtubeAudioRef.current.volume = volume / 100;
        }
    }, []);

    // Обработка изменения громкости
    useEffect(() => {
        const newVolume = isMuted ? 0 : volume / 100;
        
        if (audioRef.current) audioRef.current.volume = newVolume;
        if (ttsAudioRef.current) ttsAudioRef.current.volume = newVolume;
        if (youtubeAudioRef.current) youtubeAudioRef.current.volume = newVolume;
    }, [volume, isMuted]);

    // Воспроизведение TTS
    const playTTS = async (text, voice = null) => {
        try {
            // Останавливаем текущее воспроизведение
            stopAllAudio();
            
            const response = await api.post('/api/tts/speak', {
                text,
                voice,
                format: 'audio'
            });
            
            if (response.data.audio_url) {
                const audio = ttsAudioRef.current;
                audio.src = response.data.audio_url;
                audio.onplay = () => {
                    setIsPlaying(true);
                    setAudioType('tts');
                    setCurrentAudio({ text, voice, type: 'tts' });
                };
                audio.onended = () => {
                    setIsPlaying(false);
                    setCurrentAudio(null);
                    setAudioType(null);
                };
                audio.onerror = () => {
                    setIsPlaying(false);
                    setCurrentAudio(null);
                    setAudioType(null);
                };
                
                await audio.play();
            }
        } catch (error) {
            console.error('Error playing TTS:', error);
        }
    };

    // Воспроизведение YouTube аудио
    const playYouTube = async (videoId, title = '') => {
        try {
            // Останавливаем текущее воспроизведение
            stopAllAudio();
            
            const audio = youtubeAudioRef.current;
            // Здесь можно использовать YouTube API для получения аудио URL
            // Пока используем заглушку
            audio.src = `https://www.youtube.com/watch?v=${videoId}`;
            audio.onplay = () => {
                setIsPlaying(true);
                setAudioType('youtube');
                setCurrentAudio({ videoId, title, type: 'youtube' });
            };
            audio.onended = () => {
                setIsPlaying(false);
                setCurrentAudio(null);
                setAudioType(null);
            };
            audio.onerror = () => {
                setIsPlaying(false);
                setCurrentAudio(null);
                setAudioType(null);
            };
            
            await audio.play();
        } catch (error) {
            console.error('Error playing YouTube audio:', error);
        }
    };

    // Воспроизведение произвольного аудио
    const playAudio = async (audioUrl, metadata = {}) => {
        try {
            // Останавливаем текущее воспроизведение
            stopAllAudio();
            
            const audio = audioRef.current;
            audio.src = audioUrl;
            audio.onplay = () => {
                setIsPlaying(true);
                setAudioType('other');
                setCurrentAudio({ ...metadata, type: 'other' });
            };
            audio.onended = () => {
                setIsPlaying(false);
                setCurrentAudio(null);
                setAudioType(null);
            };
            audio.onerror = () => {
                setIsPlaying(false);
                setCurrentAudio(null);
                setAudioType(null);
            };
            
            await audio.play();
        } catch (error) {
            console.error('Error playing audio:', error);
        }
    };

    // Остановка всех аудио
    const stopAllAudio = () => {
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
        }
        if (ttsAudioRef.current) {
            ttsAudioRef.current.pause();
            ttsAudioRef.current.currentTime = 0;
        }
        if (youtubeAudioRef.current) {
            youtubeAudioRef.current.pause();
            youtubeAudioRef.current.currentTime = 0;
        }
        setIsPlaying(false);
        setCurrentAudio(null);
        setAudioType(null);
    };

    // Пауза/возобновление
    const togglePlayPause = () => {
        const activeAudio = getActiveAudio();
        if (activeAudio) {
            if (isPlaying) {
                activeAudio.pause();
                setIsPlaying(false);
            } else {
                activeAudio.play();
                setIsPlaying(true);
            }
        }
    };

    // Получение активного аудио элемента
    const getActiveAudio = () => {
        switch (audioType) {
            case 'tts':
                return ttsAudioRef.current;
            case 'youtube':
                return youtubeAudioRef.current;
            case 'other':
                return audioRef.current;
            default:
                return null;
        }
    };

    // Изменение громкости
    const setVolumeLevel = (newVolume) => {
        setVolume(newVolume);
        setIsMuted(false);
    };

    // Переключение отключения звука
    const toggleMute = () => {
        setIsMuted(!isMuted);
    };

    const value = {
        // Состояние
        currentAudio,
        isPlaying,
        volume,
        isMuted,
        audioType,
        
        // Методы
        playTTS,
        playYouTube,
        playAudio,
        stopAllAudio,
        togglePlayPause,
        setVolumeLevel,
        toggleMute,
        
        // Ссылки на аудио элементы (для прямого доступа если нужно)
        audioRef,
        ttsAudioRef,
        youtubeAudioRef
    };

    return (
        <GlobalAudioContext.Provider value={value}>
            {children}
        </GlobalAudioContext.Provider>
    );
};
