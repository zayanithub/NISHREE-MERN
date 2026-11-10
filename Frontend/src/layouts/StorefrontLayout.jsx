import { Outlet, useLocation } from 'react-router-dom';
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

  useEffect(() => {
    if (assistantOpen) return undefined;
    const pointerMedia = window.matchMedia('(any-pointer: fine)');
    const motionMedia = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (!pointerMedia.matches || motionMedia.matches) return undefined;

    let frameId = 0;
    let pointerX = 0;
    let pointerY = 0;
    let centerX = 0;
    let centerY = 0;
    const updateCenter = () => {
      const bounds = assistantLauncherRef.current?.getBoundingClientRect();
      if (!bounds) return;
      centerX = bounds.left + bounds.width / 2;
      centerY = bounds.top + bounds.height / 2;
    };
    const resetEyeDirection = () => {
      if (frameId) window.cancelAnimationFrame(frameId);
      frameId = 0;
      const launcher = assistantLauncherRef.current;
      launcher?.style.setProperty('--assistant-eye-x', '0px');
      launcher?.style.setProperty('--assistant-eye-y', '0px');
    };
    const updateEyeDirection = () => {
      frameId = 0;
      const launcher = assistantLauncherRef.current;
      if (!launcher) return;
      const deltaX = pointerX - centerX;
      const deltaY = pointerY - centerY;
      const distance = Math.hypot(deltaX, deltaY);
      const travel = Math.min(3, distance / 24);
      launcher.style.setProperty('--assistant-eye-x', `${distance ? (deltaX / distance) * travel : 0}px`);
      launcher.style.setProperty('--assistant-eye-y', `${distance ? (deltaY / distance) * travel : 0}px`);
    };
    const followPointer = (event) => {
      if (event.pointerType === 'touch') return;
      pointerX = event.clientX;
      pointerY = event.clientY;
      if (!frameId) frameId = window.requestAnimationFrame(updateEyeDirection);
    };

    updateCenter();
    window.addEventListener('pointermove', followPointer, { passive: true });
    window.addEventListener('pointerleave', resetEyeDirection);
    window.addEventListener('resize', updateCenter, { passive: true });
    return () => {
      if (frameId) window.cancelAnimationFrame(frameId);
      window.removeEventListener('pointermove', followPointer);
      window.removeEventListener('pointerleave', resetEyeDirection);
      window.removeEventListener('resize', updateCenter);
      resetEyeDirection();
    };
  }, [assistantOpen]);

  return <div className={`shopping-assistant${assistantOpen ? ' is-open' : ''}`}>
    {!assistantOpen && <>
      <span className="assistant-tooltip" aria-hidden="true">Need help finding your perfect saree?</span>
      <button ref={assistantLauncherRef} className="assistant-launcher" type="button" aria-label="Ask Nishree — open shopping assistant" aria-expanded={false} aria-controls="nishree-assistant-panel" onClick={() => { setAssistantLoaded(true); setAssistantOpen(true); }}>
        <span className="assistant-launcher-eyes" aria-hidden="true">
          <span className="assistant-launcher-eye"><span className="assistant-launcher-pupil" /></span>
          <span className="assistant-launcher-eye"><span className="assistant-launcher-pupil" /></span>
        </span>
        <span className="assistant-launcher-smile" aria-hidden="true" />
      </button>
    </>}
    {assistantLoaded && <Suspense fallback={null}><ShoppingAssistant open={assistantOpen} onClose={closeShoppingAssistant} /></Suspense>}
  </div>;
}

export default function StorefrontLayout() {
  const location = useLocation();
  const [revealDone, setRevealDone] = useState(false);
  const [initialPath] = useState(() => typeof window !== 'undefined' ? window.location.pathname : '/');
  const [showSignatureReveal] = useState(() => typeof window !== 'undefined' && window.innerWidth > 600);
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
    {initialHome && showSignatureReveal && !revealDone && <Suspense fallback={null}><SignatureReveal onComplete={() => setRevealDone(true)} /></Suspense>}
  </>;
}
