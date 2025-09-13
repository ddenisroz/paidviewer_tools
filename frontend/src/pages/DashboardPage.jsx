// src/pages/DashboardPage.jsx
import { useAuth } from "../context/AuthContext";
import ControlPanel from '../components/ControlPanel';
import VoiceManager from '../components/VoiceManager';
import TtsSettings from '../components/TtsSettings';

export default function DashboardPage() {
    const { user, logout } = useAuth();
    const channelName = user?.login;

    const handleLogout = () => {
        logout();
    };

    return (
        <div className="min-h-screen bg-slate-900 text-white p-8">
            <div className="container mx-auto">
                <header className="flex justify-between items-center mb-8">
                    <h1 className="text-3xl font-bold">TTS Dashboard</h1>
                    <button 
                        onClick={handleLogout} 
                        className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg transition-colors duration-300"
                    >
                        Logout
                    </button>
                </header>
                <main>
                    {channelName ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <ControlPanel channelName={channelName} />
                            <VoiceManager channelName={channelName} />
                            <TtsSettings channelName={channelName} />
                        </div>
                    ) : (
                        <p>Loading user information...</p>
                    )}
                </main>
            </div>
        </div>
    );
}
