import { Outlet, useLocation } from 'react-router-dom';
import { Bot } from 'lucide-react';
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import SiteHeader from '../components/SiteHeader';
import SiteFooter from '../components/SiteFooter';
import CartDrawer from '../components/CartDrawer';
import BackNavigation from '../components/BackNavigation';
const SignatureReveal = lazy(() => import('../components/SignatureReveal'));
const ShoppingAssistant = lazy(() => import('../components/ShoppingAssistant'));

function ShoppingAssistantHost() {
  const [assistantLoaded, setAssistantLoaded] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const assistantLauncherRef = useRef(null);
  const assistantWasOpenRef = useRef(false);
  const closeShoppingAssistant = useCallback(() => setAssistantOpen(false), []);

  useEffect(() => {
    if (!assistantOpen && assistantWasOpenRef.current) assistantLauncherRef.current?.focus();
    assistantWasOpenRef.current = assistantOpen;
  }, [assistantOpen]);

  return <div className="shopping-assistant">
    {!assistantOpen && <button ref={assistantLauncherRef} className="assistant-launcher" type="button" aria-label="Open shopping assistant" aria-expanded={false} aria-controls="nishree-assistant-panel" onClick={() => { setAssistantLoaded(true); setAssistantOpen(true); }}><Bot size={22} /><span>Ask Nishree</span></button>}
    {assistantLoaded && <Suspense fallback={null}><ShoppingAssistant open={assistantOpen} onClose={closeShoppingAssistant} /></Suspense>}
  </div>;
}

export default function StorefrontLayout() {
  const location = useLocation();
  const [revealDone, setRevealDone] = useState(false);
  const [initialPath] = useState(() => typeof window !== 'undefined' ? window.location.pathname : '/');
  const initialHome = initialPath === '/' || initialPath === '/home';
  const isAuthPage = ['/login', '/register', '/forgot-password'].includes(location.pathname);
  const isJournalRoute = location.pathname === '/blogs' || location.pathname.startsWith('/blogs/');

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
    {!isAuthPage && <ShoppingAssistantHost />}
    {initialHome && !revealDone && <Suspense fallback={null}><SignatureReveal onComplete={() => setRevealDone(true)} /></Suspense>}
  </>;
}
