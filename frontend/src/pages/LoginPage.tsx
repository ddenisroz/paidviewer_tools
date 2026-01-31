// src/pages/LoginPage.tsx
import React, { useEffect, useState } from 'react';

import { useNavigate } from 'react-router-dom';

import { API_BASE_URL } from '@/constants';
import { useAuth } from '@/context/AuthContext';
import CookieConsent from '@/shared/components/CookieConsent';
import { Card, CardContent, CardHeader } from '@/shared/components/ui/card';
import { logger } from '@/shared/utils/prodLogger';

interface TwitchIconProps {
    className?: string;
}

const TwitchIcon: React.FC<TwitchIconProps> = (props) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        width="20"
        height="20"
        viewBox="0 0 24 24"
        fill="currentColor"
        className={props.className}
    >
        <path d="M2.149 0l-2.149 4.774v16.452h5.71v3.226h4.774l4.774-4.774h3.816l6.657-6.657v-13.021h-23.581zm20.573 12.131l-3.816 3.816h-3.816l-3.816 3.816v-3.816h-4.774v-13.021h16.222v9.205zm-5.71-6.425h2.387v5.71h-2.387v-5.71zm-4.774 0h2.387v5.71h-2.387v-5.71z" />
    </svg>
);

interface VKIconProps {
    className?: string;
}

const VKIcon: React.FC<VKIconProps> = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 20 20" className={props.className}>
        <path fillRule="evenodd" d="M5 7.6c0-1.96 0-2.94.381-3.689a3.5 3.5 0 0 1 1.53-1.53C7.66 2 8.64 2 10.6 2h.52c2.408 0 3.612 0 4.532.469a4.3 4.3 0 0 1 1.88 1.879C18 5.268 18 6.472 18 8.88v2.24c0 2.408 0 3.612-.469 4.532a4.3 4.3 0 0 1-1.879 1.88c-.92.468-2.124.468-4.532.468h-.52c-1.96 0-2.94 0-3.689-.381a3.5 3.5 0 0 1-1.53-1.53C5 15.34 5 14.36 5 12.4V7.6Zm8.607.971c.789.472 1.183.707 1.317 1.012.116.266.116.57 0 .835-.134.306-.528.541-1.317 1.012l-2.088 1.247c-.825.493-1.237.739-1.576.707a1.04 1.04 0 0 1-.741-.42C9 12.688 9 12.207 9 11.247V8.754c0-.96 0-1.44.202-1.716a1.04 1.04 0 0 1 .74-.42c.34-.032.752.214 1.577.706l2.088 1.247ZM3.5 7.881c0-2.41 0-3.613.469-4.533a4.3 4.3 0 0 1 .736-1.033 3.044 3.044 0 0 0-.357.154 4.3 4.3 0 0 0-1.88 1.879C2 5.268 2 6.472 2 8.88v2.24c0 2.408 0 3.612.469 4.532a4.3 4.3 0 0 0 1.879 1.88c.114.057.232.108.357.153a4.299 4.299 0 0 1-.736-1.033c-.469-.92-.469-2.124-.469-4.532V7.88Z" clipRule="evenodd" />
    </svg>
);

const LoginPage: React.FC = () => {
    const { isAuthenticated, isCheckingAuth } = useAuth();
    const navigate = useNavigate();
    const [title, setTitle] = useState<string>('');
    const [isTyping, setIsTyping] = useState<boolean>(true);
    const [subtitleText, setSubtitleText] = useState<string>('');
    const [subtitleVisible, setSubtitleVisible] = useState<boolean>(false);
    const [currentFeatureIndex, setCurrentFeatureIndex] = useState<number>(0);
    const fullTitle = 'Payedviewer tools';
    const features = ['TTS озвучка', 'Медиа запросы', 'Анализ чата'];

    useEffect(() => {
        if (!isCheckingAuth && isAuthenticated) {
            navigate('/dashboard', { replace: true });
        }
    }, [isAuthenticated, isCheckingAuth, navigate]);

    useEffect(() => {
        if (isTyping && title.length < fullTitle.length) {
            const timeoutId = setTimeout(() => {
                setTitle(fullTitle.slice(0, title.length + 1));
            }, 60);
            return () => clearTimeout(timeoutId);
        } else {
            setIsTyping(false);
        }
    }, [title, isTyping]);

    useEffect(() => {
        if (!isTyping) {
            const showFeature = () => {
                setSubtitleText(features[currentFeatureIndex]);
                setSubtitleVisible(true);

                setTimeout(() => {
                    setSubtitleVisible(false);
                    setTimeout(() => {
                        setCurrentFeatureIndex((prev) => (prev + 1) % features.length);
                    }, 500); // Time to fade out
                }, 2500); // Time to show text
            };

            const timeoutId = setTimeout(showFeature, 500);
            return () => clearTimeout(timeoutId);
        }
    }, [isTyping, currentFeatureIndex]);

    const handleLogin = (platform: 'twitch' | 'vk'): void => {
        logger.log(`[LOGIN] Redirecting to ${platform} OAuth`);
        const authUrl = `${API_BASE_URL}/auth/${platform}/login`;
        window.location.href = authUrl;
    };

    // Delay showing the spinner to avoid flickering on fast connections
    const [showSpinner, setShowSpinner] = useState(false);

    useEffect(() => {
        let timeoutId: NodeJS.Timeout;
        if (isCheckingAuth) {
            timeoutId = setTimeout(() => {
                setShowSpinner(true);
            }, 800); // Only show spinner if checking takes longer than 800ms
        } else {
            setShowSpinner(false);
        }
        return () => clearTimeout(timeoutId);
    }, [isCheckingAuth]);

    if (isCheckingAuth) {
        // If we are waiting for the delay, show only the background to prevent jerky transitions
        if (!showSpinner) {
            return (
                <div className="login-page-bg min-h-screen flex items-center justify-center text-white font-sans p-4 relative" />
            );
        }

        return (
            <div className="login-page-bg min-h-screen flex items-center justify-center text-white font-sans p-4 relative">
                <Card className="login-card w-full max-w-sm shadow-2xl h-[280px] flex items-center justify-center animate-fade-in">
                    <CardContent className="flex flex-col items-center gap-3">
                        <div className="relative w-8 h-8">
                            <div className="absolute inset-0 rounded-full border-2 border-green-400/30"></div>
                            <div className="absolute inset-0 rounded-full border-2 border-green-400 border-t-transparent animate-spin"></div>
                        </div>
                        <p className="text-slate-400 text-sm">Проверка...</p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    return (
        <div className="login-page-bg min-h-screen flex items-center justify-center text-white font-sans p-4 relative">

            <Card className="login-card w-full max-w-sm shadow-2xl">
                <CardHeader className="text-center pt-10 pb-4">
                    <h1 className="select-none text-3xl font-bold mb-3 text-green-400 h-10 font-mono tracking-wider">
                        {title}
                        <span className="blinking-cursor">{!isTyping ? '_' : ''}</span>
                    </h1>
                    <div className="relative h-6 w-full">
                        <p className={`text-slate-400 text-sm absolute inset-0 flex items-center justify-center subtitle-fade ${subtitleVisible ? 'opacity-100' : 'opacity-0'}`}>
                            {subtitleText}
                        </p>
                    </div>
                </CardHeader>
                <CardContent className="px-8 pb-8 h-[140px]">
                    <div className="space-y-4 animate-fade-in">
                        <button
                            onClick={() => handleLogin('twitch')}
                            className="w-full bg-[#9146FF] hover:bg-[#7a3adc] text-white font-semibold py-3 px-5 rounded-lg transition-colors duration-300 flex items-center justify-center text-base"
                        >
                            <TwitchIcon className="mr-2 h-5 w-5" />
                            Войти через Twitch
                        </button>

                        <button
                            onClick={() => handleLogin('vk')}
                            className="w-full bg-[#FF4444] hover:bg-[#d93a3a] text-white font-semibold py-3 px-5 rounded-lg transition-colors duration-300 flex items-center justify-center text-base"
                        >
                            <VKIcon className="mr-2 h-5 w-5" />
                            Войти через VK Live
                        </button>
                    </div>
                </CardContent>
            </Card>

            <CookieConsent />
        </div>
    );
};

export default LoginPage;
