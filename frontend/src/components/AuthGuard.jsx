// src/components/AuthGuard.jsx
import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Outlet } from 'react-router-dom';

const AuthGuard = () => {
    const { isAuthenticated, isGuest, isCheckingAuth } = useAuth();
    const location = useLocation();

    // Пока проверяем авторизацию - показываем простой индикатор загрузки
    if (isCheckingAuth || isAuthenticated === null) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-gray-900 to-gray-800">
                <div className="text-center">
                    <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-blue-500 border-r-transparent mb-4"></div>
                    <p className="text-gray-400">Загрузка...</p>
                </div>
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
