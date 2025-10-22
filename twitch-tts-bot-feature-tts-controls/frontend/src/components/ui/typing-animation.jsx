import React, { useState, useEffect } from 'react';
import { cn } from '../../lib/utils';

const TypingAnimation = ({ 
  text, 
  speed = 50, 
  className, 
  showCursor = true,
  cursorBlink = true,
  ...props 
}) => {
  const [displayedText, setDisplayedText] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    if (currentIndex < text.length) {
      const timeout = setTimeout(() => {
        setDisplayedText(prev => prev + text[currentIndex]);
        setCurrentIndex(prev => prev + 1);
      }, speed);

      return () => clearTimeout(timeout);
    } else {
      setIsComplete(true);
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
