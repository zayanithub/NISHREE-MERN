import { useEffect, useMemo, useState } from 'react';
import { useSearchParams, useParams, Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, SlidersHorizontal, X } from 'lucide-react';
import { catalogApi } from '../api/catalogApi';
import ProductCard from '../components/ProductCard';
import { EmptyState, ErrorState, SkeletonGrid } from '../components/States';
import { Reveal } from '../components/Reveal';
import CataloguePreviewNotice from '../components/CataloguePreviewNotice';
import sareeBannerOne from '../assets/saree shop image.jpg';
import sareeBannerTwo from '../assets/saree imagesss.jpg';
import sareeBannerThree from '../assets/saree girl image.jpg';
import categoryImageOne from '../assets/saree product image 1.jpg';
import categoryImageTwo from '../assets/saree images.jpg';
import categoryImageThree from '../assets/saree imagess.jpg';
import categoryImageFour from '../assets/saree product image.jpg';

const sortValues = ['newest', 'oldest', 'featured', 'name-asc', 'name-desc'];
const bannerImages = [sareeBannerOne, sareeBannerTwo, sareeBannerThree];
const categoryFallbackImages = [categoryImageOne, categoryImageTwo, categoryImageThree, categoryImageFour];

export default function ShopPage() {
  const { slug } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const [categories, setCategories] = useState([]);
  const [categoryError, setCategoryError] = useState('');
  const [category, setCategory] = useState(null);
  const [products, setProducts] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [bannerIndex, setBannerIndex] = useState(0);
  const [draft, setDraft] = useState(() => ({
    search: searchParams.get('search') || '',
    category: searchParams.get('category') || '',
    material: searchParams.get('material') || '',
    color: searchParams.get('color') || '',
    minPrice: searchParams.get('minPrice') || '',
    maxPrice: searchParams.get('maxPrice') || '',
    sort: sortValues.includes(searchParams.get('sort')) ? searchParams.get('sort') : 'newest',
  }));
  const page = Math.max(1, Number(searchParams.get('page')) || 1);
  const currentSearch = searchParams.get('search') || '';
  const currentCategory = slug || searchParams.get('category') || '';
  const currentMaterial = searchParams.get('material') || '';
  const currentColor = searchParams.get('color') || '';
  const minPrice = searchParams.get('minPrice') || '';
  const maxPrice = searchParams.get('maxPrice') || '';
  const sort = sortValues.includes(searchParams.get('sort')) ? searchParams.get('sort') : 'newest';
  useEffect(() => {
    const timer = window.setInterval(() => {
      setBannerIndex((index) => (index + 1) % bannerImages.length);
    }, 6_500);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    catalogApi.categories({ page: 1, limit: 100 }, controller.signal)
      .then((data) => setCategories(data.categories || []))
      .catch((requestError) => { if (requestError.name !== 'CanceledError') setCategoryError(requestError.response?.data?.message || 'Product categories could not be loaded.'); });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      catalogApi.products({
        page,
        limit: 12,
        search: currentSearch || undefined,
        category: currentCategory || undefined,
        material: currentMaterial || undefined,
        color: currentColor || undefined,
        minPrice: minPrice || undefined,
        maxPrice: maxPrice || undefined,
        sort,
      }, controller.signal),
      slug ? catalogApi.category(slug, controller.signal) : Promise.resolve(null),
    ]).then(([data, categoryData]) => {
      setProducts(data.products || []);
      setPagination(data.pagination || null);
      setCategory(categoryData?.category || null);
    }).catch((fetchError) => {
      if (fetchError.name !== 'CanceledError') setError(fetchError.response?.data?.message || 'We could not load the collection. Please try again.');
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [page, currentSearch, currentCategory, currentMaterial, currentColor, minPrice, maxPrice, sort, slug, attempt]);

  const activeFilterCount = useMemo(() => [currentSearch, currentCategory, currentMaterial, currentColor, minPrice, maxPrice].filter(Boolean).length, [currentSearch, currentCategory, currentMaterial, currentColor, minPrice, maxPrice]);
  const apply = (event) => {
    event.preventDefault();
    const next = {};
    Object.entries(draft).forEach(([key, value]) => { if (String(value).trim()) next[key] = String(value).trim(); });
    if (slug) delete next.category;
    setSearchParams(next);
    setFiltersOpen(false);
  };
  const clear = () => { setDraft({ search: '', category: '', material: '', color: '', minPrice: '', maxPrice: '', sort: 'newest' }); setSearchParams(slug ? {} : { sort: 'newest' }); };
  const changePage = (next) => { const params = new URLSearchParams(searchParams); if (next <= 1) params.delete('page'); else params.set('page', String(next)); setSearchParams(params); window.scrollTo({ top: 0, behavior: 'smooth' }); };

  return <div className="page-wrap shop-page">
    <div className="shop-heading"><div className="breadcrumbs"><Link to="/">Home</Link><span>/</span><span>{category?.name || 'The collection'}</span></div><span className="eyebrow">NISHREE ATTIRE · THE COLLECTION</span><h1>{category?.name || 'Sarees for the moments that matter.'}</h1><p>{category?.description || 'Discover the pieces currently available in the Nishree Attire collection.'}</p></div>
    {!slug && <section className="shop-category-strip" aria-label="Shop by category"><div className="shop-category-heading"><span className="eyebrow">Explore the edits</span><Link to="/shop">All pieces <ArrowRight size={14} /></Link></div>{categoryError ? <p className="inline-error" role="alert">{categoryError}</p> : categories.length ? <div className="shop-category-links">{categories.map((item, index) => {
      const fallbackImage = categoryFallbackImages[index % categoryFallbackImages.length];
      return <Link to={`/collections/${item.slug}`} key={item._id} className={`shop-category-link${currentCategory === item.slug ? ' is-active' : ''}`} aria-current={currentCategory === item.slug ? 'page' : undefined}><img src={item.image?.url || fallbackImage} onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = fallbackImage; }} alt="" loading="lazy" decoding="async" width="72" height="72" /><span>{item.name}</span></Link>;
    })}</div> : <p className="quiet-note">Browse the complete collection below.</p>}</section>}
    {!slug && <section className="shop-saree-carousel" aria-label="Nishree saree collection">
      {bannerImages.map((image, index) => <img key={image} className={index === bannerIndex ? 'is-active' : ''} src={image} alt="" loading="eager" decoding="async" />)}
      <div className="shop-saree-caption"><span className="eyebrow">Woven for your moments</span><h2>A drape to remember.</h2></div>
      <div className="shop-saree-indicators" role="group" aria-label="Choose collection image">
        {bannerImages.map((image, index) => <button key={image} type="button" aria-label={`Show collection image ${index + 1}`} aria-pressed={index === bannerIndex} onClick={() => setBannerIndex(index)} />)}
      </div>
    </section>}
    <div className="shop-layout">
    <aside className={`shop-filter-sidebar${filtersOpen ? ' is-open' : ''}`}><form className="shop-filters" onSubmit={apply}><div className="filters-top"><h2>Refine your search</h2><button type="button" className="icon-button filter-close" aria-label="Close filters" onClick={() => setFiltersOpen(false)}><X size={18} /></button></div>
    <label>Search<input value={draft.search} onChange={(event) => setDraft({ ...draft, search: event.target.value })} placeholder="A colour, a feeling, a name" /></label>
    {!slug && <label>Collection<select value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value })}><option value="">All collections</option>{categories.map((item) => <option value={item.slug} key={item._id}>{item.name}</option>)}</select></label>}
    <label>Material<input value={draft.material} onChange={(event) => setDraft({ ...draft, material: event.target.value })} placeholder="Search materials" /></label>
    <label>Colour<input value={draft.color} onChange={(event) => setDraft({ ...draft, color: event.target.value })} placeholder="Search colours" /></label>
    <fieldset><legend>Price range · INR</legend><label className="sr-only" htmlFor="min-price">Minimum price</label><input id="min-price" inputMode="numeric" type="number" min="0" placeholder="From" value={draft.minPrice} onChange={(event) => setDraft({ ...draft, minPrice: event.target.value })} /><span>to</span><label className="sr-only" htmlFor="max-price">Maximum price</label><input id="max-price" inputMode="numeric" type="number" min="0" placeholder="To" value={draft.maxPrice} onChange={(event) => setDraft({ ...draft, maxPrice: event.target.value })} /></fieldset>
    <div className="filter-actions"><button type="button" className="text-link" onClick={clear}>Clear all</button><button className="button button-primary" type="submit">Apply filters <ArrowRight size={15} /></button></div>
    </form></aside>
    <section className="shop-main"><div className="shop-toolbar"><span className="results-count">{loading ? 'Gathering the collection…' : `${pagination?.total ?? products.length} ${pagination?.total === 1 ? 'piece' : 'pieces'}`}</span><div className="toolbar-actions"><button type="button" className="filter-trigger" onClick={() => setFiltersOpen((open) => !open)} aria-expanded={filtersOpen}><SlidersHorizontal size={16} /> Filters{activeFilterCount > 0 && <span>{activeFilterCount}</span>}</button><label className="sort-control">Sort by <select value={draft.sort} onChange={(event) => { setDraft((current) => ({ ...current, sort: event.target.value })); const next = new URLSearchParams(searchParams); next.set('sort', event.target.value); next.delete('page'); setSearchParams(next); }}><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="featured">Featured</option><option value="name-asc">Name A–Z</option><option value="name-desc">Name Z–A</option></select></label></div></div>
    {products.some((product) => product.tags?.includes('catalogue-preview')) && <CataloguePreviewNotice />}
    {loading ? <SkeletonGrid count={8} /> : error ? <ErrorState message={error} onRetry={() => setAttempt((value) => value + 1)} /> : products.length ? <>
    <div className="product-grid shop-product-grid">{products.map((product, index) => <Reveal key={product._id} delay={(index % 4) * 0.035}><ProductCard product={product} index={index} /></Reveal>)}</div>
    {pagination?.totalPages > 1 && <nav className="pagination" aria-label="Product pages"><button type="button" className="button button-quiet" onClick={() => changePage(page - 1)} disabled={page <= 1}><ArrowLeft size={15} /> Previous</button><span>Page {pagination.page} of {pagination.totalPages}</span><button type="button" className="button button-quiet" onClick={() => changePage(page + 1)} disabled={page >= pagination.totalPages}>Next <ArrowRight size={15} /></button></nav>}
    </> : <EmptyState title="No pieces found in this edit."><span>Try a different search or clear the filters to see the full collection.</span><button className="button button-outline" type="button" onClick={clear}>Clear filters</button></EmptyState>}
    </section>
    </div>
    <nav className="shop-account-links" aria-label="Your account">
      <div><span className="eyebrow">Your Nishree account</span><h2>Everything in its place.</h2><p>Orders, saved pieces and delivery details, whenever you need them.</p></div>
      <div className="shop-account-link-list">
        <Link to="/account">My account</Link>
        <Link to="/account/orders">My orders & tracking</Link>
        <Link to="/wishlist">My wishlist</Link>
        <Link to="/account/addresses">My addresses</Link>
        <Link to="/account/reviews">My reviews</Link>
      </div>
    </nav>
  </div>;
}
