import React, { useEffect, useState } from 'react';

import { cn } from '@/lib/utils';

interface TypingAnimationProps extends React.HTMLAttributes<HTMLSpanElement> {
  text: string;
  speed?: number;
  showCursor?: boolean;
  cursorBlink?: boolean;
}

const TypingAnimation: React.FC<TypingAnimationProps> = ({ 
  text, 
  speed = 50, 
  className, 
  showCursor = true,
  cursorBlink = true,
  ...props 
}) => {
  const [displayedText, setDisplayedText] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (currentIndex < text.length) {
      const timeout = setTimeout(() => {
        setDisplayedText(prev => prev + text[currentIndex]);
        setCurrentIndex(prev => prev + 1);
      }, speed);

      return () => clearTimeout(timeout);
    }
  }, [currentIndex, text, speed]);

  return (
    <span className={cn("relative inline-grid align-baseline", className)} {...props}>
      <span className="invisible col-start-1 row-start-1 whitespace-pre" aria-hidden="true">
        {text}
        {showCursor ? '_' : ''}
      </span>
      <span className="col-start-1 row-start-1 flex whitespace-pre">
        <span>{displayedText}</span>
        {showCursor && (
          <span
            className={cn(
              "text-green-400",
              cursorBlink && "animate-pulse",
            )}
          >
            _
          </span>
        )}
      </span>
    </span>
  );
};

export { TypingAnimation };

