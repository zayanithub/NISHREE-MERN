import { useEffect, useState } from 'react';
import {
  ArrowRight,
  ArrowUpRight,
  Boxes,
  CircleAlert,
  ClipboardList,
  Package,
  UsersRound,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { adminApi } from '../adminApi';
import { formatPrice } from '../../utils/format';

const metricCards = [
  { key: 'totalProducts', label: 'Total products', Icon: Package, to: '/admin/products' },
  { key: 'totalCustomers', label: 'Customers', Icon: UsersRound, to: '/admin/customers' },
  { key: 'allTimeOrders', label: 'Total orders', Icon: ClipboardList, to: '/admin/orders' },
  { key: 'pendingOrders', label: 'Pending orders', Icon: CircleAlert, to: '/admin/orders?status=open' },
  { key: 'completedOrders', label: 'Delivered orders', Icon: Package, to: '/admin/orders?status=delivered' },
  { key: 'cancelledOrders', label: 'Cancelled orders', Icon: ClipboardList, to: '/admin/orders?status=cancelled' },
  { key: 'lowStockItems', label: 'Low-stock items', Icon: Boxes, to: '/admin/inventory' },
];
const periods = [
  { value: '7d', label: '7 days' },
  { value: '30d', label: '30 days' },
  { value: '90d', label: '90 days' },
];

function SalesChart({ sales, loading, period }) {
  const days = sales?.dailySales || [];
  const width = 720;
  const height = 230;
  const padding = { top: 16, right: 14, bottom: 36, left: 48 };
  const values = days.map((day) => Number(day.revenue) || 0);
  const maximum = Math.max(...values, 1);
  const points = days.map((day, index) => ({
    ...day,
    x: padding.left + (days.length > 1 ? index * (width - padding.left - padding.right) / (days.length - 1) : (width - padding.left - padding.right) / 2),
    y: padding.top + (height - padding.top - padding.bottom) * (1 - (Number(day.revenue) || 0) / maximum),
  }));
  const line = points.map((point) => `${point.x},${point.y}`).join(' ');
  const labelStride = Math.max(1, Math.ceil(days.length / 6));
  const hasSales = values.some((value) => value > 0);

  return (
    <section className="admin-panel admin-sales-panel" aria-labelledby="sales-chart-title">
      <div className="admin-panel-heading">
        <div><span className="eyebrow">Verified order payments</span><h2 id="sales-chart-title">Sales and revenue</h2></div>
        <strong className="admin-sales-total">{loading ? '—' : formatPrice(sales?.revenue || 0)}</strong>
      </div>
      <p className="admin-chart-caption">Daily net revenue for the selected {period === '7d' ? 'week' : period === '30d' ? 'month' : '90-day period'} · INR</p>
      {loading ? <div className="admin-chart-state" role="status">Loading real sales data…</div> : !days.length ? <div className="admin-chart-state">No sales data is available for this period.</div> : (
        <>
          {!hasSales && <p className="admin-chart-empty-note">No eligible paid or delivered COD orders were recorded during this period.</p>}
          <div className="admin-chart-scroll">
            <svg className="admin-sales-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Daily revenue chart for the last ${period === '7d' ? '7' : period === '30d' ? '30' : '90'} days`}>
              <title>Daily revenue</title>
              {[0, 1, 2, 3].map((step) => {
                const y = padding.top + step * (height - padding.top - padding.bottom) / 3;
                const value = maximum * (1 - step / 3);
                return <g key={step}><line x1={padding.left} x2={width - padding.right} y1={y} y2={y} /><text x={padding.left - 8} y={y + 3} textAnchor="end">{Math.round(value).toLocaleString('en-IN')}</text></g>;
              })}
              {points.length > 1 && <polygon className="admin-sales-area" points={`${padding.left},${height - padding.bottom} ${line} ${width - padding.right},${height - padding.bottom}`} />}
              {points.length > 1 && <polyline className="admin-sales-line" points={line} />}
              {points.map((point, index) => <g key={point.date}><circle className="admin-sales-point" cx={point.x} cy={point.y} r={days.length > 20 && index % labelStride !== 0 ? 2 : 3.5}><title>{`${point.date}: ${formatPrice(point.revenue)}`}</title></circle>{(index % labelStride === 0 || index === points.length - 1) && <text className="admin-chart-date" x={point.x} y={height - 11} textAnchor="middle">{new Date(`${point.date}T00:00:00Z`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', timeZone: 'UTC' })}</text>}</g>)}
            </svg>
          </div>
        </>
      )}
    </section>
  );
}

function OrderStatusPanel({ counts, loading }) {
  const total = counts.reduce((sum, item) => sum + Number(item.count || 0), 0);
  return (
    <section className="admin-panel admin-status-panel" aria-labelledby="status-chart-title">
      <div className="admin-panel-heading"><div><span className="eyebrow">Orders in selected period</span><h2 id="status-chart-title">Order status</h2></div></div>
      {loading ? <div className="admin-chart-state" role="status">Loading order statuses…</div> : counts.length ? <div className="admin-status-list">
        {counts.map(({ status, count }) => {
          const percentage = total ? Math.round(Number(count) / total * 100) : 0;
          return <div className="admin-status-row" key={status}><div><span>{String(status).replaceAll('_', ' ')}</span><strong>{Number(count).toLocaleString('en-IN')}</strong></div><div className="admin-status-track"><span style={{ width: `${percentage}%` }} /></div></div>;
        })}
      </div> : <div className="admin-chart-state">No orders have been recorded in this period.</div>}
    </section>
  );
}

export default function AdminDashboardPage() {
  const [data, setData] = useState(null);
  const [sales, setSales] = useState(null);
  const [error, setError] = useState({ key: '', message: '' });
  const [salesError, setSalesError] = useState({ key: '', message: '' });
  const [loadedKey, setLoadedKey] = useState('');
  const [salesLoadedKey, setSalesLoadedKey] = useState('');
  const [period, setPeriod] = useState('30d');
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let active = true;
    const requestKey = `${period}:${refreshKey}`;
    Promise.allSettled([
      adminApi.overview({ period }),
      adminApi.sales({ period }),
    ]).then(([overviewResult, salesResult]) => {
      if (!active) return;
      if (overviewResult.status === 'fulfilled') setData(overviewResult.value);
      setError({
        key: requestKey,
        message: overviewResult.status === 'rejected'
          ? overviewResult.reason.response?.data?.message || 'The store overview could not be loaded.'
          : '',
      });
      if (salesResult.status === 'fulfilled') setSales(salesResult.value);
      setSalesError({
        key: requestKey,
        message: salesResult.status === 'rejected'
          ? salesResult.reason.response?.data?.message || 'Sales analytics could not be loaded.'
          : '',
      });
      setLoadedKey(requestKey);
      setSalesLoadedKey(requestKey);
    });
    return () => { active = false; };
  }, [period, refreshKey]);

  const requestKey = `${period}:${refreshKey}`;
  const loading = loadedKey !== requestKey;
  const salesLoading = salesLoadedKey !== requestKey;
  const metrics = data?.metrics || {};
  const cancelledOrders = data?.orderStatusCounts?.find(({ status }) => status === 'cancelled')?.count || 0;
  const metricValues = { ...metrics, cancelledOrders };
  const orderCounts = data?.orderStatusCounts || [];

  return <div className="admin-page">
    <div className="admin-page-heading">
      <div><span className="eyebrow">A clear view of the store</span><h1>Overview</h1><p>Live figures from the store catalogue, customer accounts and orders.</p></div>
      <div className="admin-dashboard-controls">
        <label htmlFor="dashboard-period">Reporting period</label>
        <select id="dashboard-period" value={period} onChange={(event) => setPeriod(event.target.value)}>{periods.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}</select>
        <button type="button" className="admin-button-secondary" onClick={() => setRefreshKey((value) => value + 1)} disabled={loading || salesLoading}>Refresh</button>
      </div>
    </div>
    {error.key === requestKey && error.message && <p className="admin-inline-error" role="alert">{error.message}</p>}
    {salesError.key === requestKey && salesError.message && <p className="admin-inline-error" role="alert">{salesError.message}</p>}
    <div className="admin-metric-grid">{metricCards.map(({ key, label, Icon, to }) => <Link className="admin-metric-card" to={to} key={key}><span className="admin-metric-icon"><Icon size={19} /></span><small>{label}</small><strong>{loading ? '—' : Number(metricValues[key] || 0).toLocaleString('en-IN')}</strong><ArrowUpRight size={15} className="admin-metric-arrow" /></Link>)}</div>
    <div className="admin-revenue-card"><div><span className="eyebrow">Eligible captured sales</span><h2>Net revenue · selected period</h2><p>Settled online payments and delivered cash-on-delivery orders, less recorded refunds.</p></div><strong>{loading ? '—' : formatPrice(metrics.netSales || 0)}</strong></div>
    <div className="admin-analytics-grid">
      <SalesChart sales={sales} loading={salesLoading} period={period} />
      <OrderStatusPanel counts={orderCounts} loading={loading} />
    </div>
    <section className="admin-panel">
      <div className="admin-panel-heading"><div><span className="eyebrow">Recently placed</span><h2>Recent orders</h2></div><Link to="/admin/orders" className="admin-text-link">All orders <ArrowRight size={14} /></Link></div>
      {loading ? <div className="admin-empty-state">Loading the latest orders…</div> : data?.recentOrders?.length ? <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Order</th><th>Customer</th><th>Date</th><th>Payment</th><th>Status</th><th>Total</th></tr></thead><tbody>{data.recentOrders.map((order) => <tr key={order._id}><td><Link to={`/admin/orders?order=${order._id}`}>{order.orderNumber}</Link></td><td>{order.customerName}<small>{order.customerEmail}</small></td><td>{new Date(order.createdAt).toLocaleDateString('en-IN')}</td><td>{order.paymentMethod} · {order.paymentStatus}</td><td><span className={`admin-status status-${order.orderStatus}`}>{String(order.orderStatus).replaceAll('_', ' ')}</span></td><td>{formatPrice(order.totalAmount, order.currency)}</td></tr>)}</tbody></table></div> : <div className="admin-empty-state">No orders have been placed yet.</div>}
    </section>
    <section className="admin-panel">
      <div className="admin-panel-heading"><div><span className="eyebrow">Best sellers</span><h2>Top products · selected period</h2></div></div>
      {salesLoading ? <div className="admin-empty-state">Loading best-selling products…</div> : sales?.topProducts?.length ? <div className="admin-top-products">{sales.topProducts.map((product) => <div className="admin-top-product-row" key={product.productId || product.sku}><span><strong>{product.name}</strong><small>{product.sku} · {Number(product.unitsSold).toLocaleString('en-IN')} sold</small></span><b>{formatPrice(product.sales)}</b></div>)}</div> : <div className="admin-empty-state">No product sales are recorded for this period.</div>}
    </section>
    <div className="admin-quick-links"><Link to="/admin/products"><Package size={18} /> Manage products <ArrowRight size={15} /></Link><Link to="/admin/inventory"><CircleAlert size={18} /> Review stock levels <ArrowRight size={15} /></Link><Link to="/admin/customers"><UsersRound size={18} /> View customers <ArrowRight size={15} /></Link></div>
  </div>;
}
