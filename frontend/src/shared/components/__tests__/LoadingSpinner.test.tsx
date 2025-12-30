import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import LoadingSpinner from '../LoadingSpinner';

describe('LoadingSpinner', () => {
    it('renders with default props', () => {
        render(<LoadingSpinner />);
        expect(screen.getByText('Загрузка...')).toBeInTheDocument();
    });

    it('renders with custom text', () => {
        render(<LoadingSpinner text="Подождите..." />);
        expect(screen.getByText('Подождите...')).toBeInTheDocument();
    });

    it('renders without text when text is empty string', () => {
        render(<LoadingSpinner text="" />);
        expect(screen.queryByText('Загрузка...')).not.toBeInTheDocument();
    });

    it('applies custom className', () => {
        const { container } = render(<LoadingSpinner className="custom-class" />);
        expect(container.firstChild).toHaveClass('custom-class');
    });

    it('renders with small size', () => {
        const { container } = render(<LoadingSpinner size="sm" />);
        const svg = container.querySelector('svg');
        expect(svg).toHaveClass('h-4', 'w-4');
    });

    it('renders with default size', () => {
        const { container } = render(<LoadingSpinner size="default" />);
        const svg = container.querySelector('svg');
        expect(svg).toHaveClass('h-6', 'w-6');
    });

    it('renders with large size', () => {
        const { container } = render(<LoadingSpinner size="lg" />);
        const svg = container.querySelector('svg');
        expect(svg).toHaveClass('h-8', 'w-8');
    });

    it('renders with extra large size', () => {
        const { container } = render(<LoadingSpinner size="xl" />);
        const svg = container.querySelector('svg');
        expect(svg).toHaveClass('h-12', 'w-12');
    });

    it('has spinning animation', () => {
        const { container } = render(<LoadingSpinner />);
        const svg = container.querySelector('svg');
        expect(svg).toHaveClass('animate-spin');
    });
});
