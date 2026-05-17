import React from 'react';

import { Card } from '@/shared/components/ui/card';
import { Label } from '@/shared/components/ui/label';
import { Switch } from '@/shared/components/ui/switch';

interface SettingsIntegrationCardProps {
    accentClassName?: string;
    checked: boolean;
    disabled?: boolean;
    iconNode: React.ReactNode;
    label: string;
    onCheckedChange: (checked: boolean) => void | Promise<void>;
    sublabel: string;
}

const SettingsIntegrationCard: React.FC<SettingsIntegrationCardProps> = ({
    accentClassName,
    checked,
    disabled = false,
    iconNode,
    label,
    onCheckedChange,
    sublabel,
}) => (
    <Card className="card-glass flex h-full flex-col justify-between p-4">
        <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
                {iconNode}
                <div className="flex min-w-0 flex-col">
                    <Label className="text-base font-medium text-foreground">{label}</Label>
                    <span className="truncate text-xs text-muted-foreground">{sublabel}</span>
                </div>
            </div>
            <Switch
                checked={checked}
                disabled={disabled}
                onCheckedChange={onCheckedChange}
                className={accentClassName}
            />
        </div>
    </Card>
);

export default SettingsIntegrationCard;
