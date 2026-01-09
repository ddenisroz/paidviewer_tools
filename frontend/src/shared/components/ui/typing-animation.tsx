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
    <span className={cn("inline-block", className)} {...props}>
      {displayedText}
      {showCursor && (
        <span 
          className={cn(
            "ml-1 text-green-400",
            cursorBlink && "animate-pulse"
          )}
        >
          _
        </span>
      )}
    </span>
  );
};

export { TypingAnimation };

