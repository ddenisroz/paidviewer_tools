// src/components/AuthGuard.jsx
import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const AuthGuard = () => {
    const { isAuthenticated, userMode, loading } = useAuth();

    if (loading) {
        // Можно показать здесь полноэкранный лоадер, если нужно
        return (
            <div className="flex items-center justify-center min-h-screen bg-background">
                {/* Можно добавить красивый спиннер */}
                <p>Загрузка...</p>
            </div>
        );
    }

    // Доступ разрешен, если пользователь аутентифицирован ИЛИ находится в гостевом режиме
    const isAllowed = isAuthenticated || userMode === 'guest';

    if (!isAllowed) {
        // Если доступ не разрешен, перенаправляем на страницу входа
        return <Navigate to="/login" replace />;
    }

    // Если доступ разрешен, показываем вложенные роуты (дашборд)
    return <Outlet />;
};

export default AuthGuard;
