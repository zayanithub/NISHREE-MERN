import { useContext } from 'react';
import { StoreSettingsContext } from './storeSettingsStore';

export const useStoreSettings = () => useContext(StoreSettingsContext);
