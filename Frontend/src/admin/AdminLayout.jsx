import { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Boxes, ChevronLeft, ChevronRight, ClipboardList, Images, LayoutDashboard, LogOut, Menu, Package, Settings2, Tags, Truck, UsersRound, X, ScrollText, TicketPercent, RefreshCcw } from 'lucide-react';
import { useAdminAuth } from './useAdminAuth';
import companyLogo from '../assets/Nishree Attaire Company Logo HD_640x640.png';
import { ThemeToggle } from '../theme/ThemeContext';
import BackNavigation from '../components/BackNavigation';

const navigation = [
  { to: '/admin', label: 'Overview', Icon: LayoutDashboard, end: true },
  { to: '/admin/products', label: 'Products', Icon: Package },
  { to: '/admin/homepage-images', label: 'Homepage images', Icon: Images },
  { to: '/admin/categories', label: 'Categories', Icon: Tags },
  { to: '/admin/inventory', label: 'Inventory', Icon: Boxes },
  { to: '/admin/orders', label: 'Orders', Icon: ClipboardList },
  { to: '/admin/shipping', label: 'Shipping', Icon: Truck },
  { to: '/admin/aftercare', label: 'Returns & refunds', Icon: RefreshCcw },
  { to: '/admin/customers', label: 'Customers', Icon: UsersRound },
  { to: '/admin/coupons', label: 'Coupons', Icon: TicketPercent },
  { to: '/admin/policies', label: 'Store policies', Icon: ScrollText },
  { to: '/admin/settings', label: 'Store details', Icon: Settings2 },
];

export default function AdminLayout() {
  const { admin, logout } = useAdminAuth();
  const navigate = useNavigate();
  const [navigationOpen, setNavigationOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    if (!navigationOpen) return undefined;
    const onKeyDown = (event) => { if (event.key === 'Escape') setNavigationOpen(false); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [navigationOpen]);

  const signOut = async () => { await logout(); navigate('/admin/login', { replace: true }); };
  return <div className={`admin-shell${sidebarCollapsed ? ' is-sidebar-collapsed' : ''}`}>
    {navigationOpen && <button className="admin-nav-scrim" type="button" aria-label="Close admin navigation" onClick={() => setNavigationOpen(false)} />}
    <aside id="admin-navigation" className={`admin-sidebar${navigationOpen ? ' is-open' : ''}`}><div className="admin-brand"><img src={companyLogo} alt="" width="44" height="44" /><div><strong>Nishree</strong><small>ATTIRE · ADMIN</small></div><button className="admin-sidebar-collapse" type="button" onClick={() => setSidebarCollapsed((collapsed) => !collapsed)} aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'} title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}>{sidebarCollapsed ? <ChevronRight size={17} /> : <ChevronLeft size={17} />}</button><button className="admin-nav-close" type="button" aria-label="Close admin navigation" onClick={() => setNavigationOpen(false)}><X size={19} /></button></div>
      <nav aria-label="Admin navigation">{navigation.map(({ to, label, Icon, end }) => <NavLink key={to} to={to} end={end} title={sidebarCollapsed ? label : undefined} onClick={() => setNavigationOpen(false)}><Icon size={18} strokeWidth={1.7} /><span>{label}</span></NavLink>)}</nav>
      <div className="admin-sidebar-bottom"><div className="admin-user-chip"><span className="admin-user-avatar">{admin?.name?.slice(0, 1) || 'N'}</span><div><strong>{admin?.name || 'Administrator'}</strong><small>{admin?.role?.name || 'Store administrator'}</small></div></div><button type="button" onClick={signOut}><LogOut size={17} /> Sign out</button><a href="/" className="admin-store-link">View storefront ↗</a></div>
    </aside>
    <main className="admin-main"><header className="admin-topbar"><button className="admin-nav-toggle" type="button" aria-label={navigationOpen ? 'Close admin navigation' : 'Open admin navigation'} aria-expanded={navigationOpen} aria-controls="admin-navigation" onClick={() => setNavigationOpen((open) => !open)}>{navigationOpen ? <X size={19} /> : <Menu size={19} />}</button><div><span className="eyebrow">NISHREE ATTIRE</span><strong>Store administration</strong></div><div className="admin-topbar-actions"><ThemeToggle /><span className="admin-topbar-user">{admin?.email}</span></div></header><div className="admin-content"><BackNavigation /><Outlet /></div></main>
  </div>;
}
