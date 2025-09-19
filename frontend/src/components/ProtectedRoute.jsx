// src/components/ProtectedRoute.jsx
import React, { useState, useEffect } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const ProtectedRoute = () => {
    const { token, loading, isAuthenticated } = useAuth();
    const [hasLogged, setHasLogged] = useState(false);

    // Дебаунс для логирования
    useEffect(() => {
        const timer = setTimeout(() => {
            if (!hasLogged) {
                console.log('🔒 ProtectedRoute проверка:', { token, loading, isAuthenticated });
                setHasLogged(true);
            }
        }, 1000);

        return () => clearTimeout(timer);
    }, [token, loading, isAuthenticated, hasLogged]);

    if (loading) {
        return <div>Загрузка...</div>; // Or a spinner component
    }

    if (!isAuthenticated) {
        return <Navigate to="/login" replace />;
    }

    return <Outlet />;
};

export default ProtectedRoute;
