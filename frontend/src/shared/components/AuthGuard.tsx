// src/shared/components/AuthGuard.tsx
import React from 'react';

import { Navigate, Outlet, useLocation } from 'react-router-dom';

import { useAuth } from '@/context/AuthContext';

const AuthGuard: React.FC = () => {
    const { isAuthenticated, isCheckingAuth } = useAuth();
    const location = useLocation();

    // Во время проверки авторизации ничего не показываем,
    // чтобы не мешать пользователю заметным preload-экраном.
    if (isCheckingAuth || isAuthenticated === null) {
        return null;
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
