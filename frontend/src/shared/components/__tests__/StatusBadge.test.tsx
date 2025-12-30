import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import StatusBadge from '../StatusBadge';

describe('StatusBadge', () => {
    describe('Active/Success states', () => {
        it('renders active status', () => {
            render(<StatusBadge status="active" />);
            expect(screen.getByText('Активен')).toBeInTheDocument();
        });

        it('renders enabled status', () => {
            render(<StatusBadge status="enabled" />);
            expect(screen.getByText('Активен')).toBeInTheDocument();
        });

        it('renders online status', () => {
            render(<StatusBadge status="online" />);
            expect(screen.getByText('Активен')).toBeInTheDocument();
        });

        it('renders connected status', () => {
            render(<StatusBadge status="connected" />);
            expect(screen.getByText('Активен')).toBeInTheDocument();
        });

        it('renders success status', () => {
            render(<StatusBadge status="success" />);
            expect(screen.getByText('Активен')).toBeInTheDocument();
        });
    });

    describe('Inactive/Error states', () => {
        it('renders inactive status', () => {
            render(<StatusBadge status="inactive" />);
            expect(screen.getByText('Неактивен')).toBeInTheDocument();
        });

        it('renders disabled status', () => {
            render(<StatusBadge status="disabled" />);
            expect(screen.getByText('Неактивен')).toBeInTheDocument();
        });

        it('renders offline status', () => {
            render(<StatusBadge status="offline" />);
            expect(screen.getByText('Неактивен')).toBeInTheDocument();
        });

        it('renders disconnected status', () => {
            render(<StatusBadge status="disconnected" />);
            expect(screen.getByText('Неактивен')).toBeInTheDocument();
        });

        it('renders error status', () => {
            render(<StatusBadge status="error" />);
            expect(screen.getByText('Неактивен')).toBeInTheDocument();
        });
    });

    describe('Pending/Processing states', () => {
        it('renders pending status', () => {
            render(<StatusBadge status="pending" />);
            expect(screen.getByText('Обработка')).toBeInTheDocument();
        });

        it('renders loading status', () => {
            render(<StatusBadge status="loading" />);
            expect(screen.getByText('Обработка')).toBeInTheDocument();
        });

        it('renders processing status', () => {
            render(<StatusBadge status="processing" />);
            expect(screen.getByText('Обработка')).toBeInTheDocument();
        });
    });

    describe('Warning states', () => {
        it('renders warning status', () => {
            render(<StatusBadge status="warning" />);
            expect(screen.getByText('Предупреждение')).toBeInTheDocument();
        });

        it('renders caution status', () => {
            render(<StatusBadge status="caution" />);
            expect(screen.getByText('Предупреждение')).toBeInTheDocument();
        });
    });

    describe('Waiting states', () => {
        it('renders waiting status', () => {
            render(<StatusBadge status="waiting" />);
            expect(screen.getByText('Ожидание')).toBeInTheDocument();
        });

        it('renders queued status', () => {
            render(<StatusBadge status="queued" />);
            expect(screen.getByText('Ожидание')).toBeInTheDocument();
        });
    });

    describe('Unknown/Default states', () => {
        it('renders unknown status for undefined', () => {
            render(<StatusBadge />);
            expect(screen.getByText('Неизвестно')).toBeInTheDocument();
        });

        it('renders custom status text', () => {
            render(<StatusBadge status="custom" />);
            expect(screen.getByText('custom')).toBeInTheDocument();
        });
    });

    describe('Icon visibility', () => {
        it('shows icon by default', () => {
            const { container } = render(<StatusBadge status="active" />);
            const svg = container.querySelector('svg');
            expect(svg).toBeInTheDocument();
        });

        it('hides icon when showIcon is false', () => {
            const { container } = render(<StatusBadge status="active" showIcon={false} />);
            const svg = container.querySelector('svg');
            expect(svg).not.toBeInTheDocument();
        });
    });

    describe('Custom styling', () => {
        it('applies custom className', () => {
            const { container } = render(<StatusBadge status="active" className="custom-class" />);
            expect(container.firstChild).toHaveClass('custom-class');
        });
    });

    describe('Case insensitivity', () => {
        it('handles uppercase status', () => {
            render(<StatusBadge status="ACTIVE" />);
            expect(screen.getByText('Активен')).toBeInTheDocument();
        });

        it('handles mixed case status', () => {
            render(<StatusBadge status="AcTiVe" />);
            expect(screen.getByText('Активен')).toBeInTheDocument();
        });
    });
});
