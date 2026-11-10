import { useCallback, useEffect, useRef } from "react";
import useReducedMotionPreference from '../hooks/useReducedMotionPreference';

const brandLines = ["NISHREE", "ATTIRE"];

const letterGroups = (() => {
  let index = 0;

  return brandLines.map((line) => ({
    line,
    letters: Array.from(line, (letter) => ({
      letter,
      index: index++,
    })),
  }));
})();

export default function SignatureReveal({
  onComplete,
}) {
  const reduceMotion = useReducedMotionPreference();

  const completedRef = useRef(false);
  const callbackRef = useRef(onComplete);

  useEffect(() => {
    callbackRef.current = onComplete;
  }, [onComplete]);

  // Call onComplete only once, even in React Strict Mode.
  const handleComplete = useCallback(() => {
    if (completedRef.current) return;

    completedRef.current = true;
    callbackRef.current?.();
  }, []);

  const handleAnimationEnd = useCallback((event) => {
    if (event.target === event.currentTarget && event.animationName === 'signature-reveal-exit') {
      handleComplete();
    }
  }, [handleComplete]);

  useEffect(() => {
    if (reduceMotion) {
      handleComplete();
      return undefined;
    }
    const timeout = window.setTimeout(handleComplete, 1_000);
    return () => window.clearTimeout(timeout);
  }, [reduceMotion, handleComplete]);

  if (reduceMotion) return null;

  return (
    <div
      className="signature-reveal"
      aria-hidden="true"
      onAnimationEnd={handleAnimationEnd}
    >
      <div className="signature-reveal-content">
        <span className="signature-reveal-caption">
          ELEGANCE IN EVERY THREAD
        </span>

        <h1
          className="signature-reveal-wordmark"
          aria-label="Nishree Attire"
        >
          {letterGroups.map(({ line, letters }) => (
            <span
              className="signature-reveal-line"
              key={line}
            >
              {letters.map(({ letter, index }) => (
                <span
                  className="signature-reveal-letter"
                  key={`${line}-${index}`}
                  style={{ '--letter-index': index }}
                >
                  {letter}
                </span>
              ))}
            </span>
          ))}
        </h1>

        <svg
          className="signature-reveal-waves"
          viewBox="0 0 760 82"
          role="presentation"
          aria-hidden="true"
          focusable="false"
        >
          <path
            className="signature-reveal-wave"
            pathLength="1"
            d="M0 38 C92 6 145 70 238 38 S384 6 476 38 622 70 760 31"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.2"
          />

          <path
            className="signature-reveal-wave"
            pathLength="1"
            d="M0 53 C92 21 145 85 238 53 S384 21 476 53 622 85 760 46"
            fill="none"
            stroke="currentColor"
            strokeWidth="0.8"
          />
        </svg>
      </div>
    </div>
  );
}