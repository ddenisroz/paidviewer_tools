import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { TwitchIcon, VKIcon } from '../PlatformIcons';

describe('PlatformIcons', () => {
    describe('TwitchIcon', () => {
        it('renders with default size', () => {
            const { container } = render(<TwitchIcon />);
            const svg = container.querySelector('svg');
            expect(svg).toBeInTheDocument();
            expect(svg).toHaveAttribute('width', '20');
            expect(svg).toHaveAttribute('height', '20');
        });

        it('renders with custom width and height props', () => {
            const { container } = render(<TwitchIcon width={32} height={32} />);
            const svg = container.querySelector('svg');
            expect(svg).toHaveAttribute('width', '32');
            expect(svg).toHaveAttribute('height', '32');
        });

        it('renders with custom width and height in style', () => {
            const { container } = render(<TwitchIcon style={{ width: 48, height: 48 }} />);
            const svg = container.querySelector('svg');
            expect(svg).toHaveAttribute('width', '48');
            expect(svg).toHaveAttribute('height', '48');
        });

        it('applies custom className', () => {
            const { container } = render(<TwitchIcon className="custom-icon" />);
            const svg = container.querySelector('svg');
            expect(svg).toHaveClass('custom-icon');
        });

        it('applies custom style', () => {
            const { container } = render(<TwitchIcon style={{ color: 'red' }} />);
            const svg = container.querySelector('svg');
            expect(svg).toHaveAttribute('style');
        });

        it('has correct viewBox', () => {
            const { container } = render(<TwitchIcon />);
            const svg = container.querySelector('svg');
            expect(svg).toHaveAttribute('viewBox', '0 0 24 24');
        });

        it('uses currentColor fill', () => {
            const { container } = render(<TwitchIcon />);
            const svg = container.querySelector('svg');
            expect(svg).toHaveAttribute('fill', 'currentColor');
        });
    });

    describe('VKIcon', () => {
        it('renders with default size', () => {
            const { container } = render(<VKIcon />);
            const svg = container.querySelector('svg');
            expect(svg).toBeInTheDocument();
            expect(svg).toHaveAttribute('width', '20');
            expect(svg).toHaveAttribute('height', '20');
        });

        it('renders with custom width and height props', () => {
            const { container } = render(<VKIcon width={32} height={32} />);
            const svg = container.querySelector('svg');
            expect(svg).toHaveAttribute('width', '32');
            expect(svg).toHaveAttribute('height', '32');
        });

        it('renders with custom width and height in style', () => {
            const { container } = render(<VKIcon style={{ width: 48, height: 48 }} />);
            const svg = container.querySelector('svg');
            expect(svg).toHaveAttribute('width', '48');
            expect(svg).toHaveAttribute('height', '48');
        });

        it('applies custom className', () => {
            const { container } = render(<VKIcon className="custom-icon" />);
            const svg = container.querySelector('svg');
            expect(svg).toHaveClass('custom-icon');
        });

        it('applies custom style', () => {
            const { container } = render(<VKIcon style={{ color: 'blue' }} />);
            const svg = container.querySelector('svg');
            expect(svg).toHaveAttribute('style');
        });

        it('has correct viewBox', () => {
            const { container } = render(<VKIcon />);
            const svg = container.querySelector('svg');
            expect(svg).toHaveAttribute('viewBox', '2 2 20 20');
        });

        it('uses currentColor fill', () => {
            const { container } = render(<VKIcon />);
            const svg = container.querySelector('svg');
            expect(svg).toHaveAttribute('fill', 'currentColor');
        });
    });

    describe('Icon comparison', () => {
        it('both icons render as SVG elements', () => {
            const { container: twitchContainer } = render(<TwitchIcon />);
            const { container: vkContainer } = render(<VKIcon />);

            expect(twitchContainer.querySelector('svg')).toBeInTheDocument();
            expect(vkContainer.querySelector('svg')).toBeInTheDocument();
        });

        it('icons have different viewBox dimensions', () => {
            const { container: twitchContainer } = render(<TwitchIcon />);
            const { container: vkContainer } = render(<VKIcon />);

            const twitchSvg = twitchContainer.querySelector('svg');
            const vkSvg = vkContainer.querySelector('svg');

            expect(twitchSvg?.getAttribute('viewBox')).toBe('0 0 24 24');
            expect(vkSvg?.getAttribute('viewBox')).toBe('2 2 20 20');
        });
    });
});
