import React, { useEffect, useState } from 'react';

import { Link, Loader2, Unlink } from 'lucide-react';

import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Label } from '@/shared/components/ui/label';
import { Switch } from '@/shared/components/ui/switch';

interface StreamCardLayoutProps {
    title: string;
    icon: React.ReactNode;
    isLinked: boolean;
    onToggleLink: (value: boolean) => void | Promise<void>;
    bothEnabled: boolean;
    children: React.ReactNode;
    footer?: React.ReactNode;
    className?: string;
}

export const StreamCardLayout: React.FC<StreamCardLayoutProps> = ({
    title,
    icon,
    isLinked,
    onToggleLink,
    bothEnabled,
    children,
    footer,
    className,
}) => {
    const [isLinking, setIsLinking] = useState(false);

    useEffect(() => {
        if (!bothEnabled && isLinking) {
            setIsLinking(false);
        }
    }, [bothEnabled, isLinking]);

    // Handle toggle with cooldown
    const handleLinkToggle = async (value: boolean) => {
        if (isLinking) return;
        setIsLinking(true);
        try {
            await Promise.resolve(onToggleLink(value));
        } finally {
            setIsLinking(false);
        }
    };

    return (
        <Card
            className={cn(
                'flex flex-col overflow-hidden h-full border-border/70 bg-card/90 shadow-sm shadow-black/10 transition-colors duration-200',
                className
            )}
        >
            <CardHeader className="flex-shrink-0 pb-3 border-b border-border/50">
                <CardTitle className="flex items-center gap-2 text-lg font-medium text-foreground">
                    {icon}
                    {title}
                </CardTitle>
            </CardHeader>

            <CardContent className="p-4 flex-1 flex flex-col overflow-visible space-y-4">
                {/* Toggle Link Section */}
                {bothEnabled && (
                    <div className="flex items-center justify-between py-1">
                        <Label
                            htmlFor={`link-toggle-${title}`}
                            className="flex items-center gap-2 cursor-pointer text-sm font-medium select-none text-muted-foreground hover:text-foreground transition-colors"
                        >
                            {isLinking ? (
                                <Loader2 className="h-4 w-4 text-primary animate-spin" />
                            ) : isLinked ? (
                                <Link className="h-4 w-4 text-green-500" />
                            ) : (
                                <Unlink className="h-4 w-4 text-muted-foreground" />
                            )}
                            {isLinked ? 'Поля связаны' : 'Связать поля'}
                        </Label>
                        <div className="flex items-center gap-2">
                            <Switch
                                id={`link-toggle-${title}`}
                                checked={isLinked}
                                onCheckedChange={handleLinkToggle}
                                disabled={isLinking}
                            />
                        </div>
                    </div>
                )}

                {/* Main Content Area */}
                <div className="flex-1 flex flex-col">{children}</div>
            </CardContent>

            {/* Footer / Action Area */}
            {footer && <div className="p-4 pt-0 mt-auto border-t border-transparent">{footer}</div>}
        </Card>
    );
};
