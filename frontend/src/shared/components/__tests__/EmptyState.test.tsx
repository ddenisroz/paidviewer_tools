import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EmptyState } from '../EmptyState';
import { FileQuestion } from 'lucide-react';

describe('EmptyState', () => {
    it('renders with title and description', () => {
        render(<EmptyState icon={FileQuestion} title="No data found" description="Try adjusting your filters" />);

        expect(screen.getByText('No data found')).toBeInTheDocument();
        expect(screen.getByText('Try adjusting your filters')).toBeInTheDocument();
    });

    it('renders without description', () => {
        render(<EmptyState icon={FileQuestion} title="No data found" />);

        expect(screen.getByText('No data found')).toBeInTheDocument();
        expect(screen.queryByText('Try adjusting your filters')).not.toBeInTheDocument();
    });

    it('renders action button when provided', () => {
        const handleAction = vi.fn();

        render(
            <EmptyState
                icon={FileQuestion}
                title="No data found"
                action={{
                    label: 'Add new',
                    onClick: handleAction,
                }}
            />
        );

        const button = screen.getByRole('button', { name: 'Add new' });
        expect(button).toBeInTheDocument();
    });

    it('calls onClick when button is clicked', async () => {
        const user = userEvent.setup();
        const handleAction = vi.fn();

        render(
            <EmptyState
                icon={FileQuestion}
                title="No data found"
                action={{
                    label: 'Add new',
                    onClick: handleAction,
                }}
            />
        );

        const button = screen.getByRole('button', { name: 'Add new' });
        await user.click(button);

        expect(handleAction).toHaveBeenCalledTimes(1);
    });

    it('does not render action button when action is not provided', () => {
        render(<EmptyState icon={FileQuestion} title="No data found" />);

        expect(screen.queryByRole('button')).not.toBeInTheDocument();
    });

    it('applies custom className', () => {
        const { container } = render(<EmptyState icon={FileQuestion} title="No data found" className="custom-class" />);

        expect(container.firstChild).toHaveClass('custom-class');
    });
});
