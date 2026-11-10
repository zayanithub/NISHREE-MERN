import { useEffect, useMemo, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Boxes, ChevronLeft, ChevronRight, ClipboardList, Images, LayoutDashboard, LogOut, Menu, Package, RefreshCcw, ScrollText, Search, Settings2, Tags, TicketPercent, Truck, UsersRound, X, BookOpenText } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import { useAdminAuth } from './useAdminAuth';
import companyLogo from '../assets/Nishree Attaire Company Logo HD_640x640.webp';
import { ThemeToggle } from '../theme/ThemeContext';
import BackNavigation from '../components/BackNavigation';
import './AdminWorkspace.css';
import './AdminPremium.css';

const navigationGroups = [
  { label: 'Workspace', items: [{ to: '/admin', label: 'Overview', Icon: LayoutDashboard, end: true }] },
  { label: 'Storefront', items: [
    { to: '/admin/products', label: 'Products', Icon: Package },
    { to: '/admin/categories', label: 'Categories', Icon: Tags },
    { to: '/admin/inventory', label: 'Inventory', Icon: Boxes },
    { to: '/admin/homepage-images', label: 'Homepage images', Icon: Images },
    { to: '/admin/blogs', label: 'Journal', Icon: BookOpenText },
    { to: '/admin/coupons', label: 'Coupons', Icon: TicketPercent },
  ] },
  { label: 'Orders & care', items: [
    { to: '/admin/orders', label: 'Orders', Icon: ClipboardList },
    { to: '/admin/shipping', label: 'Shipping', Icon: Truck },
    { to: '/admin/aftercare', label: 'Returns & refunds', Icon: RefreshCcw },
    { to: '/admin/customers', label: 'Customers', Icon: UsersRound },
  ] },
  { label: 'Preferences', items: [
    { to: '/admin/policies', label: 'Store policies', Icon: ScrollText },
    { to: '/admin/settings', label: 'Store details', Icon: Settings2 },
  ] },
];
const navigation = navigationGroups.flatMap(({ items }) => items);

export default function AdminLayout() {
  const { admin, logout } = useAdminAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const reduceMotion = useReducedMotion();
  const [navigationOpen, setNavigationOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [overviewSearch, setOverviewSearch] = useState('');
  const isOverview = location.pathname === '/admin';
  const matchingPages = useMemo(() => {
    const query = overviewSearch.trim().toLowerCase();
    return query ? navigation.filter(({ label }) => label.toLowerCase().includes(query)).slice(0, 5) : [];
  }, [overviewSearch]);
  const currentPage = navigation.find(({ to, end }) => end
    ? location.pathname === to
    : location.pathname === to || location.pathname.startsWith(`${to}/`)) || navigation[0];

  useEffect(() => {
    if (!navigationOpen) return undefined;
    const onKeyDown = (event) => { if (event.key === 'Escape') setNavigationOpen(false); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [navigationOpen]);

  const signOut = async () => { await logout(); navigate('/admin/login', { replace: true }); };
  const searchPages = (event) => {
    event.preventDefault();
    if (!matchingPages.length) return;
    navigate(matchingPages[0].to);
    setOverviewSearch('');
  };
  return <div className={`admin-shell${sidebarCollapsed ? ' is-sidebar-collapsed' : ''}${isOverview ? ' is-overview' : ''}`}>
    {navigationOpen && <button className="admin-nav-scrim" type="button" aria-label="Close admin navigation" onClick={() => setNavigationOpen(false)} />}
    <aside id="admin-navigation" className={`admin-sidebar${navigationOpen ? ' is-open' : ''}`}><div className="admin-brand"><img src={companyLogo} alt="" width="44" height="44" /><div><strong>Nishree</strong><small>ATTIRE · ADMIN STUDIO</small></div><button className="admin-sidebar-collapse" type="button" onClick={() => setSidebarCollapsed((collapsed) => !collapsed)} aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'} title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}>{sidebarCollapsed ? <ChevronRight size={17} /> : <ChevronLeft size={17} />}</button><button className="admin-nav-close" type="button" aria-label="Close admin navigation" onClick={() => setNavigationOpen(false)}><X size={19} /></button></div>
      <div className="admin-sidebar-kicker"><span className="admin-sidebar-live-dot" />YOUR ATELIER, IN ONE PLACE</div>
      <nav aria-label="Admin navigation">{navigationGroups.map(({ label: groupLabel, items }) => <div className="admin-nav-group" key={groupLabel}><span className="admin-nav-group-label">{groupLabel}</span>{items.map(({ to, label, Icon, end }) => <NavLink key={to} to={to} end={end} title={sidebarCollapsed ? label : undefined} onClick={() => setNavigationOpen(false)}><Icon size={18} strokeWidth={1.7} /><span>{label}</span><ChevronRight className="admin-nav-item-arrow" size={14} aria-hidden="true" /></NavLink>)}</div>)}</nav>
      <div className="admin-sidebar-bottom"><div className="admin-user-chip"><span className="admin-user-avatar">{admin?.name?.slice(0, 1) || 'N'}</span><div><strong>{admin?.name || 'Administrator'}</strong><small>{admin?.role?.name || 'Store administrator'}</small></div></div><button type="button" onClick={signOut}><LogOut size={17} /> Sign out</button><a href="/" className="admin-store-link">View storefront ↗</a></div>
    </aside>
    <main className="admin-main"><header className="admin-topbar"><button className="admin-nav-toggle" type="button" aria-label={navigationOpen ? 'Close admin navigation' : 'Open admin navigation'} aria-expanded={navigationOpen} aria-controls="admin-navigation" onClick={() => setNavigationOpen((open) => !open)}>{navigationOpen ? <X size={19} /> : <Menu size={19} />}</button><div className="admin-topbar-title"><span className="eyebrow">NISHREE ATTIRE · ADMIN STUDIO</span><strong>{currentPage.label}</strong></div>{isOverview && <div className="admin-overview-search-wrap"><form className="admin-overview-search" role="search" onSubmit={searchPages}><Search size={16} aria-hidden="true" /><input value={overviewSearch} onChange={(event) => setOverviewSearch(event.target.value)} placeholder="Find an admin page…" aria-label="Find an admin page" autoComplete="off" /><kbd>↵</kbd></form>{matchingPages.length > 0 && <div className="admin-overview-search-results" role="listbox" aria-label="Matching admin pages">{matchingPages.map(({ to, label, Icon }) => <button key={to} type="button" role="option" aria-selected="false" onClick={() => { navigate(to); setOverviewSearch(''); }}><Icon size={15} aria-hidden="true" /><span>{label}</span></button>)}</div>}</div>}<div className="admin-topbar-actions"><ThemeToggle /><span className="admin-topbar-user">{admin?.email}</span></div></header><div className="admin-content"><BackNavigation /><motion.div key={location.pathname} className="admin-route-transition" initial={reduceMotion ? false : { opacity: 0, y: 9 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .32, ease: [0.22, 1, 0.36, 1] }}><Outlet /></motion.div></div></main>
  </div>;
}
