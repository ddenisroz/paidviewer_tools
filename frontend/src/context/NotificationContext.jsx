// src/context/NotificationContext.jsx
import React, { createContext, useState, useContext, useRef, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import Notification from '../components/ui/notification';

const NotificationContext = createContext();

export const useNotification = () => {
    const context = useContext(NotificationContext);
    if (!context) {
        throw new Error('useNotification must be used within a NotificationProvider');
    }
    return context;
};

export const NotificationProvider = ({ children }) => {
    const [notification, setNotification] = useState(null);
    const timeoutRef = useRef(null);
    const lastNotificationRef = useRef(null);
    const location = useLocation();

    const showNotification = (message, type = 'error', duration = 4000, position = null) => {
        // Создаем уникальный ключ для уведомления
        const notificationKey = `${message}-${type}-${position?.x}-${position?.y}`;
        
        // Если это то же уведомление, что и последнее, игнорируем
        if (lastNotificationRef.current === notificationKey) {
            console.log('NotificationContext: Ignoring duplicate notification');
            return;
        }
        
        // Очищаем предыдущий таймаут
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }
        
        // Устанавливаем новое уведомление
        setNotification({ message, type, duration, position });
        lastNotificationRef.current = notificationKey;
        
        // Устанавливаем таймаут для сброса последнего уведомления
        timeoutRef.current = setTimeout(() => {
            lastNotificationRef.current = null;
        }, 1000); // 1 секунда дебаунса
    };

    const hideNotification = () => {
        setNotification(null);
    };

    // Скрываем уведомления при смене страниц
    useEffect(() => {
        if (notification) {
            setNotification(null);
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        }
    }, [location.pathname]);

    // Очищаем таймаут при размонтировании
    useEffect(() => {
        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, []);

    const value = {
        showNotification,
        hideNotification
    };

    return (
        <NotificationContext.Provider value={value}>
            {children}
            <Notification 
                message={notification?.message}
                type={notification?.type}
                duration={notification?.duration}
                position={notification?.position}
                onClose={hideNotification}
            />
        </NotificationContext.Provider>
    );
};
