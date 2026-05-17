import React from 'react';

import { useSortable } from '@dnd-kit/sortable';
import { GripVertical } from 'lucide-react';

import { cn } from '@/lib/utils';
import { useLayoutStore, WidgetId } from '@/store/useLayoutStore';

interface WidgetWrapperProps {
    id: WidgetId;
    title?: string;
    children: React.ReactNode;
    className?: string;
}

const WidgetWrapper: React.FC<WidgetWrapperProps> = ({ id, title, children, className }) => {
    const { isEditMode, widgets, draftWidgets } = useLayoutStore();
    const activeWidgets = isEditMode && draftWidgets ? draftWidgets : widgets;
    const widgetState = activeWidgets.find((w) => w.id === id);

    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
        id,
        disabled: !isEditMode,
    });

    const style = {
        // Используем только translate без scale/skew чтобы избежать деформации
        transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
        transition,
        zIndex: isDragging ? 50 : undefined,
    };

    if (!widgetState) return null;

    // If hidden and not in edit mode, don't render
    if (!widgetState.isVisible && !isEditMode) return null;

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={cn(
                'relative',
                className,
                isEditMode && 'p-4 border-2 border-dashed border-white/20 rounded-xl bg-black/20',
                isDragging && 'opacity-90 shadow-xl z-50'
            )}
        >
            {isEditMode && (
                <div className="absolute -top-3 left-4 flex items-center gap-1 bg-gray-900 border border-gray-700 rounded-lg p-1 shadow-xl z-20">
                    {/* Drag handle */}
                    <div
                        {...attributes}
                        {...listeners}
                        className="px-2 py-1 cursor-grab active:cursor-grabbing hover:bg-gray-800 rounded transition-colors"
                    >
                        <GripVertical className="h-4 w-4 text-gray-400" />
                    </div>
                    <div className="h-4 w-px bg-gray-700 mx-1" />
                    <div className="px-2 text-xs font-bold text-gray-400 uppercase tracking-wider">{title || id}</div>
                </div>
            )}

            <div
                className={cn(
                    'transition-all duration-300',
                    isEditMode && !widgetState.isVisible && 'opacity-40 grayscale blur-[1px] pointer-events-none'
                )}
            >
                {children}
            </div>
        </div>
    );
};

export default WidgetWrapper;
