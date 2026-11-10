import { useSyncExternalStore } from 'react';

const query = '(prefers-reduced-motion: reduce)';

function subscribe(onChange) {
  if (typeof window === 'undefined' || !window.matchMedia) return () => {};
  const mediaQuery = window.matchMedia(query);
  mediaQuery.addEventListener('change', onChange);
  return () => mediaQuery.removeEventListener('change', onChange);
}

function getSnapshot() {
  return typeof window !== 'undefined' && window.matchMedia?.(query).matches === true;
}

export default function useReducedMotionPreference() {
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
