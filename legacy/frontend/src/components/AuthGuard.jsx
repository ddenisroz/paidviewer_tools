// src/components/AuthGuard.jsx
import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Outlet } from 'react-router-dom';

const AuthGuard = () => {
    const { isAuthenticated, isGuest, isCheckingAuth } = useAuth();
    const location = useLocation();

    // Пока проверяем авторизацию - показываем только фон без видимых элементов
    if (isCheckingAuth || isAuthenticated === null) {
        return (
            <div style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'hsl(260, 30%, 8%)',
                zIndex: 9999
            }}>
                {/* Invisible loading - no spinners, no text */}
            </div>
        );
    }

    // Если не авторизован - перенаправляем на логин
    if (!isAuthenticated) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    // Гость и авторизованный пользователь попадают в MainApp
    // Ограничения по функционалу проверяются в компонентах
    return <Outlet />;
};

export default AuthGuard;
