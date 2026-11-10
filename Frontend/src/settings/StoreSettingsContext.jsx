import { useEffect, useMemo, useState } from 'react';
import { api } from '../api/client';
import { defaultStoreSettings, StoreSettingsContext } from './storeSettingsStore';

export function StoreSettingsProvider({ children }) {
  const [settings, setSettings] = useState(defaultStoreSettings);
  useEffect(() => {
    const controller = new AbortController();
    const loadSettings = () => {
      api.get('/settings', { signal: controller.signal })
        .then(({ data }) => setSettings({ ...defaultStoreSettings, ...data.settings }))
        .catch((error) => {
          if (!controller.signal.aborted && error?.name !== 'CanceledError' && error?.code !== 'ERR_CANCELED') {
            console.error('Store settings could not be loaded:', error.message);
          }
        });
    };

    if ('requestIdleCallback' in window) {
      const idleHandle = window.requestIdleCallback(loadSettings, { timeout: 1500 });
      return () => {
        window.cancelIdleCallback(idleHandle);
        controller.abort();
      };
    }

    const timer = window.setTimeout(loadSettings, 500);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, []);
  const value = useMemo(() => settings, [settings]);
  return <StoreSettingsContext.Provider value={value}>{children}</StoreSettingsContext.Provider>;
}
