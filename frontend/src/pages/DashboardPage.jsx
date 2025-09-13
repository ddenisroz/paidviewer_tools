// src/pages/DashboardPage.jsx
import { useAuth } from "../context/AuthContext";

export default function DashboardPage() {
    const { logout } = useAuth();

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
                    <p>Welcome to your dashboard!</p>
                </main>
            </div>
        </div>
    );
}
