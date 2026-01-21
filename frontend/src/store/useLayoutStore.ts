import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type WidgetId = 'stream-status' | 'stream-management' | 'chat' | 'quick-actions';

export interface WidgetItem {
    id: WidgetId;
    isVisible: boolean;
}

interface LayoutState {
    widgets: WidgetItem[];
    isEditMode: boolean;
    toggleEditMode: () => void;
    moveWidget: (id: WidgetId, direction: 'up' | 'down') => void;
    toggleWidgetVisibility: (id: WidgetId) => void;
    reorderWidgets: (oldIndex: number, newIndex: number) => void;
    resetLayout: () => void;
}

const DEFAULT_WIDGETS: WidgetItem[] = [
    { id: 'stream-status', isVisible: true }, // Usually fixed at top, but let's allow hiding? Maybe not status.
    { id: 'stream-management', isVisible: true },
    { id: 'chat', isVisible: true },
    { id: 'quick-actions', isVisible: true },
];

export const useLayoutStore = create<LayoutState>()(
    persist(
        (set) => ({
            widgets: DEFAULT_WIDGETS,
            isEditMode: false,

            toggleEditMode: () => set((state) => ({ isEditMode: !state.isEditMode })),

            moveWidget: (id, direction) => set((state) => {
                const index = state.widgets.findIndex(w => w.id === id);
                if (index === -1) return state;

                const newWidgets = [...state.widgets];
                if (direction === 'up' && index > 0) {
                    [newWidgets[index - 1], newWidgets[index]] = [newWidgets[index], newWidgets[index - 1]];
                } else if (direction === 'down' && index < newWidgets.length - 1) {
                    [newWidgets[index], newWidgets[index + 1]] = [newWidgets[index + 1], newWidgets[index]];
                }

                return { widgets: newWidgets };
            }),

            toggleWidgetVisibility: (id) => set((state) => ({
                widgets: state.widgets.map(w =>
                    w.id === id ? { ...w, isVisible: !w.isVisible } : w
                )
            })),

            reorderWidgets: (oldIndex, newIndex) => set((state) => {
                const newWidgets = [...state.widgets];
                const [removed] = newWidgets.splice(oldIndex, 1);
                newWidgets.splice(newIndex, 0, removed);
                return { widgets: newWidgets };
            }),

            resetLayout: () => set({ widgets: DEFAULT_WIDGETS })
        }),
        {
            name: 'homepage-layout-storage',
            partialize: (state) => ({ widgets: state.widgets }), // Only persist widgets, not edit mode
        }
    )
);
