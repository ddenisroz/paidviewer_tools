// src/components/PermissionGuard.jsx
import React from 'react';
import { useAuth } from '../context/AuthContext';

const PermissionGuard = ({ 
    children, 
    requireAuth = false, 
    requirePlatformToken = false, 
    requireAdmin = false,
    fallback = null 
}) => {
    const { isAuthenticated, isGuest, user } = useAuth();

    // Если требуется авторизация, но пользователь не авторизован
    if (requireAuth && !isAuthenticated) {
        return fallback;
    }

    // Если требуется админ, но пользователь не админ
    if (requireAdmin && (!user || !user.is_admin)) {
        return fallback;
    }

    // Если требуется токен платформы, но пользователь гость
    if (requirePlatformToken && isGuest) {
        return fallback;
    }

    // Если требуется токен платформы, но у пользователя нет интеграций
    if (requirePlatformToken && user && !user.integrations) {
        return fallback;
    }

    return children;
};

export default PermissionGuard;
