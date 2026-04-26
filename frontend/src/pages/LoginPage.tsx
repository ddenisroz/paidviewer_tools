// src/pages/LoginPage.tsx
import React, { useEffect, useState } from 'react';

import { useLocation, useNavigate } from 'react-router-dom';

import { API_BASE_URL } from '@/constants';
import { useAuth } from '@/context/AuthContext';
import LoginOAuthButtons from '@/features/auth/components/LoginOAuthButtons';
import { type OAuthPlatform, useOAuthAvailability } from '@/features/auth/hooks/useOAuthAvailability';
import { getOAuthErrorMessage } from '@/features/auth/utils/oauthFeedback';
import CookieConsent from '@/shared/components/CookieConsent';
import { Card, CardContent, CardHeader } from '@/shared/components/ui/card';
import { getSafeBackendAuthUrl } from '@/shared/utils/navigationSafety';
import { logger } from '@/shared/utils/prodLogger';

const LOGIN_FEATURES = ['TTS озвучка', 'Медиа запросы', 'Анализ чата'];

const LoginPage: React.FC = () => {
    const { isAuthenticated, isCheckingAuth } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [title, setTitle] = useState<string>('');
    const [isTyping, setIsTyping] = useState<boolean>(true);
    const [subtitleText, setSubtitleText] = useState<string>('');
    const [subtitleVisible, setSubtitleVisible] = useState<boolean>(false);
    const [currentFeatureIndex, setCurrentFeatureIndex] = useState<number>(0);
    const oauthAvailability = useOAuthAvailability();
    const fullTitle = 'Paidviewer_tools';
    const searchParams = new URLSearchParams(location.search);
    const authErrorMessage = getOAuthErrorMessage(searchParams.get('platform'), searchParams.get('auth_error'));

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
                setSubtitleText(LOGIN_FEATURES[currentFeatureIndex]);
                setSubtitleVisible(true);

                setTimeout(() => {
                    setSubtitleVisible(false);
                    setTimeout(() => {
                        setCurrentFeatureIndex((prev) => (prev + 1) % LOGIN_FEATURES.length);
                    }, 500); // Time to fade out
                }, 2500); // Time to show text
            };

            const timeoutId = setTimeout(showFeature, 500);
            return () => clearTimeout(timeoutId);
        }
    }, [isTyping, currentFeatureIndex]);

    const handleLogin = (platform: OAuthPlatform): void => {
        if (!oauthAvailability?.[platform]) {
            logger.log(`[LOGIN] ${platform} OAuth is not available`);
            return;
        }

        logger.log(`[LOGIN] Redirecting to ${platform} OAuth`);
        const authPath = `/auth/${platform}/login`;
        const authUrl = getSafeBackendAuthUrl(API_BASE_URL, authPath);
        if (!authUrl) {
            logger.error('[LOGIN] Blocked unsafe OAuth redirect URL', { platform, API_BASE_URL });
            return;
        }
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
                <Card className="login-card w-full max-w-[28rem] shadow-2xl h-[min(280px,70vh)] flex items-center justify-center animate-fade-in">
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

            <Card className="login-card w-full max-w-[28rem] shadow-2xl">
                <CardHeader className="text-center pt-10 pb-4">
                    <h1 className="brand-wordmark select-none mb-3 h-10 whitespace-nowrap text-[1.7rem] leading-none text-green-400 sm:text-[2.1rem]">
                        {title}
                        {isTyping ? <span className="blinking-cursor" aria-hidden="true">|</span> : null}
                    </h1>
                    <div className="relative h-6 w-full">
                        <p className={`text-slate-400 text-sm absolute inset-0 flex items-center justify-center subtitle-fade ${subtitleVisible ? 'opacity-100' : 'opacity-0'}`}>
                            {subtitleText}
                        </p>
                    </div>
                </CardHeader>
                <CardContent className="px-8 pb-8 space-y-4">
                    {authErrorMessage && (
                        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-100">
                            {authErrorMessage}
                        </div>
                    )}
                    <LoginOAuthButtons availability={oauthAvailability} onLogin={handleLogin} />
                </CardContent>
            </Card>

            <CookieConsent />
        </div>
    );
};

export default LoginPage;
