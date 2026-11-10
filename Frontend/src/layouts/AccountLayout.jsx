import { ArrowRight, LogOut, Menu, X, UserRound } from 'lucide-react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '../auth/useAuth';
import { accountNavigation } from '../account/accountNavigation';
import { useEffect, useRef, useState } from 'react';
import { customerApi } from '../api/customerApi';
import { normalizeApiError } from '../api/client';
import companyLogo from '../assets/Nishree Attire Navbar Logo.webp';
import './AccountSections.css';

export default function AccountLayout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [unreadCount, setUnreadCount] = useState(0);
  const [mobileNavigationPath, setMobileNavigationPath] = useState('');
  const mobileMenuToggleRef = useRef(null);
  const isDashboard = location.pathname === '/account';
  const mobileNavigationOpen = mobileNavigationPath === location.pathname;

  useEffect(() => {
    if (!mobileNavigationOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const closeOnResize = () => {
      if (!window.matchMedia('(max-width: 900px)').matches) setMobileNavigationPath('');
    };
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') {
        setMobileNavigationPath('');
        mobileMenuToggleRef.current?.focus({ preventScroll: true });
      }
    };
    window.addEventListener('resize', closeOnResize);
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('resize', closeOnResize);
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [mobileNavigationOpen]);

  useEffect(() => {
    if (!mobileNavigationOpen) return undefined;
    const frame = window.requestAnimationFrame(() => {
      document.querySelector('#account-dashboard-navigation .account-route-navigation a')?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [mobileNavigationOpen]);

  useEffect(() => {
    let active = true;
    const refreshUnreadCount = async () => {
      try {
        const result = await customerApi.notifications({ page: 1, limit: 1, isRead: false });
        if (active) setUnreadCount(result.pagination?.total || 0);
      } catch (error) {
        if (active) {
          setUnreadCount(0);
          toast.error(`Notification count could not be loaded. ${normalizeApiError(error).message}`);
        }
      }
    };
    const onNotificationsUpdated = () => { void refreshUnreadCount(); };
    window.addEventListener('nishree:notifications-updated', onNotificationsUpdated);
    void refreshUnreadCount();
    return () => {
      active = false;
      window.removeEventListener('nishree:notifications-updated', onNotificationsUpdated);
    };
  }, []);

  const trapMobileNavigationFocus = (event) => {
    if (!mobileNavigationOpen || event.key !== 'Tab') return;
    const focusable = event.currentTarget.querySelectorAll('a[href], button:not(:disabled)');
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  };

  const closeMobileNavigation = () => {
    if (!mobileNavigationOpen) return;
    setMobileNavigationPath('');
    window.requestAnimationFrame(() => mobileMenuToggleRef.current?.focus({ preventScroll: true }));
  };

  const signOut = async () => {
    try {
      await logout();
      navigate('/login', { replace: true });
    } catch {
      toast.error('You have been signed out on this device, but the server could not confirm the session cleanup.');
      navigate('/login', { replace: true });
    }
  };

  return (
    <div className={`account-route-page${isDashboard ? ' is-dashboard-page' : ''}`}>
      <div className={`account-route-layout${isDashboard ? ' is-dashboard-layout' : ''}`}>
        <div className="account-dashboard-mobilebar">
          <button
            ref={mobileMenuToggleRef}
            type="button"
            className="account-dashboard-menu-toggle"
            aria-expanded={mobileNavigationOpen}
            aria-controls="account-dashboard-navigation"
            onClick={() => setMobileNavigationPath((path) => path === location.pathname ? '' : location.pathname)}
          >
            {mobileNavigationOpen ? <X size={18} aria-hidden="true" /> : <Menu size={18} aria-hidden="true" />}
            <span>{mobileNavigationOpen ? 'Close menu' : 'Account menu'}</span>
          </button>
          <span className="account-dashboard-mobile-title">MY NISHREE</span>
        </div>
        {mobileNavigationOpen && (
          <button
            type="button"
            className="account-dashboard-scrim"
            aria-label="Close account navigation"
            onClick={closeMobileNavigation}
          />
        )}
        <aside
          id="account-dashboard-navigation"
          className={`account-route-sidebar is-mobile-sidebar${isDashboard ? ' is-dashboard-sidebar' : ''}${mobileNavigationOpen ? ' is-open' : ''}`}
          aria-label="Account profile and navigation"
          onKeyDown={trapMobileNavigationFocus}
        >
          {isDashboard && (
            <NavLink className="account-dashboard-brand" to="/account" aria-label="Nishree Attire account home">
              <img src={companyLogo} alt="" />
              <span><strong>NISHREE</strong><small>THE PRIVATE ATELIER</small></span>
            </NavLink>
          )}
          <div className="account-route-profile">
            <span className="account-route-avatar">
              {user?.profileImage
                ? <img src={user.profileImage} alt="" />
                : user?.name?.trim()?.slice(0, 1)?.toUpperCase() || <UserRound size={22} aria-hidden="true" />}
            </span>
            <div><strong>{user?.name || 'Your account'}</strong><span>{user?.email || ''}</span></div>
          </div>
          {isDashboard && <span className="account-dashboard-nav-label">YOUR ACCOUNT</span>}
          <nav className="account-route-navigation" aria-label="Account sections">
            {accountNavigation.map(({ to, label, Icon, end }) => (
              <NavLink key={to} to={to} end={end} className={({ isActive }) => isActive ? 'is-active' : undefined} onClick={closeMobileNavigation}>
                <Icon size={17} aria-hidden="true" /><span>{label}</span>
                {label === 'Notifications' && unreadCount > 0 && <span className="account-nav-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>}
              </NavLink>
            ))}
          </nav>
          <div className="account-dashboard-sidebar-bottom">
            {isDashboard && (
              <div className="account-dashboard-sidebar-promo">
                <span>THE NISHREE EDIT</span>
                <strong>Find a drape<br />that feels like you.</strong>
                <NavLink to="/product_hub" onClick={() => setMobileNavigationPath('')}>Visit Product Hub <ArrowRight size={14} aria-hidden="true" /></NavLink>
              </div>
            )}
            <button className="account-route-logout" type="button" onClick={() => void signOut()}><LogOut size={16} aria-hidden="true" /> Sign out</button>
            {!isDashboard && <NavLink className="account-route-shopping" to="/product_hub"><ArrowRight size={16} aria-hidden="true" /> Back to Product Hub</NavLink>}
          </div>
        </aside>
        <div className="account-route-content" key={location.pathname}><Outlet /></div>
      </div>
    </div>
  );
}
