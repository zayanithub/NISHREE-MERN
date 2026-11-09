import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, GripVertical, ImagePlus, Pencil, Plus, Search, Trash2, UploadCloud, X } from 'lucide-react';
import { toast } from 'sonner';
import { adminApi } from '../adminApi';
import { formatPrice, productImage } from '../../utils/format';
import AdminDataTools from '../components/AdminDataTools';

const emptyForm = { name: '', slug: '', sku: '', category: '', description: '', shortDescription: '', material: '', color: '', sareeLength: '', imageAltText: '', imageCredit: '', imageLicense: '', imageSourceUrl: '', basePrice: '', salePrice: '', tags: '', fabricCare: '', occasion: '', stockQuantity: '0', isFeatured: false, status: 'draft' };
const slugify = (value) => value.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const csv = (value) => value.split(',').map((item) => item.trim()).filter(Boolean);
const productColumns = [
  ['Product name', (item) => item.name],
  ['SKU', (item) => item.sku],
  ['Category', (item) => item.category?.name || ''],
  ['Fabric', (item) => item.material],
  ['Colour', (item) => item.color],
  ['Saree length', (item) => item.sareeLength],
  ['Price (INR)', (item) => Number(item.basePrice || 0)],
  ['Discounted price (INR)', (item) => item.salePrice == null ? '' : Number(item.salePrice)],
  ['Available stock', (item) => Number(item.availableQuantity || 0)],
  ['Status', (item) => item.status],
];

export default function AdminProductsPage() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('active');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [galleryItems, setGalleryItems] = useState([]);
  const [primaryItemKey, setPrimaryItemKey] = useState('');
  const [imageReport, setImageReport] = useState({ products: [], pagination: { total: 0 } });
  const [uploadProgress, setUploadProgress] = useState(0);
  const [draggedItemKey, setDraggedItemKey] = useState('');
  const [imagesLoading, setImagesLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const previewUrlsRef = useRef([]);
  const fileInputRef = useRef(null);
  const initialImagesRef = useRef([]);

  const clearGalleryItems = () => {
    previewUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    previewUrlsRef.current = [];
    setGalleryItems([]);
    setPrimaryItemKey('');
    initialImagesRef.current = [];
  };
  const addFiles = (selectedFiles) => {
    const remaining = 5 - galleryItems.length;
    if (remaining <= 0) {
      toast.error('A product can have up to 5 images.');
      return;
    }
    const accepted = [];
    for (const file of selectedFiles) {
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) {
        toast.error(`${file.name}: choose JPG, PNG or WebP images up to 5 MB each.`);
        continue;
      }
      if (accepted.length >= remaining) break;
      const previewUrl = URL.createObjectURL(file);
      previewUrlsRef.current.push(previewUrl);
      accepted.push({ key: `file-${crypto.randomUUID()}`, kind: 'file', file, previewUrl });
    }
    if (selectedFiles.length > remaining) toast.error(`Only ${remaining} additional image${remaining === 1 ? '' : 's'} can be added.`);
    if (accepted.length) {
      setGalleryItems((current) => [...current, ...accepted]);
      setPrimaryItemKey((current) => current || accepted[0].key);
    }
  };
  const selectFiles = (event) => {
    addFiles(Array.from(event.target.files || []));
    event.target.value = '';
  };
  useEffect(() => () => previewUrlsRef.current.forEach((url) => URL.revokeObjectURL(url)), []);

  const load = useCallback(async () => {
    try {
      const [result, categoryResult, report] = await Promise.all([
        adminApi.products({ page, limit: 20, search: search || undefined, status: statusFilter }),
        adminApi.categories({ page: 1, limit: 100 }),
        adminApi.productImageCompletion({ page: 1, limit: 100 }),
      ]);
      setProducts(result.products || []);
      setPagination(result.pagination || { page, totalPages: 1, total: (result.products || []).length });
      setCategories(categoryResult.categories || []);
      setImageReport(report || { products: [], pagination: { total: 0 } });
      setError('');
    } catch (requestError) { setError(requestError.response?.data?.message || 'Products could not be loaded.'); }
    finally { setLoading(false); }
  }, [page, search, statusFilter]);
  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);
  const openNew = () => { setEditing(null); clearGalleryItems(); setForm(emptyForm); setModalOpen(true); };
  const openEdit = (product) => {
    setEditing(product);
    setForm({ name: product.name || '', slug: product.slug || '', sku: product.sku || '', category: String(product.category?._id || product.category || ''), description: product.description || '', shortDescription: product.shortDescription || '', material: product.material || '', color: product.color || '', sareeLength: product.sareeLength || '', imageAltText: product.imageAltText || '', imageCredit: product.imageCredit || '', imageLicense: product.imageLicense || '', imageSourceUrl: product.imageSourceUrl || '', basePrice: String(product.basePrice ?? ''), salePrice: product.salePrice == null ? '' : String(product.salePrice), tags: (product.tags || []).join(', '), fabricCare: product.fabricCare || '', occasion: (product.occasion || []).join(', '), stockQuantity: String(product.availableQuantity ?? 0), isFeatured: Boolean(product.isFeatured), status: product.status || 'draft' });
    clearGalleryItems();
    setModalOpen(true);
    setImagesLoading(true);
    adminApi.productImages(product._id).then((images) => {
      const items = images.map((image) => ({
        key: `image-${image._id || image.url}`,
        kind: 'existing',
        image,
      }));
      initialImagesRef.current = images;
      setGalleryItems(items);
      setPrimaryItemKey(items.find((item) => item.image.isPrimary)?.key || items[0]?.key || '');
    }).catch((requestError) => {
      toast.error(requestError.response?.data?.message || 'Product images could not be loaded.');
    }).finally(() => setImagesLoading(false));
  };
  const closeModal = () => { if (!busy) { setModalOpen(false); clearGalleryItems(); } };
  const setField = (name, value) => setForm((current) => ({ ...current, [name]: value }));

  const removeGalleryItem = (key) => {
    const removed = galleryItems.find((item) => item.key === key);
    if (removed?.kind === 'file') {
      URL.revokeObjectURL(removed.previewUrl);
      previewUrlsRef.current = previewUrlsRef.current.filter((url) => url !== removed.previewUrl);
    }
    const nextItems = galleryItems.filter((item) => item.key !== key);
    setGalleryItems(nextItems);
    if (primaryItemKey === key) setPrimaryItemKey(nextItems[0]?.key || '');
  };

  const moveGalleryItem = (fromKey, toKey) => {
    if (fromKey === toKey) return;
    const from = galleryItems.findIndex((item) => item.key === fromKey);
    const to = galleryItems.findIndex((item) => item.key === toKey);
    if (from < 0 || to < 0) return;
    const reordered = [...galleryItems];
    const [item] = reordered.splice(from, 1);
    reordered.splice(to, 0, item);
    setGalleryItems(reordered);
  };

  const openReportedProduct = async (item) => {
    try { openEdit(await adminApi.product(item._id)); }
    catch (requestError) { toast.error(requestError.response?.data?.message || 'Product details could not be loaded.'); }
  };

  const changeImageReportPage = async (nextPage) => {
    try {
      setImageReport(await adminApi.productImageCompletion({ page: nextPage, limit: 100 }));
    } catch (requestError) {
      toast.error(requestError.response?.data?.message || 'The product photo report could not be loaded.');
    }
  };

  const save = async (event) => {
    event.preventDefault();
    if (galleryItems.length > 5) { toast.error('A product can have up to 5 images.'); return; }
    if (galleryItems.some((item) => item.kind === 'file' && (!['image/jpeg', 'image/png', 'image/webp'].includes(item.file.type) || item.file.size > 5 * 1024 * 1024))) {
      toast.error('Choose JPG, PNG or WebP images up to 5 MB each.');
      return;
    }
    const shouldPublish = form.status === 'active' && (!editing || editing.status !== 'active');
    if (shouldPublish && (galleryItems.length < 4 || galleryItems.length > 5)) {
      toast.error('Upload 4–5 unique product images before publishing.');
      return;
    }
    if (shouldPublish && (!form.name.trim() || !form.category || !form.basePrice || Number(form.basePrice) <= 0)) {
      toast.error('Add a product name, category and positive price before publishing.');
      return;
    }
    setBusy(true);
    setUploadProgress(0);
    let newlyCreatedProductId = '';
    try {
      const body = {
        name: form.name.trim(), slug: (form.slug.trim() || slugify(form.name)).toLowerCase(), sku: form.sku.trim().toUpperCase(),
        description: form.description.trim(), shortDescription: form.shortDescription.trim(), category: form.category || null,
        material: form.material.trim(), color: form.color.trim(), sareeLength: form.sareeLength.trim(), imageAltText: form.imageAltText.trim() || `Illustrative ${form.color.trim() || 'traditional'} ${form.material.trim() || 'saree'} reference image.`, imageCredit: form.imageCredit.trim(), imageLicense: form.imageLicense.trim(), imageSourceUrl: form.imageSourceUrl.trim(), basePrice: Number(form.basePrice), salePrice: form.salePrice === '' ? null : Number(form.salePrice),
        tags: csv(form.tags), fabricCare: form.fabricCare.trim(), occasion: csv(form.occasion), isFeatured: form.isFeatured,
      };
      if (form.basePrice === '') delete body.basePrice;
      if (form.salePrice === '') delete body.salePrice;
      if (editing && !body.slug) delete body.slug;
      if (editing && !body.sku) delete body.sku;
      let product;
      if (editing) {
        product = await adminApi.updateProduct(editing._id, body);
      } else {
        product = await adminApi.createProduct({ ...body, status: 'draft' });
        newlyCreatedProductId = product._id;
      }
      const stagedItems = galleryItems.filter((item) => item.kind === 'file');
      const uploadedUrls = new Map();
      if (stagedItems.length) {
        const imageForm = new FormData();
        stagedItems.forEach((item) => imageForm.append('images', item.file));
        imageForm.append('altTexts', JSON.stringify(stagedItems.map((item, index) => form.imageAltText.trim() || `${body.color} ${body.material} saree ${body.name} image ${index + 1}`.trim())));
        const uploaded = await adminApi.uploadProductImages(product._id, imageForm, (event) => {
          if (event.total) setUploadProgress(Math.round((event.loaded / event.total) * 100));
        });
        stagedItems.forEach((item, index) => {
          if (uploaded.images?.[index]?.url) uploadedUrls.set(item.key, uploaded.images[index].url);
        });
      }

      const imageUrlForItem = (item) => item.kind === 'existing' ? item.image.url : uploadedUrls.get(item.key);
      let savedImages = await adminApi.productImages(product._id);
      const desiredPrimaryItem = galleryItems.find((item) => item.key === primaryItemKey) || galleryItems[0];
      const desiredPrimaryUrl = desiredPrimaryItem ? imageUrlForItem(desiredPrimaryItem) : '';
      const desiredPrimary = savedImages.find((image) => image.url === desiredPrimaryUrl);
      if (desiredPrimary?._id && !desiredPrimary.isPrimary) {
        await adminApi.setPrimaryProductImage(product._id, desiredPrimary._id);
      }

      const selectedExistingUrls = new Set(galleryItems.filter((item) => item.kind === 'existing').map((item) => item.image.url));
      for (const oldImage of initialImagesRef.current) {
        if (selectedExistingUrls.has(oldImage.url)) continue;
        const currentImage = savedImages.find((image) => image.url === oldImage.url);
        if (currentImage?._id) await adminApi.deleteProductImage(product._id, currentImage._id);
        else if (currentImage?.isPrimary) await adminApi.removePrimaryProductImage(product._id);
      }

      savedImages = await adminApi.productImages(product._id);
      const desiredOrderIds = galleryItems
        .map((item) => savedImages.find((image) => image.url === imageUrlForItem(item))?._id)
        .filter(Boolean);
      if (desiredOrderIds.length && desiredOrderIds.length === savedImages.length) {
        await adminApi.reorderProductImages(product._id, desiredOrderIds);
      }

      if (form.status !== (editing?.status || 'draft')) {
        await adminApi.updateProductStatus(product._id, form.status);
      }

      const desiredStock = Math.max(0, Math.trunc(Number(form.stockQuantity) || 0));
      try {
        const result = await adminApi.inventoryByProduct(product._id);
        const inventory = result.inventory;
        if (inventory) {
          const delta = desiredStock - Number(inventory.quantity || 0);
          if (delta) await adminApi.adjustInventory(inventory._id, delta);
        } else {
          await adminApi.createInventory({ product: product._id, inventoryType: 'product', quantity: desiredStock, lowStockThreshold: 5 });
        }
      } catch (inventoryError) {
        if (inventoryError.response?.status === 404) await adminApi.createInventory({ product: product._id, inventoryType: 'product', quantity: desiredStock, lowStockThreshold: 5 });
        else throw inventoryError;
      }
      toast.success(editing ? 'Product changes saved.' : form.status === 'active' ? 'Product published.' : 'Product saved as a draft.');
      setModalOpen(false); clearGalleryItems(); await load();
    } catch (requestError) {
      if (newlyCreatedProductId) {
        try {
          const images = await adminApi.productImages(newlyCreatedProductId);
          for (const image of images) {
            if (image._id) await adminApi.deleteProductImage(newlyCreatedProductId, image._id);
          }
        } catch (cleanupError) {
          console.error('Incomplete product image cleanup failed:', cleanupError.message);
        }
        try { await adminApi.updateProductStatus(newlyCreatedProductId, 'archived'); }
        catch (cleanupError) { console.error('Incomplete product cleanup failed:', cleanupError.message); }
      }
      toast.error(requestError.response?.data?.message || 'The product could not be saved. Check the listing and try again.');
    } finally { setBusy(false); setUploadProgress(0); }
  };

  const exportFilteredProducts = async () => {
    const first = await adminApi.products({ page: 1, limit: 100, search: search || undefined, status: statusFilter });
    const rows = [...(first.products || [])];
    for (let current = 2; current <= (first.pagination?.totalPages || 1); current += 1) {
      const result = await adminApi.products({ page: current, limit: 100, search: search || undefined, status: statusFilter });
      rows.push(...(result.products || []));
    }
    return rows;
  };

  const archive = async (product) => {
    if (!window.confirm(`Archive “${product.name}”? Existing orders will keep their saved item details.`)) return;
    try { await adminApi.deleteProduct(product._id); toast.success('Product archived.'); await load(); }
    catch (requestError) { toast.error(requestError.response?.data?.message || 'The product could not be archived.'); }
  };

  return <div className="admin-page"><div className="admin-page-heading"><div><span className="eyebrow">Catalogue and availability</span><h1>Products</h1><p>Add, edit, feature, archive and stock the saree catalogue.</p></div><div className="admin-heading-actions"><AdminDataTools filename="nishree-products" columns={productColumns} rows={products} loadRows={exportFilteredProducts} disabled={!products.length} /><button className="admin-button-primary" type="button" onClick={openNew}><Plus size={17} /> Add product</button></div></div>
    <div className="admin-toolbar"><form className="admin-search" onSubmit={(event) => { event.preventDefault(); setPage(1); void load(); }}><Search size={17} /><input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Search products by name or SKU" aria-label="Search products" /><button type="submit">Search</button></form><label>Status<select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPage(1); }}><option value="active">Active</option><option value="draft">Draft</option><option value="archived">Archived</option><option value="all">All products</option></select></label></div>
    {error && <p className="admin-inline-error" role="alert">{error}</p>}
    {imageReport.pagination?.total > 0 && <section className="admin-image-completion-report" aria-labelledby="image-completion-title">
      <div><h2 id="image-completion-title">Product photos needing attention</h2><p>{imageReport.pagination.total} product{imageReport.pagination.total === 1 ? '' : 's'} currently have fewer than 4 unique images or need a primary-image check.</p></div>
      <div className="admin-image-completion-list">{imageReport.products.map((item) => <article key={item._id}><div><strong>{item.name || 'Untitled product'}</strong><small>{item.sku || 'No SKU'} · {item.uniqueImageCount} unique of 4 minimum · {item.primaryImageCount} primary · {item.status}</small></div><button className="admin-button-secondary" type="button" onClick={() => void openReportedProduct(item)}>Add photos</button></article>)}</div>
      {imageReport.pagination.totalPages > 1 && <div className="admin-image-report-pagination"><button className="admin-button-secondary" type="button" disabled={imageReport.pagination.page <= 1} onClick={() => void changeImageReportPage(imageReport.pagination.page - 1)}>Previous</button><small>Page {imageReport.pagination.page} of {imageReport.pagination.totalPages}</small><button className="admin-button-secondary" type="button" disabled={imageReport.pagination.page >= imageReport.pagination.totalPages} onClick={() => void changeImageReportPage(imageReport.pagination.page + 1)}>Next</button></div>}
    </section>}
    {loading ? <div className="admin-empty-state">Loading catalogue…</div> : products.length ? <div className="admin-product-list">{products.map((product) => <article className="admin-product-row" key={product._id}><img src={productImage(product)} alt={product.name} loading="lazy" width="74" height="92" /><div className="admin-product-main"><strong>{product.name || 'Untitled product'}</strong><small>{product.sku} · {product.category?.name || 'Uncategorised'} · {product.material || 'Fabric not set'}</small><small>{product.color || 'Colour not set'} · Stock: {Number(product.availableQuantity || 0)} · Images: {product.imageCount ?? (product.primaryImage?.url ? 1 : 0)}/5</small></div><div className="admin-product-price">{formatPrice(product.salePrice ?? product.basePrice)}<small><span className={`admin-status status-${product.status}`}>{product.status}</span></small></div><div className="admin-row-actions"><button type="button" aria-label={`Edit ${product.name || 'product'}`} onClick={() => openEdit(product)}><Pencil size={16} /></button><button type="button" aria-label={`Archive ${product.name || 'product'}`} onClick={() => void archive(product)}><Trash2 size={16} /></button></div></article>)}</div> : <div className="admin-empty-state">No products match this view.</div>}
    {!loading && pagination.totalPages > 1 && <div className="admin-pagination"><button className="admin-button-secondary" type="button" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>Previous</button><span>Page {page} of {pagination.totalPages} · {pagination.total} products</span><button className="admin-button-secondary" type="button" disabled={page >= pagination.totalPages} onClick={() => setPage((current) => current + 1)}>Next</button></div>}
    {modalOpen && <div className="admin-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) closeModal(); }}><section className="admin-modal" role="dialog" aria-modal="true" aria-labelledby="product-form-title"><header><div><span className="eyebrow">Catalogue details</span><h2 id="product-form-title">{editing ? 'Edit product' : 'Add a product'}</h2></div><button className="admin-icon-button" type="button" onClick={closeModal} aria-label="Close"><X /></button></header>
      <form className="admin-form-grid admin-product-form" onSubmit={save}>
        <h3 className="admin-field-wide">Product information</h3>
        <p className="admin-form-note admin-field-wide">Only a product image is required. Leave other details blank to complete them later; incomplete listings remain drafts.</p>
        <label className="admin-field-wide">Product name<input maxLength={200} value={form.name} onChange={(event) => setField('name', event.target.value)} placeholder="e.g. Kanchipuram silk saree" /></label>
        <label>SKU<input maxLength={100} value={form.sku} onChange={(event) => setField('sku', event.target.value)} placeholder="Generated if left blank" /></label>
        <label>URL slug<input maxLength={220} value={form.slug} onChange={(event) => setField('slug', event.target.value)} placeholder={slugify(form.name) || 'Generated if left blank'} /></label>
        <label>Category<select value={form.category} onChange={(event) => setField('category', event.target.value)}><option value="">Choose later</option>{categories.map((category) => <option key={category._id} value={category._id}>{category.name}</option>)}</select></label>
        <label>Fabric<input value={form.material} onChange={(event) => setField('material', event.target.value)} maxLength={100} placeholder="Silk, cotton, chiffon…" /></label>
        <label>Colour<input value={form.color} onChange={(event) => setField('color', event.target.value)} maxLength={50} placeholder="Maroon, gold…" /></label>
        <label>Saree length<input value={form.sareeLength} onChange={(event) => setField('sareeLength', event.target.value)} maxLength={50} placeholder="e.g. 5.5 m" /></label>
        <label>Price (₹)<input type="number" min="0" step="0.01" value={form.basePrice} onChange={(event) => setField('basePrice', event.target.value)} placeholder="0.00" /></label>
        <label>Discounted price (₹)<input type="number" min="0" step="0.01" value={form.salePrice} onChange={(event) => setField('salePrice', event.target.value)} placeholder="Optional" /></label>
        <label>Available stock<input type="number" min="0" max="100000" step="1" value={form.stockQuantity} onChange={(event) => setField('stockQuantity', event.target.value)} /></label>
        <label>Status<select value={form.status} onChange={(event) => setField('status', event.target.value)}><option value="draft">Draft</option><option value="active">Active</option><option value="archived">Archived</option></select></label>
        <label className="admin-field-wide">Short description<input maxLength={500} value={form.shortDescription} onChange={(event) => setField('shortDescription', event.target.value)} placeholder="A short, customer-friendly summary" /></label>
        <label className="admin-field-wide">Detailed description<textarea rows="4" maxLength={10000} value={form.description} onChange={(event) => setField('description', event.target.value)} placeholder="Describe the product, craftsmanship, and included items" /></label>
        <label>Occasions<input value={form.occasion} onChange={(event) => setField('occasion', event.target.value)} placeholder="Festive, Wedding" /></label>
        <label>Search tags<input value={form.tags} onChange={(event) => setField('tags', event.target.value)} placeholder="silk, festive, new-arrival" /></label>
        <label className="admin-field-wide">Fabric care<textarea rows="2" maxLength={1000} value={form.fabricCare} onChange={(event) => setField('fabricCare', event.target.value)} /></label>
        <label className="admin-field-wide">Image alternative text<input value={form.imageAltText} onChange={(event) => setField('imageAltText', event.target.value)} maxLength={200} /></label>
        <label>Image credit<input value={form.imageCredit} onChange={(event) => setField('imageCredit', event.target.value)} maxLength={300} /></label>
        <label>Image license<input value={form.imageLicense} onChange={(event) => setField('imageLicense', event.target.value)} maxLength={100} /></label>
        <label className="admin-field-wide">Image source URL<input type="url" value={form.imageSourceUrl} onChange={(event) => setField('imageSourceUrl', event.target.value)} maxLength={500} /></label>
        <label className="admin-check-field"><input type="checkbox" checked={form.isFeatured} onChange={(event) => setField('isFeatured', event.target.checked)} /> Feature this saree on the home page</label>
        <div className="admin-upload-field admin-field-wide">
          <label htmlFor="admin-product-image"><span><ImagePlus size={17} /> Product images ({galleryItems.length}/5) {!galleryItems.length && <b>Recommended</b>}</span></label>
          <p>Upload 4–5 different product photographs for the best shopping experience. JPG, PNG or WebP, up to 5 MB each.</p>
          <label className={`admin-image-dropzone${galleryItems.length >= 5 ? ' is-full' : ''}`} htmlFor="admin-product-image" onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); addFiles(Array.from(event.dataTransfer.files || [])); }}>
            <UploadCloud size={22} />
            <span>{galleryItems.length >= 5 ? 'Maximum of 5 images reached' : 'Drag photos here or browse to upload'}</span>
            <small>{5 - galleryItems.length} image{5 - galleryItems.length === 1 ? '' : 's'} available</small>
          </label>
          <input ref={fileInputRef} id="admin-product-image" type="file" accept="image/jpeg,image/png,image/webp" multiple disabled={galleryItems.length >= 5 || busy} onChange={selectFiles} />
          {imagesLoading && <small>Loading saved product photos…</small>}
          {galleryItems.length > 0 && <div className="admin-product-image-selections">
            {galleryItems.map((item, index) => <article
              className={`admin-product-image-selection${item.key === primaryItemKey ? ' is-primary' : ''}`}
              key={item.key}
              draggable={!busy}
              onDragStart={() => setDraggedItemKey(item.key)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => { event.preventDefault(); moveGalleryItem(draggedItemKey, item.key); setDraggedItemKey(''); }}
              onDragEnd={() => setDraggedItemKey('')}
            >
              <div className="admin-product-image-thumb"><img src={item.kind === 'existing' ? item.image.url : item.previewUrl} alt={item.kind === 'existing' ? item.image.altText || `Product image ${index + 1}` : `Selected product image ${index + 1}`} loading="lazy" />
                <span>{item.key === primaryItemKey ? 'Primary image' : `Image ${index + 1}`}</span>
              </div>
              <small><GripVertical size={13} /> Drag to reorder</small>
              <div className="admin-product-image-actions">
                <button className="admin-button-secondary" type="button" disabled={busy || item.key === primaryItemKey} onClick={() => setPrimaryItemKey(item.key)}>Set primary</button>
                <button className="admin-image-order-button" type="button" aria-label="Move image up" disabled={busy || index === 0} onClick={() => moveGalleryItem(item.key, galleryItems[index - 1]?.key)}><ArrowUp size={14} /></button>
                <button className="admin-image-order-button" type="button" aria-label="Move image down" disabled={busy || index === galleryItems.length - 1} onClick={() => moveGalleryItem(item.key, galleryItems[index + 1]?.key)}><ArrowDown size={14} /></button>
                <button className="admin-image-remove-button" type="button" disabled={busy} onClick={() => removeGalleryItem(item.key)} aria-label={`Remove image ${index + 1}`}><X size={15} /></button>
              </div>
            </article>)}
          </div>}
          {galleryItems.length < 4 && <small className="admin-image-warning" role="status">{editing ? `This product has ${galleryItems.length} image${galleryItems.length === 1 ? '' : 's'}. Upload ${4 - galleryItems.length} more genuine photo${4 - galleryItems.length === 1 ? '' : 's'} to complete its gallery; existing active products are not unpublished automatically.` : 'A draft may be saved with fewer photos, but it cannot be published until it has 4–5 unique images.'}</small>}
          {uploadProgress > 0 && busy && <div className="admin-upload-progress" role="status"><span>Uploading photos · {uploadProgress}%</span><progress max="100" value={uploadProgress} /></div>}
        </div>
        <div className="admin-form-actions admin-field-wide"><button className="admin-button-secondary" type="button" onClick={closeModal} disabled={busy}>Cancel</button><button className="admin-button-primary" type="submit" disabled={busy || imagesLoading}>{busy ? 'Saving…' : editing ? 'Save changes' : form.status === 'active' ? 'Create and publish' : 'Save draft'}</button></div>
      </form>
    </section></div>}
  </div>;
}
