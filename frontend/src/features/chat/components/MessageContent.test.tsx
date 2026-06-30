import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import MessageContent from './MessageContent';

describe('MessageContent', () => {
    it('strips invisible artifact characters from plain text output', () => {
        const { container } = render(<MessageContent message={`Привет\u034f`} showLinks={false} />);

        expect(container.textContent).toBe('Привет');
    });

    it('does not leave a placeholder when a message only contains a removed url and invisible artifact', () => {
        const { container } = render(
            <MessageContent message={`https://example.com/image.png \u034f`} showLinks={false} />
        );

        expect(container.textContent).toBe('');
    });

    it('strips invisible artifact characters from rendered url tokens', () => {
        const { container } = render(<MessageContent message={`https://example.com/watch?v=1\u034f`} />);

        expect(container.textContent?.trim()).toBe('https://example.com/watch?v=1');
        expect(container.innerHTML).not.toContain('\u034f');
    });

    it('renders plain text only without links or images', () => {
        const { container } = render(
            <MessageContent
                message={`hello :) https://example.com/pic.png world`}
                plainTextOnly
                twitchEmotes={[{ id: '1', name: 'Smile', start: 6, end: 7 }]}
            />
        );

        expect(container.textContent).toBe('hello :) world');
        expect(container.querySelector('a')).toBeNull();
        expect(container.querySelector('img')).toBeNull();
    });
});
