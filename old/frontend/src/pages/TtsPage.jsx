// src/pages/TtsPage.jsx
import React from 'react';
import { Outlet } from 'react-router-dom';

const TtsPage = () => {
    return (
        <div className="flex flex-col h-full">
            <header className="flex items-center justify-between pb-4 border-b">
                <div>
                    <h1 className="text-3xl font-bold mb-6 text-foreground">TTS ИИ озвучка</h1>
                    <p className="text-muted-foreground">Настройте параметры синтеза речи и управляйте голосами.</p>
                </div>
            </header>

            <div className="flex-grow mt-4">
                <Outlet /> {/* Renders TtsMainPage, VoiceManagementPage, or CommandsManagementPage */}
            </div>
        </div>
    );
};

export default TtsPage;