import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '../context/AuthContext';
import { chatService } from '../services/api/services/chatService';
import { logger } from '../utils/prodLogger';

const GuestPage: React.FC = () => {
    const navigate = useNavigate();
    const { setGuestMode } = useAuth();
    const [channelName, setChannelName] = useState<string>('');
    const [isConnecting, setIsConnecting] = useState<boolean>(false);
    const [verificationCode, setVerificationCode] = useState<string>('');
    const [platform, setPlatform] = useState<'twitch' | 'vk'>('twitch');
    const [isWaitingConfirmation, setIsWaitingConfirmation] = useState<boolean>(false);
    const [remainingSeconds, setRemainingSeconds] = useState<number>(60);

    const checkConfirmation = useCallback(async (): Promise<void> => {
        try {
            const response = await chatService.checkGuest({
                channel_name: channelName
            });

            if ((response.data as any).confirmed) {
                setIsWaitingConfirmation(false);
                toast.success('Код подтвержден владельцем канала!');
                
                try {
                    await chatService.finalizeGuest({
                        channel_name: channelName
                    });
                    
                    await setGuestMode({
                        username: `guest_${channelName}`,
                        channel: channelName,
                        platform: platform
                    });
                    
                    toast.success(`Добро пожаловать в гостевой режим канала ${channelName}!`);
                    navigate('/');
                } catch (finalizeError: any) {
                    logger.error('Error finalizing guest session:', finalizeError);
                    toast.error('Ошибка создания гостевой сессии');
                }
            } else if ((response.data as any).error === 'Verification code expired') {
                setIsWaitingConfirmation(false);
                setVerificationCode('');
                toast.error('Код истек. Попробуйте снова.');
            } else {
                if ((response.data as any).remaining_seconds) {
                    setRemainingSeconds((response.data as any).remaining_seconds);
                }
            }
        } catch (error) {
            logger.error('Error checking confirmation:', error);
        }
    }, [channelName, platform, setGuestMode, navigate]);

    useEffect(() => {
        if (!isWaitingConfirmation) return;

        const pollInterval = setInterval(checkConfirmation, 2000);

        return () => clearInterval(pollInterval);
    }, [isWaitingConfirmation, checkConfirmation]);

    const handleConnect = async (): Promise<void> => {
        if (!channelName.trim()) {
            toast.error('Введите имя канала');
            return;
        }

        try {
            setIsConnecting(true);
            const response = await chatService.connectGuest({
                channel_name: channelName.trim(),
                platform: platform
            });
            
            if ((response.data as any).success) {
                setVerificationCode((response.data as any).verification_code);
                setRemainingSeconds((response.data as any).expires_in_seconds || 60);
                setIsWaitingConfirmation(true);
                toast.success(`Попросите владельца канала написать код ${(response.data as any).verification_code} в чат на ${platform === 'twitch' ? 'Twitch' : 'VK Live'}`);
            } else {
                toast.error((response.data as any).message || 'Ошибка подключения');
            }
        } catch (error: any) {
            logger.error('Error connecting to channel:', error);
            const errorMessage = error.response?.data?.detail || 'Ошибка подключения к каналу';
            toast.error(errorMessage);
        } finally {
            setIsConnecting(false);
        }
    };

    const handleCancel = (): void => {
        setVerificationCode('');
        setIsWaitingConfirmation(false);
        setRemainingSeconds(60);
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground">
            <h1 className="text-4xl font-bold mb-8">Гостевой режим</h1>
            <div className="w-full max-w-md p-8 space-y-6 bg-card rounded-lg shadow-lg">
                <p className="text-center text-card-foreground">
                    Введите имя канала Twitch или VK Live для подключения TTS в гостевом режиме.
                </p>
                
                {!verificationCode ? (
                    <>
                        <div className="space-y-3">
                            <label className="text-sm font-medium text-card-foreground">
                                Выберите платформу:
                            </label>
                            <div className="flex gap-4">
                                <label className="flex items-center space-x-3 cursor-pointer">
                                    <input
                                        type="radio"
                                        name="platform"
                                        value="twitch"
                                        checked={platform === 'twitch'}
                                        onChange={(e) => setPlatform(e.target.value as 'twitch' | 'vk')}
                                        disabled={isConnecting}
                                        className="w-5 h-5 text-primary focus:ring-2 focus:ring-primary disabled:opacity-50"
                                    />
                                    <span className="text-lg font-medium text-[#9146FF]">Twitch</span>
                                </label>
                                <label className="flex items-center space-x-3 cursor-pointer">
                                    <input
                                        type="radio"
                                        name="platform"
                                        value="vk"
                                        checked={platform === 'vk'}
                                        onChange={(e) => setPlatform(e.target.value as 'twitch' | 'vk')}
                                        disabled={isConnecting}
                                        className="w-5 h-5 text-primary focus:ring-2 focus:ring-primary disabled:opacity-50"
                                    />
                                    <span className="text-lg font-medium text-[#FF0000]">VK Live</span>
                                </label>
                            </div>
                        </div>
                        
                        <input
                            type="text"
                            placeholder={platform === 'twitch' ? 'Имя канала (например: yourchy)' : 'Имя канала или ID (например: yourchy или 123456)'}
                            value={channelName}
                            onChange={(e) => setChannelName(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && handleConnect()}
                            disabled={isConnecting}
                            className="w-full px-4 py-2 text-lg bg-input border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
                        />
                        <button
                            onClick={handleConnect}
                            disabled={isConnecting}
                            className="w-full px-4 py-2 font-bold text-white bg-primary rounded-md hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50 transition-colors"
                        >
                            {isConnecting ? 'Подключение...' : 'Получить код доступа'}
                        </button>
                    </>
                ) : (
                    <>
                        <div className="space-y-4">
                            <div className="text-center">
                                <p className="text-sm text-muted-foreground mb-2">
                                    Попросите владельца канала <strong className="text-foreground">{channelName}</strong> написать этот код в чат:
                                </p>
                                <div className="bg-primary/10 border-2 border-primary rounded-lg p-6 my-4">
                                    <p className="text-5xl font-mono font-bold text-primary tracking-wider">
                                        {verificationCode}
                                    </p>
                                </div>
                                {isWaitingConfirmation && (
                                    <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                                        <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full"></div>
                                        <span>Ожидание подтверждения... ({remainingSeconds}с)</span>
                                    </div>
                                )}
                            </div>
                            
                            <div className="bg-muted/30 rounded-lg p-4">
                                <p className="text-xs text-muted-foreground">
                                    <strong>Инструкция:</strong> Владелец канала должен написать код <code className="bg-background px-1 rounded">{verificationCode}</code> в свой чат на платформе <strong>{platform === 'twitch' ? 'Twitch' : 'VK Live'}</strong>. 
                                    После подтверждения вы автоматически подключитесь.
                                </p>
                            </div>
                            
                            <button
                                onClick={handleCancel}
                                className="w-full px-4 py-2 font-bold text-foreground bg-muted rounded-md hover:bg-muted/80 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-muted transition-colors"
                            >
                                Отмена
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default GuestPage;

