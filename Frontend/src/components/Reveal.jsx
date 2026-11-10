import { useEffect, useRef, useState } from 'react';
import useReducedMotionPreference from '../hooks/useReducedMotionPreference';

const DIRECTIONS = {
  up: { x: 0, y: 1 },
  down: { x: 0, y: -1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
  fade: { x: 0, y: 0 },
};

export function Reveal({
  children,
  className = "",
  as = "div",

  // Animation settings
  direction = "up",
  distance = 24,
  duration = 0.7,
  delay = 0,
  initialScale = 0.98,
  ease = [0.22, 1, 0.36, 1],

  // Scroll settings
  once = true,
  amount = 0.15,
  margin = "0px 0px -40px 0px",
  root,

  ...props
}) {
  const elementRef = useRef(null);
  const [isVisible, setIsVisible] = useState(false);
  const shouldReduceMotion = useReducedMotionPreference();
  const hasIntersectionObserver = typeof window !== 'undefined' && 'IntersectionObserver' in window;
  const Component = as;
  const offset = DIRECTIONS[direction] ?? DIRECTIONS.up;
  const style = {
    ...props.style,
    '--reveal-x': `${offset.x * distance}px`,
    '--reveal-y': `${offset.y * distance}px`,
    '--reveal-scale': initialScale,
    '--reveal-duration': `${duration}s`,
    '--reveal-delay': `${delay}s`,
    '--reveal-ease': Array.isArray(ease) ? `cubic-bezier(${ease.join(',')})` : ease,
  };

  useEffect(() => {
    const element = elementRef.current;
    if (shouldReduceMotion || !element || !hasIntersectionObserver) return undefined;

    const observer = new IntersectionObserver(([entry]) => {
      setIsVisible(entry.isIntersecting);
      if (entry.isIntersecting && once) observer.disconnect();
    }, {
      root: root || null,
      rootMargin: margin,
      threshold: Math.min(1, Math.max(0, amount)),
    });

    observer.observe(element);
    return () => observer.disconnect();
  }, [amount, hasIntersectionObserver, margin, once, root, shouldReduceMotion]);

  return (
    <Component
      {...props}
      ref={elementRef}
      className={`reveal${isVisible || shouldReduceMotion || !hasIntersectionObserver ? ' is-visible' : ''}${className ? ` ${className}` : ''}`}
      style={style}
    >
      {children}
    </Component>
  );
}