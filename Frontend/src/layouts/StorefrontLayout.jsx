import { Outlet, useLocation } from 'react-router-dom';
import { lazy, Suspense, useEffect, useState } from 'react';
import SiteHeader from '../components/SiteHeader';
import SiteFooter from '../components/SiteFooter';
import CartDrawer from '../components/CartDrawer';
import ShoppingAssistant from '../components/ShoppingAssistant';
import BackNavigation from '../components/BackNavigation';
const SignatureReveal = lazy(() => import('../components/SignatureReveal'));

export default function StorefrontLayout() {
  const location = useLocation();
  const [revealDone, setRevealDone] = useState(false);
  const [initialPath] = useState(() => typeof window !== 'undefined' ? window.location.pathname : '/');
  const initialHome = initialPath === '/' || initialPath === '/home';
  const isAuthPage = ['/login', '/register', '/forgot-password'].includes(location.pathname);
  const isJournalRoute = location.pathname === '/blogs' || location.pathname.startsWith('/blogs/');
  const showShoppingAssistant = !isAuthPage;

  useEffect(() => {
    if (location.hash) {
      const frame = window.requestAnimationFrame(() => document.getElementById(decodeURIComponent(location.hash.slice(1)))?.scrollIntoView({ behavior: 'smooth' }));
      return () => window.cancelAnimationFrame(frame);
    }
    window.scrollTo({ top: 0, behavior: 'auto' });
    return undefined;
  }, [location.pathname, location.hash]);

  return <>
    <a className="skip-link" href="#main-content">Skip to content</a>
    <SiteHeader />
    <main id="main-content" className="storefront-main">{!isAuthPage && !isJournalRoute && <BackNavigation />}<Outlet /></main>
    <SiteFooter />
    <CartDrawer />
    {showShoppingAssistant && <ShoppingAssistant />}
    {initialHome && !revealDone && <Suspense fallback={null}><SignatureReveal onComplete={() => setRevealDone(true)} /></Suspense>}
  </>;
}
