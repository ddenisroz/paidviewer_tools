import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConfirmDialog } from '../ConfirmDialog';

describe('ConfirmDialog', () => {
    it('renders when open is true', () => {
        render(
            <ConfirmDialog
                open={true}
                onOpenChange={vi.fn()}
                onConfirm={vi.fn()}
                title="Confirm action"
                description="Are you sure?"
            />
        );

        expect(screen.getByText('Confirm action')).toBeInTheDocument();
        expect(screen.getByText('Are you sure?')).toBeInTheDocument();
    });

    it('does not render when open is false', () => {
        render(
            <ConfirmDialog
                open={false}
                onOpenChange={vi.fn()}
                onConfirm={vi.fn()}
                title="Confirm action"
                description="Are you sure?"
            />
        );

        expect(screen.queryByText('Confirm action')).not.toBeInTheDocument();
    });

    it('renders with default variant', () => {
        render(
            <ConfirmDialog
                open={true}
                onOpenChange={vi.fn()}
                onConfirm={vi.fn()}
                title="Confirm action"
                description="Are you sure?"
            />
        );

        const confirmButton = screen.getByRole('button', { name: /подтвердить/i });
        expect(confirmButton).toBeInTheDocument();
    });

    it('renders with destructive variant', () => {
        render(
            <ConfirmDialog
                open={true}
                onOpenChange={vi.fn()}
                onConfirm={vi.fn()}
                title="Delete item"
                description="This action cannot be undone"
                variant="destructive"
            />
        );

        const confirmButton = screen.getByRole('button', { name: /подтвердить/i });
        expect(confirmButton).toBeInTheDocument();
        // Destructive variant changes button style, not label
    });

    it('calls onConfirm when confirm button is clicked', async () => {
        const user = userEvent.setup();
        const handleConfirm = vi.fn();

        render(
            <ConfirmDialog
                open={true}
                onOpenChange={vi.fn()}
                onConfirm={handleConfirm}
                title="Confirm action"
                description="Are you sure?"
            />
        );

        const confirmButton = screen.getByRole('button', { name: /подтвердить/i });
        await user.click(confirmButton);

        expect(handleConfirm).toHaveBeenCalledTimes(1);
    });

    it('calls onOpenChange when cancel button is clicked', async () => {
        const user = userEvent.setup();
        const handleOpenChange = vi.fn();

        render(
            <ConfirmDialog
                open={true}
                onOpenChange={handleOpenChange}
                onConfirm={vi.fn()}
                title="Confirm action"
                description="Are you sure?"
            />
        );

        const cancelButton = screen.getByRole('button', { name: /отмена/i });
        await user.click(cancelButton);

        expect(handleOpenChange).toHaveBeenCalledWith(false);
    });

    it('shows loading state when loading is true', () => {
        render(
            <ConfirmDialog
                open={true}
                onOpenChange={vi.fn()}
                onConfirm={vi.fn()}
                title="Confirm action"
                description="Are you sure?"
                loading={true}
            />
        );

        const confirmButton = screen.getByRole('button', { name: /загрузка/i });
        expect(confirmButton).toBeDisabled();
    });

    it('disables buttons when loading', () => {
        render(
            <ConfirmDialog
                open={true}
                onOpenChange={vi.fn()}
                onConfirm={vi.fn()}
                title="Confirm action"
                description="Are you sure?"
                loading={true}
            />
        );

        const confirmButton = screen.getByRole('button', { name: /загрузка/i });
        const cancelButton = screen.getByRole('button', { name: /отмена/i });

        expect(confirmButton).toBeDisabled();
        expect(cancelButton).toBeDisabled();
    });

    it('uses custom labels when provided', () => {
        render(
            <ConfirmDialog
                open={true}
                onOpenChange={vi.fn()}
                onConfirm={vi.fn()}
                title="Confirm action"
                description="Are you sure?"
                confirmLabel="Yes, do it"
                cancelLabel="No, cancel"
            />
        );

        expect(screen.getByRole('button', { name: 'Yes, do it' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'No, cancel' })).toBeInTheDocument();
    });
});
