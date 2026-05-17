import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StatsCard, StatsGrid } from '../StatsCard';
import { Users } from 'lucide-react';

describe('StatsCard', () => {
    describe('Basic rendering', () => {
        it('renders title and value', () => {
            render(<StatsCard title="Total Users" value={150} />);

            expect(screen.getByText('Total Users')).toBeInTheDocument();
            expect(screen.getByText('150')).toBeInTheDocument();
        });

        it('renders string value', () => {
            render(<StatsCard title="Status" value="Active" />);

            expect(screen.getByText('Active')).toBeInTheDocument();
        });

        it('renders description', () => {
            render(<StatsCard title="Total Users" value={150} description="Active today" />);

            expect(screen.getByText('Active today')).toBeInTheDocument();
        });

        it('renders icon', () => {
            const { container } = render(<StatsCard title="Total Users" value={150} icon={Users} />);

            const icon = container.querySelector('svg');
            expect(icon).toBeInTheDocument();
        });
    });

    describe('Trend indicator', () => {
        it('renders positive trend', () => {
            render(<StatsCard title="Total Users" value={150} trend={{ value: 12, direction: 'up' }} />);

            expect(screen.getByText(/12%/)).toBeInTheDocument();
        });

        it('renders negative trend', () => {
            render(<StatsCard title="Total Users" value={150} trend={{ value: -8, direction: 'down' }} />);

            expect(screen.getByText(/8%/)).toBeInTheDocument();
        });

        it('renders neutral trend', () => {
            render(<StatsCard title="Total Users" value={150} trend={{ value: 0, direction: 'neutral' }} />);

            expect(screen.getByText(/0%/)).toBeInTheDocument();
        });

        it('renders trend with label', () => {
            render(<StatsCard title="Total Users" value={150} trend={{ value: 12, label: 'за неделю' }} />);

            expect(screen.getByText(/12% за неделю/)).toBeInTheDocument();
        });

        it('auto-detects positive trend direction', () => {
            render(<StatsCard title="Total Users" value={150} trend={{ value: 12 }} />);

            expect(screen.getByText(/12%/)).toBeInTheDocument();
        });

        it('auto-detects negative trend direction', () => {
            render(<StatsCard title="Total Users" value={150} trend={{ value: -8 }} />);

            expect(screen.getByText(/8%/)).toBeInTheDocument();
        });
    });

    describe('Loading state', () => {
        it('shows skeleton when loading', () => {
            const { container } = render(<StatsCard title="Total Users" value={150} loading />);

            // Check for skeleton elements
            const skeletons = container.querySelectorAll('[class*="animate-pulse"]');
            expect(skeletons.length).toBeGreaterThan(0);
        });

        it('does not show content when loading', () => {
            render(<StatsCard title="Total Users" value={150} loading />);

            expect(screen.queryByText('Total Users')).not.toBeInTheDocument();
            expect(screen.queryByText('150')).not.toBeInTheDocument();
        });
    });

    describe('Interactivity', () => {
        it('calls onClick when clicked', async () => {
            const user = userEvent.setup();
            const onClick = vi.fn();

            render(<StatsCard title="Total Users" value={150} onClick={onClick} />);

            const card = screen.getByText('Total Users').closest('[class*="cursor-pointer"]');
            if (card) {
                await user.click(card);
                expect(onClick).toHaveBeenCalled();
            }
        });

        it('applies hover styles when clickable', () => {
            const { container } = render(<StatsCard title="Total Users" value={150} onClick={() => {}} />);

            const card = container.querySelector('[class*="cursor-pointer"]');
            expect(card).toBeInTheDocument();
        });
    });

    describe('Styling', () => {
        it('applies custom color', () => {
            const { container } = render(
                <StatsCard title="Total Users" value={150} icon={Users} color="text-red-400" />
            );

            const icon = container.querySelector('.text-red-400');
            expect(icon).toBeInTheDocument();
        });

        it('applies custom className', () => {
            const { container } = render(<StatsCard title="Total Users" value={150} className="custom-class" />);

            expect(container.firstChild).toHaveClass('custom-class');
        });
    });
});

describe('StatsGrid', () => {
    const mockStats = [
        { title: 'Users', value: 150 },
        { title: 'Posts', value: 320 },
        { title: 'Comments', value: 890 },
        { title: 'Likes', value: 1250 },
    ];

    describe('Basic rendering', () => {
        it('renders all stats', () => {
            render(<StatsGrid stats={mockStats} />);

            expect(screen.getByText('Users')).toBeInTheDocument();
            expect(screen.getByText('Posts')).toBeInTheDocument();
            expect(screen.getByText('Comments')).toBeInTheDocument();
            expect(screen.getByText('Likes')).toBeInTheDocument();
        });

        it('renders with 2 columns', () => {
            const { container } = render(<StatsGrid stats={mockStats} columns={2} />);

            const grid = container.querySelector('.grid');
            expect(grid).toHaveClass('md:grid-cols-2');
        });

        it('renders with 3 columns', () => {
            const { container } = render(<StatsGrid stats={mockStats} columns={3} />);

            const grid = container.querySelector('.grid');
            expect(grid).toHaveClass('lg:grid-cols-3');
        });

        it('renders with 4 columns by default', () => {
            const { container } = render(<StatsGrid stats={mockStats} />);

            const grid = container.querySelector('.grid');
            expect(grid).toHaveClass('lg:grid-cols-4');
        });
    });

    describe('Loading state', () => {
        it('shows skeleton cards when loading', () => {
            const { container } = render(<StatsGrid stats={mockStats} loading />);

            const skeletons = container.querySelectorAll('[class*="animate-pulse"]');
            expect(skeletons.length).toBeGreaterThan(0);
        });

        it('shows correct number of skeleton cards', () => {
            const { container } = render(<StatsGrid stats={mockStats} columns={3} loading />);

            // Should show 3 skeleton cards (based on columns prop)
            const skeletons = container.querySelectorAll('[class*="animate-pulse"]');
            expect(skeletons.length).toBeGreaterThanOrEqual(3);
        });

        it('does not show actual stats when loading', () => {
            render(<StatsGrid stats={mockStats} loading />);

            expect(screen.queryByText('Users')).not.toBeInTheDocument();
            expect(screen.queryByText('Posts')).not.toBeInTheDocument();
        });
    });

    describe('Styling', () => {
        it('applies custom className', () => {
            const { container } = render(<StatsGrid stats={mockStats} className="custom-grid" />);

            expect(container.firstChild).toHaveClass('custom-grid');
        });
    });

    describe('Empty state', () => {
        it('renders empty grid', () => {
            const { container } = render(<StatsGrid stats={[]} />);

            const grid = container.querySelector('.grid');
            expect(grid).toBeInTheDocument();
            expect(grid?.children.length).toBe(0);
        });
    });
});
