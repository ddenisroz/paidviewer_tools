/**
 * Username Input Component with validation
 */
import React, { useEffect, useState } from 'react';

import { AlertCircle, CheckCircle2, Loader2, XCircle } from 'lucide-react';

import { cancelUsernameCheck, debouncedUsernameCheck, validateUsernameFormat } from '@/shared/utils/usernameValidation';

import { Input } from './input';
import { Label } from './label';

interface UsernameInputProps {
    value: string;
    onChange: (value: string) => void;
    label?: string;
    placeholder?: string;
    required?: boolean;
    disabled?: boolean;
    className?: string;
    showValidation?: boolean;
    onValidationChange?: (isValid: boolean) => void;
}

const useUsernameValidation = (value: string, onValidationChange?: (isValid: boolean) => void) => {
    const [checking, setChecking] = useState(false);
    const [error, setError] = useState<string | undefined>();
    const [available, setAvailable] = useState<boolean | undefined>();

    useEffect(() => {
        if (!value || value.trim().length === 0) {
            setError(undefined);
            setAvailable(undefined);
            setChecking(false);
            onValidationChange?.(false);
            return;
        }

        // Локальная валидация
        const formatCheck = validateUsernameFormat(value);
        if (!formatCheck.valid) {
            setError(formatCheck.error);
            setAvailable(false);
            setChecking(false);
            onValidationChange?.(false);
            return;
        }

        // Проверка на сервере с debounce
        setChecking(true);
        setError(undefined);

        debouncedUsernameCheck(value, (result) => {
            setAvailable(result.available);
            setError(result.error);
            setChecking(false);
            onValidationChange?.(result.available);
        });

        return () => {
            cancelUsernameCheck();
        };
    }, [value, onValidationChange]);

    return { checking, error, available };
};

const ValidationIcon: React.FC<{
    checking: boolean;
    error?: string;
    available?: boolean;
}> = ({ checking, error, available }) => {
    if (checking) return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
    if (error) return <XCircle className="h-4 w-4 text-red-500" />;
    if (available) return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    return null;
};

const ValidationMessage: React.FC<{
    checking: boolean;
    error?: string;
    available?: boolean;
}> = ({ checking, error, available }) => {
    if (checking) {
        return (
            <p className="text-xs text-blue-500 flex items-center gap-1 mt-1">
                <Loader2 className="h-3 w-3 animate-spin" />
                Проверка доступности...
            </p>
        );
    }
    if (error) {
        return (
            <p className="text-xs text-red-500 flex items-center gap-1 mt-1">
                <AlertCircle className="h-3 w-3" />
                {error}
            </p>
        );
    }
    if (available) {
        return (
            <p className="text-xs text-green-500 flex items-center gap-1 mt-1">
                <CheckCircle2 className="h-3 w-3" />
                Никнейм доступен
            </p>
        );
    }
    return null;
};

export const UsernameInput: React.FC<UsernameInputProps> = ({
    value,
    onChange,
    label = 'Никнейм',
    placeholder = 'Введите никнейм',
    required = false,
    disabled = false,
    className = '',
    showValidation = true,
    onValidationChange,
}) => {
    const { checking, error, available } = useUsernameValidation(value, onValidationChange);
    const showDetailValidations = showValidation && !(!value || value.trim().length === 0);

    return (
        <div className={`space-y-2 ${className}`}>
            {label && (
                <Label htmlFor="username">
                    {label}
                    {required && <span className="text-red-500 ml-1">*</span>}
                </Label>
            )}
            <div className="relative">
                <Input
                    id="username"
                    type="text"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={placeholder}
                    disabled={disabled}
                    required={required}
                    className={`pr-10 ${error ? 'border-red-500' : available ? 'border-green-500' : ''}`}
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    {showDetailValidations && (
                        <ValidationIcon checking={checking} error={error} available={available} />
                    )}
                </div>
            </div>

            {showDetailValidations && <ValidationMessage checking={checking} error={error} available={available} />}

            {showValidation && !error && !checking && !available && value && value.trim().length > 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                    Минимум 3 символа, только латинские буквы, цифры и подчеркивание
                </p>
            )}
        </div>
    );
};
