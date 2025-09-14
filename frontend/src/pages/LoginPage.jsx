import React, { useState } from 'react';
import { TypingAnimation } from '@/components/ui/typing-animation';
import HiddenAuth from '@/components/HiddenAuth';

const TwitchSvgIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
        <path d="M11.571 4.714h1.714v5.143H11.57zm4.714 0h1.714v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0H6zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714v9.429z" />
    </svg>
);

const VKSvgIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 48 48" fill="currentColor">
        <path d="M0 23.04C0 12.1788 0 6.74826 3.37413 3.37413C6.74826 0 12.1788 0 23.04 0H24.96C35.8212 0 41.2517 0 44.6259 3.37413C48 6.74826 48 12.1788 48 23.04V24.96C48 35.8212 48 41.2517 44.6259 44.6259C41.2517 48 35.8212 48 24.96 48H23.04C12.1788 48 6.74826 48 3.37413 44.6259C0 41.2517 0 35.8212 0 24.96V23.04Z" fill="#0077FF"/>
        <path d="M25.54 34.5801C14.6 34.5801 8.3601 27.0801 8.1001 14.2601H13.5801C13.7601 23.5601 17.8201 27.4601 21.0601 28.4601V14.2601H26.1601V22.1401C29.3401 21.7801 32.6601 18.1401 33.7801 14.2601H38.8801C38.0601 19.1201 34.4601 22.7601 31.8201 24.4201C34.4601 25.8801 38.4601 29.1801 40.1001 34.5801H34.4601C33.2201 30.9401 30.2601 28.0601 26.1601 27.6201V34.5801H25.54Z" fill="white"/>
    </svg>
);


const LoginPage = () => {
    const [isRedirecting, setIsRedirecting] = useState(false);

    const handleTwitchLogin = () => {
        setIsRedirecting(true);
    };

    const handleVkLogin = () => {
        // Временно отключено до настройки VK приложения
        alert('VK авторизация временно недоступна. Используйте Twitch.');
    };

    if (isRedirecting) {
        return <HiddenAuth />;
    }


  return (
        <div className="relative flex items-center justify-center min-h-screen text-foreground p-4">
            {/* Плавно изменяющийся фон */}
            <div className="absolute inset-0" 
                 style={{
                     background: `
                         radial-gradient(circle at 20% 80%, #1e1b4b 0%, transparent 50%),
                         radial-gradient(circle at 80% 20%, #312e81 0%, transparent 50%),
                         radial-gradient(circle at 40% 40%, #3730a3 0%, transparent 50%),
                         linear-gradient(135deg, #0f0f23, #1e1b4b)
                     `,
                     animation: 'smoothFlow 15s ease-in-out infinite'
                 }}></div>

            <style>
                {`
                    @keyframes smoothFlow {
                        0%, 100% {
                            filter: hue-rotate(0deg) brightness(0.8) saturate(1);
                        }
                        50% {
                            filter: hue-rotate(20deg) brightness(0.9) saturate(1.1);
                        }
                    }
                    
                    .card-3d {
                        box-shadow: 
                            0 20px 40px rgba(0, 0, 0, 0.8),
                            0 10px 20px rgba(0, 0, 0, 0.6),
                            0 0 0 1px rgba(255, 255, 255, 0.05) inset;
                        border: 1px solid rgba(255, 255, 255, 0.1);
                        backdrop-filter: blur(20px);
                        transition: all 0.3s ease;
                    }
                    
                    .card-3d:hover {
                        box-shadow: 
                            0 30px 60px rgba(0, 0, 0, 0.9),
                            0 20px 40px rgba(0, 0, 0, 0.7),
                            0 0 0 2px rgba(16, 185, 129, 0.6),
                            0 0 0 4px rgba(16, 185, 129, 0.2);
                        border: 1px solid rgba(16, 185, 129, 0.8);
                    }
                    
                    .title-glow {
                        color: #10b981;
                        text-shadow: 
                            0 0 15px rgba(16, 185, 129, 0.8),
                            0 0 30px rgba(52, 211, 153, 0.4),
                            0 0 45px rgba(110, 231, 183, 0.2);
                        font-family: 'JetBrains Mono', 'Fira Code', 'Consolas', monospace;
                        letter-spacing: 0.08em;
                        font-weight: 800;
                        filter: drop-shadow(0 0 10px rgba(16, 185, 129, 0.3));
                    }
                    
                    .subtitle {
                        font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
                        letter-spacing: -0.01em;
                        color: #e2e8f0;
                    }
                    
                    .alpha-badge {
                        font-family: 'JetBrains Mono', 'Fira Code', monospace;
                        letter-spacing: 0.05em;
                        color: #94a3b8;
                    }
                    
                    .card-3d button {
                        transition: all 0.2s ease;
                    }
                    
                    .card-3d button:hover {
                        transform: translateY(-1px);
                        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.3);
                    }
                    
                    .card-3d:hover {
                        box-shadow: 
                            0 10px 20px rgba(0, 0, 0, 0.8),
                            0 5px 10px rgba(0, 0, 0, 0.6),
                            0 0 0 1px rgba(255, 255, 255, 0.1) inset,
                            0 0 30px rgba(139, 92, 246, 0.2),
                            0 0 60px rgba(139, 92, 246, 0.1),
                            0 0 90px rgba(139, 92, 246, 0.05),
                            inset 0 2px 4px rgba(0, 0, 0, 0.3);
                    }
                `}
            </style>

            {/* Карточка авторизации */}
            <div 
                className="relative z-10 text-center p-8 md:p-10 bg-slate-900/95 rounded-3xl max-w-md w-full mx-4 card-3d animate-in fade-in-0 slide-in-from-bottom-4 duration-1000"
            >
                <div className="mb-6">
                    <h1 className="text-2xl md:text-3xl font-bold mb-2 title-glow break-all">
                        <TypingAnimation 
                            text="PAYEDVIEWER_TOOLS" 
                            speed={100}
                            className="block font-mono"
                            showCursor={true}
                        />
                    </h1>
                    <div className="h-1 w-24 bg-gradient-to-r from-green-400 to-green-600 mx-auto rounded-full"></div>
          </div>
                
                <div>
                    <p className="text-xl font-semibold mb-3 subtitle">TTS/Media/Chat Bot для стрима</p>
                    <p className="text-sm mb-8 alpha-badge">[ ALPHA VERSION FOR TESTING ]</p>
          </div>

                <div className="flex flex-col gap-4">
        <button
                        onClick={handleTwitchLogin}
                        className="group flex items-center justify-center gap-3 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white font-bold py-4 px-6 rounded-xl transition-all duration-300 w-full text-base md:text-lg hover:shadow-2xl border-2 border-purple-500/50 hover:border-purple-400/70"
                    >
                        <TwitchSvgIcon className="group-hover:scale-110 transition-transform duration-300" />
                        <span className="flex-1 text-center">Войти через Twitch</span>
                    </button>
                    <button
                        onClick={handleVkLogin}
                        className="flex items-center justify-center gap-3 bg-slate-700/30 text-slate-500 font-bold py-4 px-6 rounded-xl w-full text-base md:text-lg border-2 border-slate-600/30 cursor-not-allowed opacity-60"
                        disabled
                    >
                        <VKSvgIcon />
                        <span className="flex-1 text-center">Войти через VK Video (скоро)</span>
        </button>
                </div>
                
                {/* Футер */}
                <div className="mt-8 pt-4 border-t border-slate-700/50">
                    <p className="text-xs text-slate-500 text-center">
                        Полностью сделано ИИ 🤖
                    </p>
                </div>
      </div>
    </div>
  );
};

export default LoginPage;
