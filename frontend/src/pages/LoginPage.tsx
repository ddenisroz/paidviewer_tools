// src/pages/LoginPage.tsx
import React, { useEffect, useState } from 'react';

import { useLocation, useNavigate } from 'react-router-dom';

import { API_BASE_URL } from '@/constants';
import { useAuth } from '@/context/AuthContext';
import LoginOAuthButtons from '@/features/auth/components/LoginOAuthButtons';
import { type OAuthPlatform, useOAuthAvailability } from '@/features/auth/hooks/useOAuthAvailability';
import { getOAuthErrorMessage } from '@/features/auth/utils/oauthFeedback';
import CookieConsent from '@/shared/components/CookieConsent';
import { Button } from '@/shared/components/ui/button';
import { Card, CardContent, CardHeader } from '@/shared/components/ui/card';
import { Input } from '@/shared/components/ui/input';
import { TypingAnimation } from '@/shared/components/ui/typing-animation';
import { getSafeBackendAuthUrl } from '@/shared/utils/navigationSafety';
import { logger } from '@/shared/utils/prodLogger';
import { authService } from '@/services/api/services/authService';

const LOGIN_TITLE = 'Paidviewer Tools';
const LOGIN_TITLE_TYPING_SPEED_MS = 38;
const LOGIN_FEATURES = ['ИИ TTS озвучка', 'Анализ чата', 'Управление трансляцией'];
const LOGIN_FEATURE_VISIBLE_MS = 2200;
const LOGIN_FEATURE_FADE_MS = 450;
const LOGIN_FEATURE_RESERVE_TEXT = 'Управление трансляцией';

const LoginPage: React.FC = () => {
    const { isAuthenticated, isCheckingAuth, refreshAuthStatus } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const oauthAvailability = useOAuthAvailability();
    const [isTitleTypingFinished, setIsTitleTypingFinished] = useState(false);
    const [subtitleText, setSubtitleText] = useState('');
    const [subtitleVisible, setSubtitleVisible] = useState(false);
    const [currentFeatureIndex, setCurrentFeatureIndex] = useState(0);
    const [devNickname, setDevNickname] = useState('yourchy');
    const [devLoginError, setDevLoginError] = useState('');
    const [isDevLoginLoading, setIsDevLoginLoading] = useState(false);
    const searchParams = new URLSearchParams(location.search);
    const authErrorMessage = getOAuthErrorMessage(searchParams.get('platform'), searchParams.get('auth_error'));
    const hostname = typeof window !== 'undefined' ? window.location.hostname.toLowerCase() : '';
    const showDevLogin = ['localhost', '127.0.0.1'].includes(hostname);

    useEffect(() => {
        if (!isCheckingAuth && isAuthenticated) {
            navigate('/dashboard', { replace: true });
        }
    }, [isAuthenticated, isCheckingAuth, navigate]);

    useEffect(() => {
        const timeoutId = window.setTimeout(
            () => {
                setIsTitleTypingFinished(true);
            },
            LOGIN_TITLE.length * LOGIN_TITLE_TYPING_SPEED_MS + 250
        );

        return () => window.clearTimeout(timeoutId);
    }, []);

    useEffect(() => {
        if (!isTitleTypingFinished) return;

        const activeFeature = LOGIN_FEATURES[currentFeatureIndex];
        setSubtitleText(activeFeature);
        setSubtitleVisible(true);

        const hideTimeoutId = window.setTimeout(() => {
            setSubtitleVisible(false);
        }, LOGIN_FEATURE_VISIBLE_MS);

        const nextFeatureTimeoutId = window.setTimeout(() => {
            setCurrentFeatureIndex((prev) => (prev + 1) % LOGIN_FEATURES.length);
        }, LOGIN_FEATURE_VISIBLE_MS + LOGIN_FEATURE_FADE_MS);

        return () => {
            window.clearTimeout(hideTimeoutId);
            window.clearTimeout(nextFeatureTimeoutId);
        };
    }, [currentFeatureIndex, isTitleTypingFinished]);

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

    const handleDevLogin = async (): Promise<void> => {
        const nickname = devNickname.trim();
        if (!nickname) {
            setDevLoginError('Введите никнейм для входа');
            return;
        }

        setIsDevLoginLoading(true);
        setDevLoginError('');

        try {
            await authService.devLogin(nickname);
            await refreshAuthStatus(true);
            navigate('/dashboard', { replace: true });
        } catch (error: unknown) {
            const detail =
                typeof error === 'object' && error !== null && 'response' in error
                    ? (error as { response?: { data?: { detail?: string } } }).response?.data?.detail
                    : undefined;
            setDevLoginError(detail || 'Не удалось выполнить быстрый вход');
        } finally {
            setIsDevLoginLoading(false);
        }
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
                    <h1 className="brand-wordmark select-none mb-2 flex h-10 items-center justify-center whitespace-nowrap text-[1.7rem] leading-none text-emerald-300 [font-variant-ligatures:none] sm:text-[2.05rem]">
                        <TypingAnimation
                            text={LOGIN_TITLE}
                            speed={LOGIN_TITLE_TYPING_SPEED_MS}
                            cursorChar="|"
                            className="justify-self-center"
                        />
                    </h1>
                    <div className="relative h-6 w-full overflow-hidden">
                        <p className="invisible flex items-center justify-center text-sm" aria-hidden="true">
                            {LOGIN_FEATURE_RESERVE_TEXT}
                        </p>
                        <p
                            className={`subtitle-fade absolute inset-0 flex items-center justify-center text-sm text-slate-400 ${
                                subtitleVisible ? 'opacity-100' : 'opacity-0'
                            }`}
                        >
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
                    {showDevLogin && (
                        <div className="space-y-3 rounded-lg border border-border/70 bg-black/20 px-4 py-4">
                            <div className="space-y-1">
                                <p className="text-sm font-medium text-slate-100">Быстрый локальный вход</p>
                                <p className="text-xs text-slate-400">
                                    Только для тестирования на локальной машине. Введите существующий ник, например
                                    yourchy.
                                </p>
                            </div>
                            <div className="flex flex-col gap-2 sm:flex-row">
                                <Input
                                    value={devNickname}
                                    onChange={(event) => setDevNickname(event.target.value)}
                                    onKeyDown={(event) => {
                                        if (event.key === 'Enter') {
                                            event.preventDefault();
                                            void handleDevLogin();
                                        }
                                    }}
                                    placeholder="yourchy"
                                    autoComplete="username"
                                    className="h-10 border-border/70 bg-background/80"
                                />
                                <Button
                                    type="button"
                                    onClick={() => void handleDevLogin()}
                                    disabled={isDevLoginLoading || !devNickname.trim()}
                                    className="h-10 px-4"
                                >
                                    {isDevLoginLoading ? 'Вход...' : 'Войти'}
                                </Button>
                            </div>
                            {devLoginError && (
                                <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-100">
                                    {devLoginError}
                                </div>
                            )}
                        </div>
                    )}
                </CardContent>
            </Card>

            <CookieConsent />
        </div>
    );
};

export default LoginPage;
