import { createContext } from 'react';

export const defaultStoreSettings = {
  storeName: 'Nishree Attire',
  supportEmail: 'info.nishree@gmail.com',
  supportPhone: '9344901028',
  businessAddress: '44/41, Pillaiyar Kovil 1st Street, Mambakkam, Chennai, Tamil Nadu 600127, India.',
  whatsappNumber: '919344901028',
  whatsappUrl: 'https://wa.me/919344901028/?text=Hi,%20Can%20you%20send%20details%20about%20your%20products',
  instagramUrl: 'https://www.instagram.com/nishree_fashions/',
  facebookUrl: 'https://www.facebook.com/share/19KgfTEgdN/',
  codLimit: 2000,
  returnWindowDays: 5,
  exchangeWindowDays: 5,
};

export const StoreSettingsContext = createContext(defaultStoreSettings);
