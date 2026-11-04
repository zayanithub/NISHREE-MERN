import { useCallback, useEffect, useRef } from "react";
import { motion, useReducedMotion } from "framer-motion";

const brandLines = ["NISHREE", "ATTIRE"];

const EASE = [0.22, 1, 0.36, 1];

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
  const reduceMotion = useReducedMotion();

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

  // Respect reduced-motion preferences without leaving
  // the parent application waiting for the intro to finish.
  useEffect(() => {
    if (reduceMotion) {
      handleComplete();
    }
  }, [reduceMotion, handleComplete]);

  if (reduceMotion) return null;

  return (
    <motion.div
      className="signature-reveal"
      aria-hidden="true"
      initial={{ opacity: 1 }}
      animate={{ opacity: 0 }}
      transition={{
        opacity: {
          delay: 1.62,
          duration: 0.48,
          ease: "easeInOut",
        },
      }}
      onAnimationComplete={handleComplete}
    >
      <div className="signature-reveal-content">

        {/* Brand tagline */}
        <motion.span
          className="signature-reveal-caption"
          initial={{
            opacity: 0,
            y: 8,
          }}
          animate={{
            opacity: 1,
            y: 0,
          }}
          transition={{
            duration: 0.55,
            delay: 0.08,
            ease: EASE,
          }}
        >
          ELEGANCE IN EVERY THREAD
        </motion.span>

        {/* Animated brand wordmark */}
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
                <motion.span
                  className="signature-reveal-letter"
                  key={`${line}-${index}`}
                  initial={{
                    opacity: 0,
                    y: 14,
                    filter: "blur(8px)",
                  }}
                  animate={{
                    opacity: 1,
                    y: 0,
                    filter: "blur(0px)",
                  }}
                  transition={{
                    duration: 0.46,
                    delay: index * 0.048,
                    ease: EASE,
                  }}
                >
                  {letter}
                </motion.span>
              ))}
            </span>
          ))}
        </h1>

        {/* Elegant animated signature waves */}
        <svg
          className="signature-reveal-waves"
          viewBox="0 0 760 82"
          role="presentation"
          aria-hidden="true"
          focusable="false"
        >
          <motion.path
            className="signature-reveal-wave"
            d="M0 38 C92 6 145 70 238 38 S384 6 476 38 622 70 760 31"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.2"
            initial={{
              pathLength: 0,
              opacity: 0,
            }}
            animate={{
              pathLength: 1,
              opacity: 0.8,
            }}
            transition={{
              pathLength: {
                delay: 0.45,
                duration: 0.9,
                ease: EASE,
              },
              opacity: {
                delay: 0.45,
                duration: 0.3,
              },
            }}
          />

          <motion.path
            className="signature-reveal-wave"
            d="M0 53 C92 21 145 85 238 53 S384 21 476 53 622 85 760 46"
            fill="none"
            stroke="currentColor"
            strokeWidth="0.8"
            initial={{
              pathLength: 0,
              opacity: 0,
            }}
            animate={{
              pathLength: 1,
              opacity: 0.45,
            }}
            transition={{
              pathLength: {
                delay: 0.58,
                duration: 0.82,
                ease: EASE,
              },
              opacity: {
                delay: 0.58,
                duration: 0.3,
              },
            }}
          />
        </svg>
      </div>
    </motion.div>
  );
}