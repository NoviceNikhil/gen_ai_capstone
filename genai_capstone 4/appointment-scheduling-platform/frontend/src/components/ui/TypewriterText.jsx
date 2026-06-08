import { useState, useEffect } from 'react';

export default function TypewriterText({ text, delay = 0, speed = 30, className = "", as: Component = "span" }) {
  const [displayedText, setDisplayedText] = useState("");
  const [started, setStarted] = useState(false);

  useEffect(() => {
    const startTimer = setTimeout(() => {
      setStarted(true);
    }, delay);
    return () => clearTimeout(startTimer);
  }, [delay]);

  useEffect(() => {
    if (!started) return;
    if (displayedText.length < text.length) {
      const timeout = setTimeout(() => {
        setDisplayedText(text.slice(0, displayedText.length + 1));
      }, speed);
      return () => clearTimeout(timeout);
    }
  }, [displayedText, started, text, speed]);

  return (
    <Component className={className}>
      {displayedText}
      {started && displayedText.length < text.length && (
        <span className="animate-pulse border-r-2 border-current ml-[1px] h-full inline-block" />
      )}
    </Component>
  );
}
