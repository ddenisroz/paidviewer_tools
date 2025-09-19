// src/context/AuthContext.jsx
import { createContext, useState, useContext, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    // 'auth', 'guest', or null
    const [userMode, setUserMode] = useState(() => localStorage.getItem('userMode') || null);
    const navigate = useNavigate();

    const updateUserMode = (mode) => {
        if (mode) {
            localStorage.setItem('userMode', mode);
        } else {
            localStorage.removeItem('userMode');
        }
        setUserMode(mode);
    };

    const fetchUser = useCallback(async () => {
        const mode = localStorage.getItem('userMode');
        if (mode === 'guest') {
            setUser(null); // В гостевом режиме нет объекта user
            setLoading(false);
            return;
        }
        
        // Если есть сессия, но режим не установлен, считаем что это auth
        if (mode === 'auth' || !mode) {
            try {
                const { data } = await api.get('/api/auth/user/me');
                setUser(data);
                updateUserMode('auth'); // Подтверждаем режим
            } catch (error) {
                setUser(null);
                // Если была ошибка, но режим стоял 'auth', сбрасываем его
                if (mode === 'auth') {
                    updateUserMode(null);
                }
            } finally {
                setLoading(false);
            }
        } else {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchUser();
    }, [fetchUser]);

    const login = () => {
        updateUserMode('auth');
        window.location.href = `${api.defaults.baseURL}/api/auth/twitch/login`;
    };

    const setGuestMode = () => {
        updateUserMode('guest');
        setUser(null); // Убеждаемся, что нет пользователя в гостевом режиме
    };

    const logout = async () => {
        try {
            await api.post('/api/auth/logout');
        } catch (error) {
            console.error('Logout failed on backend:', error);
        } finally {
            setUser(null);
            updateUserMode(null); // Сбрасываем режим
            navigate('/login');
        }
    };
    
    const isAuthenticated = !!user;

    const value = useMemo(() => ({
        user,
        userMode,
        login,
        logout,
        loading,
        isAuthenticated,
        fetchUser,
        setGuestMode
    }), [user, userMode, loading, isAuthenticated, fetchUser]);

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
