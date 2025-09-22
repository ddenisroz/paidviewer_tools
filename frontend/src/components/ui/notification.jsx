// src/components/ui/notification.jsx
import React, { useState, useEffect } from 'react';

const Notification = ({ message, type = 'error', duration = 4000, position = null, onClose }) => {
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        if (message) {
            setIsVisible(true);
            const timer = setTimeout(() => {
                setIsVisible(false);
                setTimeout(() => {
                    if (onClose) onClose();
                }, 300); // Ждем завершения анимации
            }, duration);

            return () => clearTimeout(timer);
        }
    }, [message, duration, onClose]);

    if (!message) return null;

    return (
        <>
            <div 
                className={`fixed z-50 px-4 py-3 rounded-lg shadow-2xl max-w-sm border ${
                    type === 'error' 
                        ? 'bg-red-600 text-white border-red-500' 
                        : type === 'success'
                        ? 'bg-green-600 text-white border-green-500'
                        : type === 'warning'
                        ? 'bg-purple-700 text-white border-purple-500'
                        : 'bg-blue-600 text-white border-blue-500'
                } ${isVisible ? 'animate-slide-in-right' : 'animate-slide-out-right'}`}
                style={{
                    position: 'fixed',
                    ...(position ? {
                        left: `${position.x}px`,
                        top: `${position.y}px`,
                        transform: 'translate(-50%, 0)'
                    } : {
                        right: '16px',
                        bottom: '16px',
                        transform: 'translateY(0)'
                    })
                }}
            >
                <div className="flex items-center">
                    <div className="flex-1">
                        {message}
                    </div>
                </div>
            </div>
            
        </>
    );
};

export default Notification;
