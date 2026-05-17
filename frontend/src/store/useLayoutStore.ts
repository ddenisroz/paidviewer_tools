import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type WidgetId = 'stream-status' | 'stream-management' | 'chat' | 'quick-actions';

export interface WidgetItem {
    id: WidgetId;
    isVisible: boolean;
}

interface LayoutState {
    widgets: WidgetItem[];
    draftWidgets: WidgetItem[] | null;
    isEditMode: boolean;
    startEditMode: () => void;
    saveLayout: () => void;
    cancelEditMode: () => void;
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
            draftWidgets: null,
            isEditMode: false,

            startEditMode: () =>
                set((state) => ({
                    isEditMode: true,
                    draftWidgets: state.widgets.map((widget) => ({ ...widget })),
                })),

            saveLayout: () =>
                set((state) => ({
                    widgets: state.draftWidgets ? state.draftWidgets.map((widget) => ({ ...widget })) : state.widgets,
                    isEditMode: false,
                    draftWidgets: null,
                })),

            cancelEditMode: () =>
                set(() => ({
                    isEditMode: false,
                    draftWidgets: null,
                })),

            toggleEditMode: () =>
                set((state) => {
                    if (state.isEditMode) {
                        return {
                            widgets: state.draftWidgets
                                ? state.draftWidgets.map((widget) => ({ ...widget }))
                                : state.widgets,
                            isEditMode: false,
                            draftWidgets: null,
                        };
                    }

                    return {
                        isEditMode: true,
                        draftWidgets: state.widgets.map((widget) => ({ ...widget })),
                    };
                }),

            moveWidget: (id, direction) =>
                set((state) => {
                    const targetWidgets = state.isEditMode ? state.draftWidgets || state.widgets : state.widgets;
                    const index = targetWidgets.findIndex((w) => w.id === id);
                    if (index === -1) return state;

                    const newWidgets = [...targetWidgets];
                    if (direction === 'up' && index > 0) {
                        [newWidgets[index - 1], newWidgets[index]] = [newWidgets[index], newWidgets[index - 1]];
                    } else if (direction === 'down' && index < newWidgets.length - 1) {
                        [newWidgets[index], newWidgets[index + 1]] = [newWidgets[index + 1], newWidgets[index]];
                    }

                    return state.isEditMode ? { draftWidgets: newWidgets } : { widgets: newWidgets };
                }),

            toggleWidgetVisibility: (id) =>
                set((state) => {
                    const targetWidgets = state.isEditMode ? state.draftWidgets || state.widgets : state.widgets;
                    const updatedWidgets = targetWidgets.map((w) =>
                        w.id === id ? { ...w, isVisible: !w.isVisible } : w
                    );

                    return state.isEditMode ? { draftWidgets: updatedWidgets } : { widgets: updatedWidgets };
                }),

            reorderWidgets: (oldIndex, newIndex) =>
                set((state) => {
                    const targetWidgets = state.isEditMode ? state.draftWidgets || state.widgets : state.widgets;
                    const newWidgets = [...targetWidgets];
                    const [removed] = newWidgets.splice(oldIndex, 1);
                    newWidgets.splice(newIndex, 0, removed);
                    return state.isEditMode ? { draftWidgets: newWidgets } : { widgets: newWidgets };
                }),

            resetLayout: () =>
                set((state) =>
                    state.isEditMode
                        ? { draftWidgets: DEFAULT_WIDGETS.map((widget) => ({ ...widget })) }
                        : { widgets: DEFAULT_WIDGETS.map((widget) => ({ ...widget })) }
                ),
        }),
        {
            name: 'homepage-layout-storage',
            partialize: (state) => ({ widgets: state.widgets }), // Only persist widgets, not edit mode
        }
    )
);
