/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState } from 'react';

interface WidgetLayoutContextType {
    isEditMode: boolean;
    toggleEditMode: () => void;
    setEditMode: (value: boolean) => void;
}

const WidgetLayoutContext = createContext<WidgetLayoutContextType | undefined>(undefined);

export const WidgetLayoutProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [isEditMode, setIsEditMode] = useState(false);

    const toggleEditMode = () => setIsEditMode((prev) => !prev);
    const setEditMode = (value: boolean) => setIsEditMode(value);

    return (
        <WidgetLayoutContext.Provider value={{ isEditMode, toggleEditMode, setEditMode }}>
            {children}
        </WidgetLayoutContext.Provider>
    );
};

export const useWidgetLayout = () => {
    const context = useContext(WidgetLayoutContext);
    if (!context) {
        throw new Error('useWidgetLayout must be used within a WidgetLayoutProvider');
    }
    return context;
};
