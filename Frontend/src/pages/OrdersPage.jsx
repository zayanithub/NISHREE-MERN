import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Package, Truck } from 'lucide-react';
import { customerApi } from '../api/customerApi';
import { normalizeApiError } from '../api/client';
import { ErrorState, EmptyState, LoadingState } from '../components/States';
import { formatDate, formatPrice } from '../utils/format';

const readable = (value = '') => value.replaceAll('_', ' ');
const statusClass = (value = '') => `status-${String(value).toLowerCase().replaceAll('_', '-')}`;
const filterOptions = [
  { key: 'all', label: 'All orders' },
  { key: 'active', label: 'In progress' },
  { key: 'delivered', label: 'Delivered' },
  { key: 'cancelled', label: 'Cancelled' },
  { key: 'returned', label: 'Returned' },
];

export default function OrdersPage() {
  const [orders, setOrders] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [loadedPage, setLoadedPage] = useState(0);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    try {
      const result = await customerApi.orders({ page, limit: 20 });
      setOrders(result.orders || []);
      setPagination(result.pagination || null);
      setError('');
      setLoadedPage(page);
    } catch (requestError) {
      setError(normalizeApiError(requestError).message);
      setLoadedPage(page);
    } finally {
      setLoading(false);
    }
  }, [page]);
  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const visibleOrders = useMemo(() => orders.filter((order) => {
    if (filter === 'active') return !['delivered', 'cancelled', 'returned'].includes(order.orderStatus);
    if (filter === 'cancelled') return order.orderStatus === 'cancelled';
    if (filter === 'returned') return ['returned', 'return_requested'].includes(order.orderStatus);
    return filter === 'all' || order.orderStatus === filter;
  }), [filter, orders]);

  return (
    <div className="page-wrap orders-page">
      <div className="breadcrumbs"><Link to="/account">My account</Link><span>/</span><span>Orders</span></div>
      <div className="page-title-row"><div><span className="eyebrow">YOUR NISHREE STORY</span><h1>My orders</h1><p className="account-page-intro">Order details and delivery updates, all together.</p></div><Link to="/shop" className="text-link">Discover the collection <ArrowRight size={15} /></Link></div>
      <div className="order-filter-tabs" role="tablist" aria-label="Filter orders">{filterOptions.map((option) => <button key={option.key} type="button" role="tab" aria-selected={filter === option.key} className={filter === option.key ? 'is-active' : ''} onClick={() => setFilter(option.key)}>{option.label}</button>)}</div>
      {loading || loadedPage !== page ? <LoadingState label="Gathering your orders…" /> : error ? <ErrorState message={error} onRetry={() => { setLoading(true); setError(''); void load(); }} /> : visibleOrders.length ? (
        <div className="orders-list">
          {visibleOrders.map((order) => {
            const firstItem = order.items?.[0];
            const isClosed = ['cancelled', 'returned'].includes(order.orderStatus);
            return (
              <article className={`order-card account-order-card ${isClosed ? 'is-closed' : ''}`} key={order._id}>
                <header>
                  <div><span className="eyebrow">ORDER PLACED · {formatDate(order.createdAt)}</span><strong>{order.orderNumber}</strong></div>
                  <span className={`status-pill ${statusClass(order.orderStatus)}`}>{readable(order.orderStatus)}</span>
                </header>
                <div className="order-card-body">
                  <div className="order-thumbnails">
                    {order.items?.slice(0, 3).map((item) => <div key={item._id} className="order-thumb">{item.image && <img src={item.image} alt={item.productName || ''} loading="lazy" decoding="async" width="80" height="100" />}</div>)}
                    {order.items?.length > 3 && <span className="order-more">+{order.items.length - 3}</span>}
                  </div>
                  <div className="order-card-meta"><strong className="order-card-product-name">{firstItem?.productName || 'Your Nishree order'}</strong><span>{order.items?.length || 0} {(order.items?.length || 0) === 1 ? 'piece' : 'pieces'} · Payment {readable(order.paymentStatus)}</span><strong>{formatPrice(order.totalAmount, order.currency)}</strong></div>
                  <div className="order-card-actions">
                    <Link to={`/account/orders/${order._id}`} className="button button-outline"><Truck size={15} /> Track order</Link>
                    <Link to={`/account/orders/${order._id}`} className="order-view-link">View details <ArrowRight size={14} /></Link>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <EmptyState title={filter === 'all' ? 'Your first Nishree order is still ahead.' : `No ${filterOptions.find((option) => option.key === filter)?.label.toLowerCase()} orders.`}>
          <span>{filter === 'all' ? 'When you place an order, its details and updates will appear here.' : 'Try another filter to see more of your order history.'}</span>
          {filter === 'all' && <Link to="/shop" className="button button-primary"><Package size={15} /> Explore the collection</Link>}
        </EmptyState>
      )}
      {!loading && pagination?.totalPages > 1 && <nav className="pagination" aria-label="Order pages"><button className="button button-quiet" type="button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}><ArrowLeft size={15} aria-hidden="true" /> Previous</button><span>Page {pagination.page} of {pagination.totalPages}</span><button className="button button-quiet" type="button" disabled={page >= pagination.totalPages} onClick={() => setPage((value) => value + 1)}>Next <ArrowRight size={15} aria-hidden="true" /></button></nav>}
    </div>
  );
}
