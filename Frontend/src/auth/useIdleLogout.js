import { useEffect } from 'react';

const IDLE_TIMEOUT_MS = 30 * 60 * 1000;
const ACTIVITY_EVENTS = ['pointerdown', 'pointermove', 'keydown', 'scroll', 'touchstart', 'wheel'];

export function useIdleLogout(isAuthenticated, logout, storageKey) {
  useEffect(() => {
    if (!isAuthenticated) return undefined;

    let timer;
    let lastActivity = Number(window.localStorage.getItem(storageKey)) || Date.now();
    let lastSavedActivity = lastActivity;
    let expiring = false;

    const scheduleExpiry = () => {
      if (expiring) return;
      window.clearTimeout(timer);
      const remaining = lastActivity + IDLE_TIMEOUT_MS - Date.now();
      if (remaining > 0) {
        timer = window.setTimeout(scheduleExpiry, remaining);
        return;
      }

      expiring = true;
      void logout().catch((error) => {
        console.error('Automatic sign-out failed:', error.message);
      });
    };

    const recordActivity = () => {
      if (expiring) return;
      lastActivity = Date.now();
      if (lastActivity - lastSavedActivity >= 1_000) {
        lastSavedActivity = lastActivity;
        window.localStorage.setItem(storageKey, String(lastActivity));
      }
      scheduleExpiry();
    };

    const syncActivity = (event) => {
      if (event.key !== storageKey) return;
      const timestamp = Number(event.newValue);
      if (Number.isFinite(timestamp) && timestamp > lastActivity) {
        lastActivity = timestamp;
        lastSavedActivity = timestamp;
        scheduleExpiry();
      }
    };

    const checkVisibility = () => {
      if (document.visibilityState === 'visible') scheduleExpiry();
    };

    window.localStorage.setItem(storageKey, String(lastActivity));
    ACTIVITY_EVENTS.forEach((eventName) => window.addEventListener(eventName, recordActivity, { passive: true }));
    window.addEventListener('storage', syncActivity);
    document.addEventListener('visibilitychange', checkVisibility);
    scheduleExpiry();

    return () => {
      window.clearTimeout(timer);
      ACTIVITY_EVENTS.forEach((eventName) => window.removeEventListener(eventName, recordActivity));
      window.removeEventListener('storage', syncActivity);
      document.removeEventListener('visibilitychange', checkVisibility);
    };
  }, [isAuthenticated, logout, storageKey]);
}
