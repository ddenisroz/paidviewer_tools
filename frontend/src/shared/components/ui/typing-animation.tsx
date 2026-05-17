import React, { useEffect, useState } from 'react';

import { cn } from '@/lib/utils';

interface TypingAnimationProps extends React.HTMLAttributes<HTMLSpanElement> {
    text: string;
    speed?: number;
    showCursor?: boolean;
    cursorBlink?: boolean;
    cursorChar?: string;
}

const TypingAnimation: React.FC<TypingAnimationProps> = ({
    text,
    speed = 50,
    className,
    showCursor = true,
    cursorBlink = true,
    cursorChar = '_',
    ...props
}) => {
    const [currentIndex, setCurrentIndex] = useState(0);

    useEffect(() => {
        setCurrentIndex(0);
    }, [text]);

    useEffect(() => {
        if (currentIndex >= text.length) return;

        const timeout = window.setTimeout(() => {
            setCurrentIndex((prev) => Math.min(prev + 1, text.length));
        }, speed);

        return () => window.clearTimeout(timeout);
    }, [currentIndex, text, speed]);

    const displayedText = text.slice(0, currentIndex);

    return (
        <span className={cn('inline-grid align-baseline', className)} aria-label={text} {...props}>
            <span
                className="invisible col-start-1 row-start-1 inline-flex items-baseline justify-self-start whitespace-pre"
                aria-hidden="true"
            >
                <span>{text}</span>
                {showCursor && <span className="typing-caret">{cursorChar}</span>}
            </span>
            <span className="col-start-1 row-start-1 inline-flex items-baseline justify-self-start whitespace-pre">
                <span>{displayedText}</span>
                {showCursor && (
                    <span
                        className={cn('typing-caret text-green-400', cursorBlink && 'typing-caret--blink')}
                        aria-hidden="true"
                    >
                        {cursorChar}
                    </span>
                )}
            </span>
        </span>
    );
};

export { TypingAnimation };
