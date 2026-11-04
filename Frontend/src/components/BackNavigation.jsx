import { ArrowLeft } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';

const hiddenPaths = new Set(['/', '/shop', '/bag', '/admin', '/admin/login']);

function fallbackPath(location) {
  const { pathname, state } = location;

  if (pathname.startsWith('/admin/')) return '/admin';
  if (pathname === '/checkout') return '/bag';
  if (/^\/orders\/[^/]+$/.test(pathname)) return '/account/orders';
  if (/^\/account\/orders\/[^/]+$/.test(pathname)) return '/account/orders';
  if (pathname === '/account/orders') return '/account';
  if (pathname.startsWith('/account/')) return '/account';
  if (pathname === '/wishlist') return '/shop';
  if (/^\/products\/[^/]+$/.test(pathname) || /^\/collections\/[^/]+$/.test(pathname)) return '/shop';
  if (/^\/policies\/[^/]+$/.test(pathname)) return '/policies';

  const returnTo = state?.from;
  const returnPath = typeof returnTo === 'string' ? returnTo : returnTo?.pathname;
  if (
    ['/login', '/register', '/forgot-password'].includes(pathname) &&
    typeof returnPath === 'string' &&
    returnPath.startsWith('/') &&
    !returnPath.startsWith('//')
  ) {
    return returnPath;
  }

  return '/';
}

export default function BackNavigation() {
  const location = useLocation();
  const navigate = useNavigate();

  if (hiddenPaths.has(location.pathname)) return null;

  const goBack = () => {
    if (location.pathname === '/checkout' && !window.confirm('Leave checkout? Your delivery selection and order note may not be saved.')) {
      return;
    }
    if (typeof window.history.state?.idx === 'number' && window.history.state.idx > 0) {
      navigate(-1);
      return;
    }
    navigate(fallbackPath(location), { replace: true });
  };

  const isAdminPage = location.pathname.startsWith('/admin/');

  return (
    <button className={`back-navigation${isAdminPage ? ' admin-back-navigation' : ''}`} type="button" onClick={goBack} aria-label="Go back to the previous page">
      <ArrowLeft size={17} aria-hidden="true" />
      <span>Back</span>
    </button>
  );
}
