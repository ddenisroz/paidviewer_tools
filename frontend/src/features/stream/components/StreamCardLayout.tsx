import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Label } from '@/shared/components/ui/label';
import { Switch } from '@/shared/components/ui/switch';
import { Link, Unlink, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StreamCardLayoutProps {
    title: string;
    icon: React.ReactNode;
    isLinked: boolean;
    onToggleLink: (value: boolean) => void;
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
    className
}) => {
    const [isLinking, setIsLinking] = useState(false);
    const [countdown, setCountdown] = useState(0);

    // Countdown timer effect
    useEffect(() => {
        if (countdown > 0) {
            const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
            return () => clearTimeout(timer);
        } else if (isLinking) {
            setIsLinking(false);
        }
    }, [countdown, isLinking]);

    // Handle toggle with cooldown
    const handleLinkToggle = (value: boolean) => {
        if (isLinking) return;
        setIsLinking(true);
        setCountdown(5);
        onToggleLink(value);
    };

    return (
        <Card className={cn(
            "flex flex-col overflow-hidden h-full card-glass transition-all duration-300",
            className
        )}>
            <CardHeader className="flex-shrink-0 pb-3 border-b border-white/5">
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
                                <Loader2 className="h-4 w-4 text-blue-400 animate-spin" />
                            ) : isLinked ? (
                                <Link className="h-4 w-4 text-green-500" />
                            ) : (
                                <Unlink className="h-4 w-4 text-muted-foreground" />
                            )}
                            {isLinked ? 'Поля связаны' : 'Связать поля'}
                        </Label>
                        <div className="flex items-center gap-2">
                            {countdown > 0 && (
                                <span className="text-xs text-blue-400 font-mono tabular-nums animate-pulse">
                                    {countdown}с
                                </span>
                            )}
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
                <div className="flex-1 flex flex-col">
                    {children}
                </div>
            </CardContent>

            {/* Footer / Action Area */}
            {footer && (
                <div className="p-4 pt-0 mt-auto border-t border-transparent">
                    {footer}
                </div>
            )}
        </Card>
    );
};
