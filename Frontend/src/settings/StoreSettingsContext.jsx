import { useEffect, useMemo, useState } from 'react';
import { api } from '../api/client';
import { defaultStoreSettings, StoreSettingsContext } from './storeSettingsStore';

export function StoreSettingsProvider({ children }) {
  const [settings, setSettings] = useState(defaultStoreSettings);
  useEffect(() => {
    const controller = new AbortController();
    api.get('/settings', { signal: controller.signal })
      .then(({ data }) => setSettings({ ...defaultStoreSettings, ...data.settings }))
      .catch((error) => { if (error.name !== 'CanceledError') setSettings(defaultStoreSettings); });
    return () => controller.abort();
  }, []);
  const value = useMemo(() => settings, [settings]);
  return <StoreSettingsContext.Provider value={value}>{children}</StoreSettingsContext.Provider>;
}
