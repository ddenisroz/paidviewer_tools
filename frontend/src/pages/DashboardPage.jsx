// src/pages/DashboardPage.jsx
import ControlPanel from "../components/ControlPanel";
import VoiceManager from "../components/VoiceManager";
import { useAuth } from "../context/AuthContext";
import { useApi } from "../hooks/useApi"; // Import useApi
import { useNavigate } from "react-router-dom";

export default function DashboardPage() {
    const { logout } = useAuth();
    const navigate = useNavigate();
    const api = useApi(); // Get api instance

    const handleLogout = async () => {
        try {
            // Tell the backend to make the bot leave the channel
            await api.post('/auth/logout');
        } catch (error) {
            console.error("Error during server-side logout:", error);
            // We proceed with client-side logout anyway
        } finally {
            logout(); // Clear token from local storage
            navigate('/login', { replace: true });
        }
    }

    return (
        <div className="container mx-auto p-4">
            <header className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold text-purple-300">TTS_TTV Dashboard</h1>
                <button
                    onClick={handleLogout}
                    className="bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 rounded"
                >
                    Logout
                </button>
            </header>
            <main className="space-y-8">
                <ControlPanel />
                <VoiceManager />
            </main>
        </div>
    );
}
