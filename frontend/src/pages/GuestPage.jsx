import React from 'react';

const GuestPage = () => {
    // TODO: Implement guest logic here
    // This will likely involve:
    // - State for channel name input
    // - A function to call the backend's /api/chat/guest/connect endpoint
    // - UI to show verification code and status

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground">
            <h1 className="text-4xl font-bold mb-8">Гостевой режим</h1>
            <div className="w-full max-w-md p-8 space-y-6 bg-card rounded-lg shadow-lg">
                <p className="text-center text-card-foreground">
                    Введите имя канала Twitch или VK Live, к чату которого вы хотите подключить TTS.
                </p>
                {/* Input for channel name */}
                <input
                    type="text"
                    placeholder="Имя канала"
                    className="w-full px-4 py-2 text-lg bg-input border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                />
                {/* Connect button */}
                <button
                    className="w-full px-4 py-2 font-bold text-white bg-primary rounded-md hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary"
                >
                    Подключиться
                </button>
            </div>
        </div>
    );
};

export default GuestPage;
