import { Bell, Heart, MapPin, Package, RefreshCw, Star, UserRound } from 'lucide-react';

export const accountNavigation = [
  { to: '/account', label: 'My account', Icon: UserRound, end: true },
  { to: '/account/wishlist', label: 'Favorites / wishlist', Icon: Heart },
  { to: '/account/addresses', label: 'Address book', Icon: MapPin },
  { to: '/account/orders', label: 'My orders & tracking', Icon: Package },
  { to: '/account/reviews', label: 'My reviews', Icon: Star },
  { to: '/account/notifications', label: 'Notifications', Icon: Bell },
  { to: '/account/returns', label: 'Returns & exchanges', Icon: RefreshCw },
];
