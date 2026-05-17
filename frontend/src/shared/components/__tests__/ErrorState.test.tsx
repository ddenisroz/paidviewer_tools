import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ErrorState } from '../ErrorState';

describe('ErrorState', () => {
    it('renders with error message', () => {
        render(<ErrorState message="Something went wrong" />);

        expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    });

    it('renders with title and message', () => {
        render(<ErrorState title="Error occurred" message="Something went wrong" />);

        expect(screen.getByText('Error occurred')).toBeInTheDocument();
        expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    });

    it('renders technical details when provided and showDetails is true', () => {
        const error = new Error('Network timeout');

        render(<ErrorState message="Something went wrong" error={error} showDetails={true} />);

        // Click to expand details
        const summary = screen.getByText('Технические детали');
        expect(summary).toBeInTheDocument();
    });

    it('renders retry button when onRetry is provided', () => {
        const handleRetry = vi.fn();

        render(<ErrorState message="Something went wrong" onRetry={handleRetry} />);

        const button = screen.getByRole('button', { name: /повторить/i });
        expect(button).toBeInTheDocument();
    });

    it('calls onRetry when retry button is clicked', async () => {
        const user = userEvent.setup();
        const handleRetry = vi.fn();

        render(<ErrorState message="Something went wrong" onRetry={handleRetry} />);

        const button = screen.getByRole('button', { name: /повторить/i });
        await user.click(button);

        expect(handleRetry).toHaveBeenCalledTimes(1);
    });

    it('does not render retry button when onRetry is not provided', () => {
        render(<ErrorState message="Something went wrong" />);

        expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });

    it('applies custom className', () => {
        const { container } = render(<ErrorState message="Something went wrong" className="custom-error" />);

        expect(container.firstChild).toHaveClass('custom-error');
    });
});
