import { Input } from '@/shared/components/ui/input';
import { Label } from '@/shared/components/ui/label';

interface WidgetSoundUploadProps {
    label: string;
    value?: string;
    disabled?: boolean;
    onFile: (file?: File) => void;
}

export const WidgetSoundUpload: React.FC<WidgetSoundUploadProps> = ({ label, value, disabled, onFile }) => (
    <div className="rounded-lg border border-border/70 bg-background/40 p-4">
        <Label className="text-sm font-medium text-foreground">{label}</Label>
        <div className="mt-3">
            <Input
                type="file"
                accept="audio/*"
                disabled={disabled}
                onChange={(event) => onFile(event.target.files?.[0])}
                className="h-10 border-border/70 bg-background/60"
            />
        </div>
        <p className="mt-2 truncate text-xs text-muted-foreground">{value ? 'Загружен' : 'Не задан'}</p>
    </div>
);
