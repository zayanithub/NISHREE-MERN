import { useCallback, useEffect, useState } from 'react';
import { Pencil, Plus, RefreshCw, Save, Tags, Trash2, X, Search, Package, Boxes, AlertTriangle, Ban, IndianRupee } from 'lucide-react';
import { toast } from 'sonner';
import { adminApi } from '../adminApi';
import { useAdminAuth } from '../useAdminAuth';
import AdminDataTools from '../components/AdminDataTools';
import { formatPrice, productImage } from '../../utils/format';

const slugify = (value) => value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const categoryColumns = [
  ['Category', (item) => item.name],
  ['Slug', (item) => item.slug],
  ['Products', (item) => Number(item.productCount || 0)],
  ['Status', (item) => item.isActive ? 'Active' : 'Hidden'],
  ['Description', (item) => item.description || ''],
];

export function AdminCategoriesPage() {
  const [categories, setCategories] = useState([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [search, setSearch] = useState('');
  const [editingCategory, setEditingCategory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    try {
      const first = await adminApi.categories({ page: 1, limit: 100 });
      const records = [...(first.categories || [])];
      for (let page = 2; page <= (first.pagination?.totalPages || 1); page += 1) {
        const result = await adminApi.categories({ page, limit: 100 });
        records.push(...(result.categories || []));
      }
      setCategories(records);
    }
    catch (error) { toast.error(error.response?.data?.message || 'Categories could not be loaded.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);
  const resetForm = () => { setEditingCategory(null); setName(''); setDescription(''); setImageUrl(''); };
  const save = async (event) => {
    event.preventDefault(); setBusy(true);
    const category = { name: name.trim(), slug: slugify(name), description: description.trim(), image: { url: imageUrl.trim() } };
    try {
      if (editingCategory) {
        await adminApi.updateCategory(editingCategory._id, category);
        toast.success('Category updated.');
      } else {
        await adminApi.createCategory({ ...category, isActive: true, isFeatured: false, sortOrder: categories.length });
        toast.success('Category created.');
      }
      resetForm();
      await load();
    }
    catch (error) { toast.error(error.response?.data?.message || 'The category could not be saved.'); }
    finally { setBusy(false); }
  };
  const edit = (category) => {
    setEditingCategory(category);
    setName(category.name);
    setDescription(category.description || '');
    setImageUrl(category.image?.url || '');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const toggle = async (category) => {
    try { await adminApi.updateCategoryStatus(category._id, !category.isActive); toast.success(`${category.name} ${category.isActive ? 'hidden from' : 'shown in'} the storefront.`); await load(); }
    catch (error) { toast.error(error.response?.data?.message || 'The category status could not be updated.'); }
  };
  const remove = async (category) => {
    if (!window.confirm(`Delete "${category.name}"? Categories used by products cannot be deleted.`)) return;
    try { await adminApi.deleteCategory(category._id); toast.success('Category deleted.'); await load(); }
    catch (error) { toast.error(error.response?.data?.message || 'The category could not be deleted.'); }
  };
  const visibleCategories = categories.filter((category) => `${category.name} ${category.slug}`.toLowerCase().includes(search.trim().toLowerCase()));
  return <div className="admin-page"><div className="admin-page-heading"><div><span className="eyebrow">Shop navigation</span><h1>Categories</h1><p>Group sarees into browsable edits for the storefront.</p></div><AdminDataTools filename="nishree-categories" columns={categoryColumns} rows={visibleCategories} disabled={!visibleCategories.length} /></div>
    <form className="admin-panel admin-category-form" onSubmit={save}><h2><Tags size={18} /> {editingCategory ? 'Edit category' : 'Add a category'}</h2><label>Category name<input required value={name} onChange={(event) => setName(event.target.value)} maxLength={100} /></label><label>Description<input value={description} onChange={(event) => setDescription(event.target.value)} maxLength={1000} /></label><label>Category image URL<input type="url" value={imageUrl} onChange={(event) => setImageUrl(event.target.value)} maxLength={2048} placeholder="https://…" /></label><div className="admin-form-actions"><button className="admin-button-primary" type="submit" disabled={busy || !name.trim()}>{editingCategory ? <Save size={16} /> : <Plus size={16} />} {busy ? 'Saving…' : editingCategory ? 'Save changes' : 'Create category'}</button>{editingCategory && <button className="admin-button-secondary" type="button" onClick={resetForm}><X size={15} /> Cancel edit</button>}</div></form>
    <section className="admin-panel"><div className="admin-panel-heading"><h2>Current categories</h2><button className="admin-button-secondary" onClick={() => void load()} type="button"><RefreshCw size={15} /> Refresh</button></div><input className="admin-category-search" type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search categories" aria-label="Search categories" />{loading ? <div className="admin-empty-state">Loading categories…</div> : visibleCategories.length ? <div className="admin-simple-list">{visibleCategories.map((category) => <article key={category._id}><div className="admin-category-info">{category.image?.url && <img src={category.image.url} alt="" loading="lazy" width="52" height="52" />}<div><strong>{category.name}</strong><small>/{category.slug} · {category.productCount ?? 0} products</small>{category.description && <small>{category.description}</small>}</div></div><div className="admin-category-actions"><span className={`admin-status ${category.isActive ? 'status-active' : 'status-draft'}`}>{category.isActive ? 'Active' : 'Hidden'}</span><button className="admin-button-secondary" type="button" onClick={() => edit(category)} aria-label={`Edit ${category.name}`}><Pencil size={14} /> Edit</button><button className="admin-button-secondary" type="button" onClick={() => void toggle(category)}>{category.isActive ? 'Hide' : 'Show'}</button><button className="admin-button-secondary" type="button" onClick={() => void remove(category)} aria-label={`Delete ${category.name}`}><Trash2 size={14} /> Delete</button></div></article>)}</div> : <div className="admin-empty-state">{categories.length ? 'No categories match your search.' : 'No categories have been created.'}</div>}</section>
  </div>;
}

export function AdminInventoryPage() {
  const [items, setItems] = useState([]);
  const [quantities, setQuantities] = useState({});
  const [categories, setCategories] = useState([]);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState('');
  const [bulkSaving, setBulkSaving] = useState(false);
  const [feedback, setFeedback] = useState({});
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [first, categoryResult] = await Promise.all([
        adminApi.inventory({ page: 1, limit: 100, inventoryType: 'product' }),
        adminApi.categories({ page: 1, limit: 100 }),
      ]);
      const records = [...(first.inventories || [])];
      for (let current = 2; current <= (first.pagination?.totalPages || 1); current += 1) {
        const result = await adminApi.inventory({ page: current, limit: 100, inventoryType: 'product' });
        records.push(...(result.inventories || []));
      }
      const allCategories = [...(categoryResult.categories || [])];
      for (let current = 2; current <= (categoryResult.pagination?.totalPages || 1); current += 1) {
        const result = await adminApi.categories({ page: current, limit: 100 });
        allCategories.push(...(result.categories || []));
      }
      setItems(records);
      setQuantities(Object.fromEntries(records.map((item) => [item._id, String(item.quantity)])));
      setCategories(allCategories);
      setFeedback({});
      setError('');
    } catch (requestError) { setError(requestError.response?.data?.message || 'Inventory could not be loaded.'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);
  const saveQuantity = async (item) => {
    const rawValue = String(quantities[item._id] ?? '').trim();
    const raw = Number(rawValue);
    if (!rawValue || !Number.isInteger(raw) || raw < Number(item.reservedQuantity || 0)) {
      setFeedback((current) => ({ ...current, [item._id]: { error: `Enter a whole number of at least ${item.reservedQuantity || 0}.` } }));
      return;
    }
    const wanted = raw;
    const adjustment = wanted - Number(item.quantity || 0);
    if (!adjustment) { setFeedback((current) => ({ ...current, [item._id]: { success: 'Stock is already at this quantity.' } })); return; }
    setSaving(String(item._id));
    setFeedback((current) => ({ ...current, [item._id]: {} }));
    try {
      const result = await adminApi.adjustInventory(item._id, adjustment);
      const updated = result.inventory;
      setItems((current) => current.map((record) => record._id === item._id ? { ...record, ...updated, product: { ...record.product, ...updated.product } } : record));
      setQuantities((current) => ({ ...current, [item._id]: String(updated.quantity) }));
      setFeedback((current) => ({ ...current, [item._id]: { success: 'Stock updated.' } }));
      toast.success('Stock level updated.');
    } catch (requestError) {
      const message = requestError.response?.data?.message || 'Stock could not be updated.';
      setFeedback((current) => ({ ...current, [item._id]: { error: message } }));
      toast.error(message);
    }
    finally { setSaving(''); }
  };
  const inventoryStatus = (item) => {
    const available = Number(item.availableQuantity ?? (item.quantity - item.reservedQuantity));
    if (available <= 0) return 'out';
    if (available <= Number(item.lowStockThreshold ?? 5)) return 'low';
    return 'in';
  };
  const filteredItems = items.filter((item) => {
    const product = item.product || {};
    const matchesSearch = `${product.name || ''} ${product.sku || ''} ${product._id || ''}`.toLowerCase().includes(search.trim().toLowerCase());
    const matchesCategory = !categoryFilter || String(product.category?._id || product.category || '') === categoryFilter;
    const status = inventoryStatus(item);
    return matchesSearch && matchesCategory && (!statusFilter || status === statusFilter);
  });
  const pageSize = 20;
  const totalPages = Math.max(1, Math.ceil(filteredItems.length / pageSize));
  const visibleItems = filteredItems.slice((page - 1) * pageSize, page * pageSize);
  const totalStock = items.reduce((sum, item) => sum + Number(item.availableQuantity ?? item.quantity - item.reservedQuantity), 0);
  const lowStock = items.filter((item) => inventoryStatus(item) === 'low').length;
  const outOfStock = items.filter((item) => inventoryStatus(item) === 'out').length;
  const stockValue = items.reduce((sum, item) => sum + Number(item.quantity || 0) * Number(item.product?.basePrice || 0), 0);
  const dirtyItems = items.filter((item) => Number(quantities[item._id]) !== Number(item.quantity));
  const saveAll = async () => {
    setBulkSaving(true);
    let failures = 0;
    for (const item of dirtyItems) {
      const wantedValue = String(quantities[item._id] ?? '').trim();
      const wanted = Number(wantedValue);
      if (!wantedValue || !Number.isInteger(wanted) || wanted < Number(item.reservedQuantity || 0)) {
        failures += 1;
        setFeedback((current) => ({ ...current, [item._id]: { error: `Enter a whole number of at least ${item.reservedQuantity || 0}.` } }));
        continue;
      }
      try {
        const result = await adminApi.adjustInventory(item._id, wanted - Number(item.quantity));
        setItems((current) => current.map((record) => record._id === item._id ? { ...record, ...result.inventory, product: { ...record.product, ...result.inventory.product } } : record));
        setQuantities((current) => ({ ...current, [item._id]: String(result.inventory.quantity) }));
        setFeedback((current) => ({ ...current, [item._id]: { success: 'Stock updated.' } }));
      } catch (requestError) {
        failures += 1;
        setFeedback((current) => ({ ...current, [item._id]: { error: requestError.response?.data?.message || 'Stock could not be updated.' } }));
      }
    }
    setBulkSaving(false);
    if (failures) toast.error(`${failures} stock update${failures === 1 ? '' : 's'} failed. See the affected rows.`);
    else toast.success('Bulk stock updates completed.');
  };
  const inventoryColumns = [
    ['Product', (item) => item.product?.name || 'Product'],
    ['Category', (item) => item.product?.category?.name || 'Uncategorised'],
    ['SKU / Product ID', (item) => item.product?.sku || item.product?._id || item._id],
    ['Available stock', (item) => Number(item.availableQuantity ?? item.quantity - item.reservedQuantity)],
    ['Reserved', (item) => Number(item.reservedQuantity || 0)],
    ['Status', (item) => inventoryStatus(item) === 'in' ? 'In stock' : inventoryStatus(item) === 'low' ? 'Low stock' : 'Out of stock'],
    ['Stock value (INR)', (item) => Number(item.quantity || 0) * Number(item.product?.basePrice || 0)],
    ['Last updated', (item) => item.updatedAt ? new Date(item.updatedAt).toISOString() : ''],
  ];
  return <div className="admin-page"><div className="admin-page-heading"><div><span className="eyebrow">Available units and reservations</span><h1>Inventory</h1><p>Update physical stock inline; row-level saves preserve your current view and scroll position.</p></div><div className="admin-heading-actions"><AdminDataTools filename="nishree-inventory" columns={inventoryColumns} rows={filteredItems} disabled={!filteredItems.length} /><button className="admin-button-secondary" type="button" onClick={() => void load()} disabled={loading}><RefreshCw size={15} /> Refresh</button></div></div>
    <div className="admin-metric-grid admin-inventory-metrics">
      <article className="admin-metric-card"><span className="admin-metric-icon"><Package size={17} /></span><small>Total products</small><strong>{items.length}</strong></article>
      <article className="admin-metric-card"><span className="admin-metric-icon"><Boxes size={17} /></span><small>Available stock</small><strong>{totalStock.toLocaleString('en-IN')}</strong></article>
      <article className="admin-metric-card"><span className="admin-metric-icon"><AlertTriangle size={17} /></span><small>Low stock</small><strong>{lowStock}</strong></article>
      <article className="admin-metric-card"><span className="admin-metric-icon"><Ban size={17} /></span><small>Out of stock</small><strong>{outOfStock}</strong></article>
      <article className="admin-metric-card"><span className="admin-metric-icon"><IndianRupee size={17} /></span><small>Inventory value</small><strong>{formatPrice(stockValue)}</strong></article>
    </div>
    {(lowStock > 0 || outOfStock > 0) && <div className="admin-stock-alert" role="status"><AlertTriangle size={17} /><span><strong>Stock attention needed</strong>{lowStock > 0 && ` ${lowStock} low-stock product${lowStock === 1 ? '' : 's'}`}{lowStock > 0 && outOfStock > 0 ? ' · ' : ''}{outOfStock > 0 && `${outOfStock} out of stock`}</span></div>}
    <div className="admin-toolbar admin-inventory-toolbar"><form className="admin-search" onSubmit={(event) => { event.preventDefault(); setPage(1); }}><Search size={17} /><input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Search name, SKU or product ID" aria-label="Search inventory" /><button type="submit">Search</button></form><label>Category<select value={categoryFilter} onChange={(event) => { setCategoryFilter(event.target.value); setPage(1); }}><option value="">All categories</option>{categories.map((category) => <option key={category._id} value={category._id}>{category.name}</option>)}</select></label><label>Stock status<select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPage(1); }}><option value="">All stock</option><option value="in">In stock</option><option value="low">Low stock</option><option value="out">Out of stock</option></select></label><button className="admin-button-primary" type="button" disabled={!dirtyItems.length || bulkSaving} onClick={() => void saveAll()}>{bulkSaving ? 'Saving changes…' : `Save all changes${dirtyItems.length ? ` (${dirtyItems.length})` : ''}`}</button></div>
    {error && <p className="admin-inline-error" role="alert">{error}</p>}
    {loading ? <div className="admin-empty-state">Loading stock…</div> : visibleItems.length ? <><div className="admin-table-wrap"><table className="admin-table admin-inventory-table"><thead><tr><th>Product image</th><th>Product</th><th>Category</th><th>SKU / Product ID</th><th>Stock</th><th>Status</th><th>Last updated</th><th>Quick stock update</th><th>Actions</th></tr></thead><tbody>{visibleItems.map((item) => {
      const status = inventoryStatus(item);
      const available = Number(item.availableQuantity ?? item.quantity - item.reservedQuantity);
      const message = feedback[item._id];
      const changed = Number(quantities[item._id]) !== Number(item.quantity);
      return <tr key={item._id}>
        <td><img className="admin-inventory-image" src={productImage(item.product)} alt="" loading="lazy" /></td>
        <td><strong>{item.product?.name || 'Product'}</strong><small>Reserved: {item.reservedQuantity || 0}</small></td>
        <td>{item.product?.category?.name || 'Uncategorised'}</td>
        <td>{item.product?.sku || item.product?._id || item._id}</td>
        <td><strong>{available}</strong> / {item.quantity}</td>
        <td><span className={`admin-status ${status === 'in' ? 'status-active' : status === 'low' ? 'status-pending' : 'status-out-of-stock'}`}>{status === 'in' ? 'In stock' : status === 'low' ? 'Low stock' : 'Out of stock'}</span></td>
        <td>{item.updatedAt ? new Date(item.updatedAt).toLocaleDateString('en-IN') : '—'}</td>
        <td><input className="admin-stock-input" type="number" min={item.reservedQuantity || 0} step="1" value={quantities[item._id] ?? item.quantity} onChange={(event) => { setQuantities((current) => ({ ...current, [item._id]: event.target.value })); setFeedback((current) => ({ ...current, [item._id]: {} })); }} aria-label={`Quantity for ${item.product?.name || 'product'}`} />{message?.success && <small className="admin-stock-feedback is-success">{message.success}</small>}{message?.error && <small className="admin-stock-feedback is-error" role="alert">{message.error}</small>}</td>
        <td><button className="admin-button-secondary" type="button" disabled={!changed || saving === String(item._id) || bulkSaving} onClick={() => void saveQuantity(item)}>{saving === String(item._id) ? 'Saving…' : 'Save'}</button></td>
      </tr>;
    })}</tbody></table></div>
      {totalPages > 1 && <div className="admin-pagination"><button className="admin-button-secondary" type="button" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>Previous</button><span>Page {page} of {totalPages} · {filteredItems.length} products</span><button className="admin-button-secondary" type="button" disabled={page >= totalPages} onClick={() => setPage((current) => current + 1)}>Next</button></div>}
    </> : <div className="admin-empty-state">{items.length ? 'No inventory rows match these filters.' : 'No inventory records exist yet. New products can be stocked from the product form.'}</div>}
  </div>;
}

const initialSettings = { storeName: 'Nishree Attire', supportEmail: 'info.nishree@gmail.com', supportPhone: '9344901028', businessAddress: '44/41, Pillaiyar Kovil 1st Street, Mambakkam, Chennai, Tamil Nadu 600127, India.', whatsappNumber: '919344901028', whatsappUrl: 'https://wa.me/919344901028/?text=Hi,%20Can%20you%20send%20details%20about%20your%20products', instagramUrl: 'https://www.instagram.com/nishree_fashions/', facebookUrl: 'https://www.facebook.com/share/19KgfTEgdN/' };

export function AdminStoreSettingsPage() {
  const { admin } = useAdminAuth();
  const [settings, setSettings] = useState(initialSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    adminApi.settings().then((data) => { if (active) setSettings({ ...initialSettings, ...data }); }).catch((requestError) => { if (active) setError(requestError.response?.data?.message || 'Store settings could not be loaded.'); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  const setField = (key, value) => setSettings((current) => ({ ...current, [key]: value }));
  const save = async (event) => {
    event.preventDefault(); setSaving(true); setError('');
    try { setSettings((current) => current); const saved = await adminApi.updateSettings(settings); setSettings({ ...initialSettings, ...saved }); toast.success('Store contact details saved.'); }
    catch (requestError) { setError(requestError.response?.data?.message || 'Store settings could not be saved.'); }
    finally { setSaving(false); }
  };
  return <div className="admin-page"><div className="admin-page-heading"><div><span className="eyebrow">Brand, contact and social links</span><h1>Store details</h1><p>These details appear on the storefront contact page and footer.</p></div></div>
    {error && <p className="admin-inline-error" role="alert">{error}</p>}
    {loading ? <div className="admin-empty-state">Loading store settings…</div> : <form className="admin-panel admin-settings-form" onSubmit={save}><div className="admin-settings-heading"><h2>Customer-facing details</h2><span>Signed in as {admin?.email}</span></div><div className="admin-form-grid">
      <label>Business name<input value={settings.storeName} onChange={(event) => setField('storeName', event.target.value)} required maxLength={100} /></label>
      <label>Support email<input type="email" value={settings.supportEmail} onChange={(event) => setField('supportEmail', event.target.value)} required maxLength={254} /></label>
      <label>Phone number<input type="tel" value={settings.supportPhone} onChange={(event) => setField('supportPhone', event.target.value)} required maxLength={30} /></label>
      <label>WhatsApp phone (international format)<input type="tel" value={settings.whatsappNumber} onChange={(event) => setField('whatsappNumber', event.target.value)} required maxLength={20} /></label>
      <label className="admin-field-wide">Business address<textarea rows="3" value={settings.businessAddress} onChange={(event) => setField('businessAddress', event.target.value)} required maxLength={500} /></label>
      <label className="admin-field-wide">WhatsApp enquiry URL<input type="url" value={settings.whatsappUrl} onChange={(event) => setField('whatsappUrl', event.target.value)} required maxLength={500} /></label>
      <label>Instagram URL<input type="url" value={settings.instagramUrl} onChange={(event) => setField('instagramUrl', event.target.value)} maxLength={300} /></label>
      <label>Facebook URL<input type="url" value={settings.facebookUrl} onChange={(event) => setField('facebookUrl', event.target.value)} maxLength={300} /></label>
      <div className="admin-field-wide"><button type="submit" className="admin-button-primary" disabled={saving}><Save size={16} /> {saving ? 'Saving…' : 'Save store details'}</button></div>
    </div></form>}
  </div>;
}
