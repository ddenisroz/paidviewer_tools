// src/shared/components/PermissionGuard.tsx
import React, { ReactNode } from 'react';

import { useAuth } from '@/context/AuthContext';

interface PermissionGuardProps {
    children: ReactNode;
    requireAuth?: boolean;
    requirePlatformToken?: boolean;
    requireAdmin?: boolean;
    fallback?: ReactNode;
}

const PermissionGuard: React.FC<PermissionGuardProps> = ({
    children,
    requireAuth = false,
    requirePlatformToken = false,
    requireAdmin = false,
    fallback = null,
}) => {
    const { isAuthenticated, user } = useAuth();
    const isAdmin = user?.role === 'admin' || user?.is_admin === true;

    // Если требуется авторизация, но пользователь не авторизован
    if (requireAuth && !isAuthenticated) {
        return <>{fallback}</>;
    }

    // Если требуется админ, но пользователь не админ
    if (requireAdmin && (!user || !isAdmin)) {
        return <>{fallback}</>;
    }

    // Если требуется токен платформы, но у пользователя нет интеграций
    if (requirePlatformToken && user && !user.integrations) {
        return <>{fallback}</>;
    }

    return <>{children}</>;
};

export default PermissionGuard;
