import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { z } from 'zod';
import { FormBuilder } from '../FormBuilder';

describe('FormBuilder', () => {
    const mockOnSubmit = vi.fn();
    const mockOnCancel = vi.fn();

    beforeEach(() => {
        mockOnSubmit.mockClear();
        mockOnCancel.mockClear();
    });

    describe('Text input field', () => {
        const schema = z.object({
            username: z.string().min(3, 'Минимум 3 символа'),
        });

        const fields = [
            {
                name: 'username' as const,
                label: 'Имя пользователя',
                type: 'text' as const,
                placeholder: 'Введите имя',
            },
        ];

        it('renders text input field', () => {
            render(<FormBuilder schema={schema} fields={fields} onSubmit={mockOnSubmit} />);

            expect(screen.getByLabelText('Имя пользователя')).toBeInTheDocument();
            expect(screen.getByPlaceholderText('Введите имя')).toBeInTheDocument();
        });

        it('validates text input on submit', async () => {
            const user = userEvent.setup();
            render(
                <FormBuilder schema={schema} fields={fields} onSubmit={mockOnSubmit} defaultValues={{ username: '' }} />
            );

            const submitButton = screen.getByRole('button', { name: 'Сохранить' });
            await user.click(submitButton);

            await waitFor(() => {
                expect(screen.getByText(/минимум 3/i)).toBeInTheDocument();
            });
            expect(mockOnSubmit).not.toHaveBeenCalled();
        });

        it('submits valid text input', async () => {
            const user = userEvent.setup();
            render(
                <FormBuilder schema={schema} fields={fields} onSubmit={mockOnSubmit} defaultValues={{ username: '' }} />
            );

            const input = screen.getByLabelText('Имя пользователя');
            await user.type(input, 'testuser');

            const submitButton = screen.getByRole('button', { name: 'Сохранить' });
            await user.click(submitButton);

            await waitFor(() => {
                expect(mockOnSubmit).toHaveBeenCalledWith({ username: 'testuser' });
            });
        });
    });

    describe('Number input field', () => {
        const schema = z.object({
            age: z.number().min(18, 'Минимум 18'),
        });

        const fields = [
            {
                name: 'age' as const,
                label: 'Возраст',
                type: 'number' as const,
                min: 0,
                max: 120,
            },
        ];

        it('renders number input field', () => {
            render(<FormBuilder schema={schema} fields={fields} onSubmit={mockOnSubmit} />);

            const input = screen.getByLabelText('Возраст');
            expect(input).toHaveAttribute('type', 'number');
            expect(input).toHaveAttribute('min', '0');
            expect(input).toHaveAttribute('max', '120');
        });
    });

    describe('Checkbox field', () => {
        const schema = z.object({
            agree: z.boolean(),
        });

        const fields = [
            {
                name: 'agree' as const,
                label: 'Согласен с условиями',
                type: 'checkbox' as const,
            },
        ];

        it('renders checkbox field', () => {
            render(<FormBuilder schema={schema} fields={fields} onSubmit={mockOnSubmit} />);

            expect(screen.getByLabelText('Согласен с условиями')).toBeInTheDocument();
        });

        it('toggles checkbox value', async () => {
            const user = userEvent.setup();
            render(
                <FormBuilder schema={schema} fields={fields} onSubmit={mockOnSubmit} defaultValues={{ agree: false }} />
            );

            const checkbox = screen.getByRole('checkbox');
            expect(checkbox).not.toBeChecked();

            await user.click(checkbox);
            expect(checkbox).toBeChecked();
        });
    });

    describe('Select field', () => {
        const schema = z.object({
            role: z.string(),
        });

        const fields = [
            {
                name: 'role' as const,
                label: 'Роль',
                type: 'select' as const,
                options: [
                    { value: 'user', label: 'Пользователь' },
                    { value: 'admin', label: 'Администратор' },
                ],
            },
        ];

        it('renders select field', () => {
            render(<FormBuilder schema={schema} fields={fields} onSubmit={mockOnSubmit} />);

            expect(screen.getByText('Роль')).toBeInTheDocument();
        });
    });

    describe('Textarea field', () => {
        const schema = z.object({
            description: z.string(),
        });

        const fields = [
            {
                name: 'description' as const,
                label: 'Описание',
                type: 'textarea' as const,
                rows: 5,
            },
        ];

        it('renders textarea field', () => {
            render(<FormBuilder schema={schema} fields={fields} onSubmit={mockOnSubmit} />);

            const textarea = screen.getByLabelText('Описание');
            expect(textarea.tagName).toBe('TEXTAREA');
            expect(textarea).toHaveAttribute('rows', '5');
        });
    });

    describe('Form actions', () => {
        const schema = z.object({
            name: z.string(),
        });

        const fields = [
            {
                name: 'name' as const,
                label: 'Имя',
                type: 'text' as const,
            },
        ];

        it('shows submit button with default label', () => {
            render(<FormBuilder schema={schema} fields={fields} onSubmit={mockOnSubmit} />);

            expect(screen.getByRole('button', { name: 'Сохранить' })).toBeInTheDocument();
        });

        it('shows submit button with custom label', () => {
            render(<FormBuilder schema={schema} fields={fields} onSubmit={mockOnSubmit} submitLabel="Отправить" />);

            expect(screen.getByRole('button', { name: 'Отправить' })).toBeInTheDocument();
        });

        it('shows cancel button when enabled', () => {
            render(
                <FormBuilder
                    schema={schema}
                    fields={fields}
                    onSubmit={mockOnSubmit}
                    onCancel={mockOnCancel}
                    showCancelButton
                />
            );

            expect(screen.getByRole('button', { name: 'Отмена' })).toBeInTheDocument();
        });

        it('calls onCancel when cancel button clicked', async () => {
            const user = userEvent.setup();
            render(
                <FormBuilder
                    schema={schema}
                    fields={fields}
                    onSubmit={mockOnSubmit}
                    onCancel={mockOnCancel}
                    showCancelButton
                />
            );

            const cancelButton = screen.getByRole('button', { name: 'Отмена' });
            await user.click(cancelButton);

            expect(mockOnCancel).toHaveBeenCalled();
        });

        it('disables form when loading', () => {
            render(<FormBuilder schema={schema} fields={fields} onSubmit={mockOnSubmit} loading />);

            const input = screen.getByLabelText('Имя');
            const submitButton = screen.getByRole('button', { name: 'Сохранить' });

            expect(input).toBeDisabled();
            expect(submitButton).toBeDisabled();
        });
    });

    describe('Field descriptions', () => {
        const schema = z.object({
            email: z.string().email(),
        });

        const fields = [
            {
                name: 'email' as const,
                label: 'Email',
                type: 'email' as const,
                description: 'Введите ваш email адрес',
            },
        ];

        it('shows field description', () => {
            render(<FormBuilder schema={schema} fields={fields} onSubmit={mockOnSubmit} />);

            expect(screen.getByText('Введите ваш email адрес')).toBeInTheDocument();
        });
    });

    describe('Hidden fields', () => {
        const schema = z.object({
            visible: z.string(),
            hidden: z.string(),
        });

        const fields = [
            {
                name: 'visible' as const,
                label: 'Видимое поле',
                type: 'text' as const,
            },
            {
                name: 'hidden' as const,
                label: 'Скрытое поле',
                type: 'text' as const,
                hidden: true,
            },
        ];

        it('does not render hidden fields', () => {
            render(<FormBuilder schema={schema} fields={fields} onSubmit={mockOnSubmit} />);

            expect(screen.getByLabelText('Видимое поле')).toBeInTheDocument();
            expect(screen.queryByLabelText('Скрытое поле')).not.toBeInTheDocument();
        });
    });

    describe('Default values', () => {
        const schema = z.object({
            username: z.string(),
        });

        const fields = [
            {
                name: 'username' as const,
                label: 'Имя пользователя',
                type: 'text' as const,
            },
        ];

        it('populates form with default values', () => {
            render(
                <FormBuilder
                    schema={schema}
                    fields={fields}
                    onSubmit={mockOnSubmit}
                    defaultValues={{ username: 'defaultuser' }}
                />
            );

            const input = screen.getByLabelText('Имя пользователя') as HTMLInputElement;
            expect(input.value).toBe('defaultuser');
        });
    });
});
