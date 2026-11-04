import { useCallback, useEffect, useState } from 'react';
import { Search, UserRound } from 'lucide-react';
import { adminApi } from '../adminApi';
import { formatPrice } from '../../utils/format';
import AdminDataTools from '../components/AdminDataTools';

const title = (value = '') => value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
const customerColumns = [
  ['Name', (customer) => customer.name],
  ['Email', (customer) => customer.email],
  ['Phone', (customer) => customer.phone || ''],
  ['Status', (customer) => title(customer.status)],
  ['Joined', (customer) => customer.createdAt ? new Date(customer.createdAt).toISOString() : ''],
];

export default function AdminCustomersPage() {
  const [customers, setCustomers] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState(null);
  const load = useCallback(async () => {
    try { const result = await adminApi.customers({ page: 1, limit: 100, search: search || undefined }); setCustomers(result.customers || []); }
    catch (requestError) { setError(requestError.response?.data?.message || 'Customer details could not be loaded.'); }
    finally { setLoading(false); }
  }, [search]);
  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);
  const open = async (customer) => {
    try { setSelected({ customer, orders: [], loading: true }); const result = await adminApi.customer(customer._id); setSelected({ ...result, loading: false }); }
    catch (requestError) { setSelected({ customer, orders: [], loading: false, error: requestError.response?.data?.message || 'Order history could not be loaded.' }); }
  };
  const exportFilteredCustomers = async () => {
    const first = await adminApi.customers({ page: 1, limit: 100, search: search || undefined });
    const allCustomers = [...(first.customers || [])];
    for (let page = 2; page <= (first.pagination?.totalPages || 1); page += 1) {
      const result = await adminApi.customers({ page, limit: 100, search: search || undefined });
      allCustomers.push(...(result.customers || []));
    }
    return allCustomers;
  };

  return <div className="admin-page"><div className="admin-page-heading"><div><span className="eyebrow">Registered accounts</span><h1>Customers</h1><p>View customer profiles and their recent order history.</p></div><AdminDataTools filename="nishree-customers" columns={customerColumns} rows={customers} loadRows={exportFilteredCustomers} disabled={!customers.length} /></div>
    <div className="admin-toolbar"><form className="admin-search" onSubmit={(event) => { event.preventDefault(); void load(); }}><Search size={17} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, email or phone" aria-label="Search customers" /><button type="submit">Search</button></form></div>
    {error && <p className="admin-inline-error" role="alert">{error}</p>}
    {loading ? <div className="admin-empty-state">Loading customers…</div> : customers.length ? <div className="admin-customer-grid">{customers.map((customer) => <button type="button" className="admin-customer-card" key={customer._id} onClick={() => void open(customer)}><span className="admin-customer-avatar">{customer.profileImage?.url ? <img src={customer.profileImage.url} alt="" loading="lazy" /> : <UserRound size={21} />}</span><strong>{customer.name}</strong><span>{customer.email}</span><small>{customer.phone || 'Phone not provided'} · {title(customer.status)}</small><em>View customer</em></button>)}</div> : <div className="admin-empty-state">No customers match this search.</div>}
    {selected && <div className="admin-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelected(null); }}><section className="admin-modal" role="dialog" aria-modal="true" aria-labelledby="customer-details-title"><header><div><span className="eyebrow">Customer profile</span><h2 id="customer-details-title">{selected.customer?.name}</h2></div><button className="admin-icon-button" type="button" onClick={() => setSelected(null)} aria-label="Close">×</button></header>
      <div className="admin-customer-profile">{selected.customer?.profileImage?.url ? <img src={selected.customer.profileImage.url} alt={`${selected.customer.name}'s profile`} /> : <UserRound size={26} />}<div><strong>{selected.customer?.email}</strong><span>{selected.customer?.phone || 'Phone not provided'}</span><span>Joined {selected.customer?.createdAt ? new Date(selected.customer.createdAt).toLocaleDateString('en-IN') : '—'}</span></div></div>
      <h3>Recent orders</h3>{selected.loading ? <div className="admin-empty-state">Loading order history…</div> : selected.error ? <p className="admin-inline-error">{selected.error}</p> : selected.orders?.length ? <div className="admin-customer-orders">{selected.orders.map((order) => <article key={order._id}><div><strong>{order.orderNumber}</strong><span>{title(order.orderStatus)} · {new Date(order.createdAt).toLocaleDateString('en-IN')}</span><small>{(order.items || []).map((item) => `${item.productName || 'Saree'} × ${item.quantity}`).join(', ')}</small></div><strong>{formatPrice(order.totalAmount, order.currency)}</strong></article>)}</div> : <p className="admin-empty-state">No orders for this customer yet.</p>}
    </section></div>}
  </div>;
}
