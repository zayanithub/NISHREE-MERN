import { ArrowRight, LogOut, UserRound } from 'lucide-react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '../auth/useAuth';
import { accountNavigation } from '../account/accountNavigation';
import { useEffect, useState } from 'react';
import { customerApi } from '../api/customerApi';
import { normalizeApiError } from '../api/client';

export default function AccountLayout() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [unreadCount, setUnreadCount] = useState(0);

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
  }, [location.pathname]);

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
    <div className="account-route-page">
      <div className="account-route-layout">
        <aside className="account-route-sidebar" aria-label="Account profile and navigation">
          <div className="account-route-profile">
            <span className="account-route-avatar">
              {user?.profileImage
                ? <img src={user.profileImage} alt="" />
                : user?.name?.trim()?.slice(0, 1)?.toUpperCase() || <UserRound size={22} aria-hidden="true" />}
            </span>
            <div><strong>{user?.name || 'Your account'}</strong><span>{user?.email || ''}</span></div>
          </div>
          <nav className="account-route-navigation" aria-label="Account sections">
            {accountNavigation.map(({ to, label, Icon, end }) => (
              <NavLink key={to} to={to} end={end} className={({ isActive }) => isActive ? 'is-active' : undefined}>
                <Icon size={17} aria-hidden="true" /><span>{label}</span>
                {label === 'Notifications' && unreadCount > 0 && <span className="account-nav-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>}
              </NavLink>
            ))}
          </nav>
          <button className="account-route-logout" type="button" onClick={() => void signOut()}><LogOut size={16} aria-hidden="true" /> Sign out</button>
          <NavLink className="account-route-shopping" to="/shop"><ArrowRight size={16} aria-hidden="true" /> Continue shopping</NavLink>
        </aside>
        <div className="account-route-content" key={location.pathname}><Outlet /></div>
      </div>
    </div>
  );
}
