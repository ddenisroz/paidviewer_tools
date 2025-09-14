// src/context/AuthContext.jsx
import { createContext, useState, useContext, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(localStorage.getItem('token'));
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        const fetchUser = async () => {
            if (token) {
                try {
                    // Добавляем таймаут на запрос
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 секунд
                    
                    const { data } = await api.get('/api/auth/user/me', {
                        signal: controller.signal
                    });
                    clearTimeout(timeoutId);
                    setUser(data);
                } catch (error) {
                    console.error('Failed to fetch user', error);
                    // Clear token if it's invalid or request failed
                    setToken(null);
                    localStorage.removeItem('token');
                }
            }
            setLoading(false);
        };

        fetchUser();
    }, [token]);

    // Слушаем изменения в localStorage для обновления токена
    useEffect(() => {
        const handleStorageChange = (e) => {
            if (e.key === 'token' && e.newValue !== token) {
                setToken(e.newValue);
            }
        };

        window.addEventListener('storage', handleStorageChange);
        return () => window.removeEventListener('storage', handleStorageChange);
    }, [token]);

    const login = (newToken) => {
        setToken(newToken);
        localStorage.setItem('token', newToken);
        // No need to set user here, useEffect will fetch it
        navigate('/dashboard');
    };

    const logout = () => {
        setToken(null);
        setUser(null);
        localStorage.removeItem('token');
        navigate('/login');
    };

    return (
        <AuthContext.Provider value={{ user, token, login, logout, loading }}>
            {loading ? (
                <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-purple-800 text-white">
                    <div className="text-center space-y-6">
                        {/* Spinner */}
                        <div className="relative mx-auto w-16 h-16">
                            <div className="absolute inset-0 border-4 border-white/20 rounded-full"></div>
                            <div className="absolute inset-0 border-4 border-t-white rounded-full animate-spin"></div>
                        </div>
                        
                        {/* Text */}
                        <div className="space-y-2">
                            <h2 className="text-2xl font-bold text-white">Загрузка...</h2>
                            <p className="text-lg text-white/80">Инициализация приложения</p>
                            <div className="flex items-center justify-center space-x-1 text-white/60">
                                <span>•</span>
                                <span className="animate-pulse">Подключение к серверу</span>
                                <span>•</span>
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                children
            )}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
