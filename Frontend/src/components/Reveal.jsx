import { motion, useReducedMotion } from "framer-motion";

const DIRECTIONS = {
  up: { x: 0, y: 1 },
  down: { x: 0, y: -1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
  fade: { x: 0, y: 0 },
};

const DEFAULT_EASE = [0.22, 1, 0.36, 1];

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
  ease = DEFAULT_EASE,

  // Scroll settings
  once = true,
  amount = 0.15,
  margin = "0px 0px -40px 0px",
  root,

  ...props
}) {
  const shouldReduceMotion = useReducedMotion();

  const Component = motion[as] ?? motion.div;
  const offset = DIRECTIONS[direction] ?? DIRECTIONS.up;

  const hidden = {
    opacity: 0,
    x: offset.x * distance,
    y: offset.y * distance,
    scale: initialScale,
  };

  const visible = {
    opacity: 1,
    x: 0,
    y: 0,
    scale: 1,
  };

  return (
    <Component
      {...props}
      className={className}
      initial={shouldReduceMotion ? false : hidden}
      whileInView={shouldReduceMotion ? undefined : visible}
      viewport={{
        once,
        amount,
        margin,
        ...(root ? { root } : {}),
      }}
      transition={{
        duration,
        delay,
        ease,
      }}
    >
      {children}
    </Component>
  );
}