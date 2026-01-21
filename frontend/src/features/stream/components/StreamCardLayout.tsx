import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Label } from '@/shared/components/ui/label';
import { Switch } from '@/shared/components/ui/switch';
import { Link, Unlink } from 'lucide-react';
import { cn } from '@/lib/utils'; // Assuming cn utility exists, otherwise will import from where it is

interface StreamCardLayoutProps {
    title: string;
    icon: React.ReactNode;
    isLinked: boolean;
    onToggleLink: (value: boolean) => void;
    bothEnabled: boolean;
    children: React.ReactNode;
    footer?: React.ReactNode;
    className?: string; // Allow custom styles if absolutely needed
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
                    <div className="flex items-center justify-between p-3 bg-secondary/10 rounded-lg hover:bg-secondary/20 transition-colors">
                        <Label
                            htmlFor={`link-toggle-${title}`}
                            className="flex items-center gap-2 cursor-pointer text-sm font-medium select-none text-foreground/90"
                        >
                            {isLinked ? (
                                <Link className="h-4 w-4 text-green-500" />
                            ) : (
                                <Unlink className="h-4 w-4 text-muted-foreground" />
                            )}
                            {isLinked ? 'Поля связаны' : 'Связать поля'}
                        </Label>
                        <Switch
                            id={`link-toggle-${title}`}
                            checked={isLinked}
                            onCheckedChange={onToggleLink}
                        />
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
