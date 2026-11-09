import { useEffect, useMemo, useState } from 'react';
import { useSearchParams, useParams, useLocation, Link } from 'react-router-dom';
import { ArrowLeft, ArrowRight, SlidersHorizontal, X } from 'lucide-react';
import { catalogApi } from '../api/catalogApi';
import ProductCard from '../components/ProductCard';
import { EmptyState, ErrorState, SkeletonGrid } from '../components/States';
import { Reveal } from '../components/Reveal';
import CollectionPage from '../components/CollectionPage';
import ShopLanding from '../components/ShopLanding';
import { collectionBySlug } from '../data/collectionCatalog';
import festiveCollectionImage from '../assets/Royal Diwali Saree by the Palace.png';
import { useSeoMeta } from '../utils/seo';

const sortValues = ['newest', 'oldest', 'featured', 'name-asc', 'name-desc', 'price-asc', 'price-desc'];
const emptyLandingStatuses = {
  bestSellers: 'loading',
  featured: 'loading',
  facets: 'loading',
};
let verifiedCategoriesCache = null;
const isCancelledRequest = (error, signal) => signal?.aborted
  || error?.name === 'CanceledError'
  || error?.name === 'AbortError'
  || error?.code === 'ERR_CANCELED';

export default function ShopPage() {
  const { slug } = useParams();
  const location = useLocation();
  const collection = slug ? collectionBySlug.get(slug) : null;
  const [searchParams, setSearchParams] = useSearchParams();
  const [categories, setCategories] = useState(() => verifiedCategoriesCache?.categories || []);
  const [categoriesLoading, setCategoriesLoading] = useState(() => !verifiedCategoriesCache);
  const [categoryError, setCategoryError] = useState('');
  const [categoryAttempt, setCategoryAttempt] = useState(0);
  const [category, setCategory] = useState(null);
  const [products, setProducts] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [landingAttempt, setLandingAttempt] = useState(0);
  const [landingStatuses, setLandingStatuses] = useState(emptyLandingStatuses);
  const [landingData, setLandingData] = useState(() => ({
    bestSellers: [],
    featured: [],
    facets: null,
  }));
  const [draft, setDraft] = useState(() => ({
    search: searchParams.get('search') || '',
    category: searchParams.get('category') || '',
    material: searchParams.get('material') || '',
    occasion: searchParams.get('occasion') || '',
    color: searchParams.get('color') || '',
    minPrice: searchParams.get('minPrice') || '',
    maxPrice: searchParams.get('maxPrice') || '',
    available: searchParams.get('available') || '',
    sort: sortValues.includes(searchParams.get('sort')) ? searchParams.get('sort') : 'newest',
  }));
  const page = Math.max(1, Number(searchParams.get('page')) || 1);
  const currentSearch = searchParams.get('search') || '';
  const currentCategory = slug || searchParams.get('category') || '';
  const currentMaterial = searchParams.get('material') || '';
  const currentOccasion = searchParams.get('occasion') || '';
  const currentColor = searchParams.get('color') || '';
  const available = searchParams.get('available') || '';
  const minPrice = searchParams.get('minPrice') || '';
  const maxPrice = searchParams.get('maxPrice') || '';
  const sort = sortValues.includes(searchParams.get('sort')) ? searchParams.get('sort') : 'newest';
  const showShopLanding = !slug && searchParams.toString() === '';

  useEffect(() => {
    if (slug) return undefined;
    if (verifiedCategoriesCache) return undefined;
    const controller = new AbortController();
    catalogApi.allCategories(controller.signal)
      .then((categoryResponse) => {
        if (controller.signal.aborted) return;
        const availableCategories = (categoryResponse.categories || [])
          .filter((item) => Number(item.productCount) > 0);
        verifiedCategoriesCache = { categories: availableCategories };
        setCategories(availableCategories);
        setCategoryError('');
        setCategoriesLoading(false);
      })
      .catch((requestError) => {
        if (!isCancelledRequest(requestError, controller.signal)) {
          setCategories([]);
          setCategoryError(requestError.response?.data?.message || 'We could not confirm which categories currently contain products.');
          setCategoriesLoading(false);
        }
      });
    return () => controller.abort();
  }, [slug, categoryAttempt]);

  useEffect(() => {
    if (!showShopLanding) return undefined;
    const controller = new AbortController();
    Promise.allSettled([
      catalogApi.bestSellers({ limit: 8 }, controller.signal),
      catalogApi.products({ page: 1, limit: 8, isFeatured: true, sort: 'featured' }, controller.signal),
      catalogApi.facets(controller.signal),
    ]).then(([bestSellersResult, featuredResult, facetsResult]) => {
      if (controller.signal.aborted) return;
      const bestSellers = bestSellersResult.status === 'fulfilled' ? (bestSellersResult.value.products || []) : [];
      const featured = featuredResult.status === 'fulfilled' ? (featuredResult.value.products || []) : [];
      const facets = facetsResult.status === 'fulfilled' ? (facetsResult.value.facets || null) : null;
      setLandingData({ bestSellers, featured, facets });
      setLandingStatuses((current) => ({
        ...current,
        bestSellers: bestSellersResult.status === 'fulfilled' ? 'ready' : 'error',
        featured: featuredResult.status === 'fulfilled' ? 'ready' : 'error',
        facets: facetsResult.status === 'fulfilled' ? 'ready' : 'error',
      }));
    });
    return () => controller.abort();
  }, [showShopLanding, landingAttempt]);

  useEffect(() => {
    const controller = new AbortController();
    const collectionQuery = collection?.query || {};
    const {
      categories: sourceCategories,
      search: collectionSearch,
      material: collectionMaterial,
      excludeMaterial: collectionExcludeMaterial,
      ...collectionFilters
    } = collectionQuery;
    Promise.all([
      catalogApi.products({
        ...collectionFilters,
        page,
        limit: 12,
        search: currentSearch || undefined,
        collectionSearch: collectionSearch || undefined,
        collectionMaterial: collectionMaterial || undefined,
        collectionExcludeMaterial: collectionExcludeMaterial || undefined,
        categories: sourceCategories?.join(',') || undefined,
        category: collection ? undefined : currentCategory || undefined,
        material: currentMaterial || undefined,
        occasion: currentOccasion || undefined,
        color: currentColor || undefined,
        minPrice: minPrice || undefined,
        maxPrice: maxPrice || undefined,
        available: available || undefined,
        sort,
      }, controller.signal),
      slug && !collection ? catalogApi.category(slug, controller.signal) : Promise.resolve(null),
    ]).then(([data, categoryData]) => {
      setProducts(data.products || []);
      setPagination(data.pagination || null);
      setCategory(categoryData?.category || null);
      setError('');
    }).catch((fetchError) => {
      if (fetchError.name !== 'CanceledError') setError(fetchError.response?.data?.message || 'We could not load the collection. Please try again.');
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [page, currentSearch, currentCategory, currentMaterial, currentOccasion, currentColor, minPrice, maxPrice, available, sort, slug, collection, attempt]);

  useSeoMeta({
    title: slug
      ? collection?.seoTitle || category?.seoTitle || `${category?.name || 'Saree collection'} | Nishree Attire`
      : 'Shop Sarees Online | Nishree Attire',
    description: slug
      ? collection?.seoDescription || category?.seoDescription || category?.description || 'Discover sarees selected by Nishree Attire.'
      : 'Shop sarees online at Nishree Attire. Explore silk, cotton and designer sarees selected for thoughtful style and graceful draping.',
    path: location.pathname,
    robots: searchParams.toString() ? 'noindex,follow' : 'index,follow',
  });

  const activeFilterCount = useMemo(() => [currentSearch, !collection && currentCategory, currentMaterial, currentOccasion, currentColor, minPrice, maxPrice, available].filter(Boolean).length, [currentSearch, currentCategory, currentMaterial, currentOccasion, currentColor, minPrice, maxPrice, available, collection]);
  const apply = (event) => {
    event.preventDefault();
    const next = {};
    Object.entries(draft).forEach(([key, value]) => { if (String(value).trim()) next[key] = String(value).trim(); });
    if (slug) delete next.category;
    setSearchParams(next);
    setFiltersOpen(false);
  };
  const clear = () => { setDraft({ search: '', category: '', material: '', occasion: '', color: '', minPrice: '', maxPrice: '', available: '', sort: 'newest' }); setSearchParams(slug ? {} : { sort: 'newest' }); };
  const changePage = (next) => { const params = new URLSearchParams(searchParams); if (next <= 1) params.delete('page'); else params.set('page', String(next)); setSearchParams(params); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const retryCategories = () => {
    setCategoriesLoading(true);
    setCategoryError('');
    setCategoryAttempt((value) => value + 1);
  };
  const retryLandingContent = () => {
    setLandingStatuses(emptyLandingStatuses);
    setLandingAttempt((value) => value + 1);
  };

  return <div className={`page-wrap shop-page${showShopLanding ? ' is-landing' : ''}`}>
    {showShopLanding && <section className="shop-campaign-hero" aria-label="The Nishree festive collection">
      <div className="shop-campaign-copy">
        <span className="eyebrow">NISHREE ATTIRE · THE FESTIVE COLLECTION</span>
        <h1>Tradition, <em>made for you.</em></h1>
        <p>Discover handpicked sarees for celebrations, quiet rituals and every beautiful moment in between.</p>
        <div className="shop-campaign-actions">
          <a className="button button-primary" href="#shop-all-categories">Explore the collection <ArrowRight size={15} aria-hidden="true" /></a>
          <Link className="shop-campaign-secondary" to="/product_hub">Explore Product Hub <ArrowRight size={14} aria-hidden="true" /></Link>
        </div>
        <div className="shop-campaign-note"><span>01</span> A considered collection <i /> <span>02</span> Selected with care</div>
      </div>
      <div className="shop-campaign-image"><img src={festiveCollectionImage} alt="A festive saree styled in a palace-inspired setting" fetchPriority="high" /><span>THE NISHREE EDIT <b>·</b> FESTIVE 2026</span></div>
      <span className="shop-campaign-ornament" aria-hidden="true">✿</span>
    </section>}
    {showShopLanding && <ShopLanding
      categories={categories}
      categoriesLoading={categoriesLoading}
      categoryError={categoryError}
      onRetryCategories={retryCategories}
      bestSellers={landingData.bestSellers}
      bestSellerStatus={landingStatuses.bestSellers}
      onRetryBestSellers={retryLandingContent}
      featured={landingData.featured}
      featuredStatus={landingStatuses.featured}
      onRetryFeatured={retryLandingContent}
      facets={landingData.facets}
      facetsStatus={landingStatuses.facets}
      onRetryContent={retryLandingContent}
    />}
    {showShopLanding && (
      <div className="shop-results-heading">
        <span className="eyebrow">Explore the full edit</span>
        <h2>Shop all sarees</h2>
        <p>Use the filters to narrow the collection by fabric, occasion, colour and price.</p>
      </div>
    )}
    {collection ? <CollectionPage collection={collection} /> : <div className="shop-heading"><div className="breadcrumbs"><Link to="/">Home</Link><span>/</span><span>{category?.name || 'The collection'}</span></div><span className="eyebrow">NISHREE ATTIRE · THE COLLECTION</span><h1>{category?.name || 'Sarees for the moments that matter.'}</h1><p>{category?.description || 'Discover the pieces currently available in the Nishree Attire collection.'}</p></div>}
    <div className="shop-layout">
    <aside className={`shop-filter-sidebar${filtersOpen ? ' is-open' : ''}`}><form className="shop-filters" onSubmit={apply}><div className="filters-top"><h2>Refine your search</h2><button type="button" className="icon-button filter-close" aria-label="Close filters" onClick={() => setFiltersOpen(false)}><X size={18} /></button></div>
    <label>Search<input value={draft.search} onChange={(event) => setDraft({ ...draft, search: event.target.value })} placeholder="A colour, a feeling, a name" /></label>
    {!slug && <label>Collection<select value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value })}><option value="">All collections</option>{categories.map((item) => <option value={item.slug} key={item._id}>{item.name}</option>)}</select></label>}
    <label>Material<input value={draft.material} onChange={(event) => setDraft({ ...draft, material: event.target.value })} placeholder="Search materials" /></label>
    <label>Occasion<input value={draft.occasion} onChange={(event) => setDraft({ ...draft, occasion: event.target.value })} placeholder="Wedding, festive, everyday" /></label>
    <label>Colour<input value={draft.color} onChange={(event) => setDraft({ ...draft, color: event.target.value })} placeholder="Search colours" /></label>
    <label>Availability<select value={draft.available} onChange={(event) => setDraft({ ...draft, available: event.target.value })}><option value="">All pieces</option><option value="true">In stock</option><option value="false">Out of stock</option></select></label>
    <fieldset><legend>Price range · INR</legend><label className="sr-only" htmlFor="min-price">Minimum price</label><input id="min-price" inputMode="numeric" type="number" min="0" placeholder="From" value={draft.minPrice} onChange={(event) => setDraft({ ...draft, minPrice: event.target.value })} /><span>to</span><label className="sr-only" htmlFor="max-price">Maximum price</label><input id="max-price" inputMode="numeric" type="number" min="0" placeholder="To" value={draft.maxPrice} onChange={(event) => setDraft({ ...draft, maxPrice: event.target.value })} /></fieldset>
    <div className="filter-actions"><button type="button" className="text-link" onClick={clear}>Clear all</button><button className="button button-primary" type="submit">Apply filters <ArrowRight size={15} /></button></div>
    </form></aside>
    <section className="shop-main"><div className="shop-toolbar"><span className="results-count">{loading ? 'Gathering the collection…' : `${pagination?.total ?? products.length} ${pagination?.total === 1 ? 'piece' : 'pieces'}`}</span><div className="toolbar-actions"><button type="button" className="filter-trigger" onClick={() => setFiltersOpen((open) => !open)} aria-expanded={filtersOpen}><SlidersHorizontal size={16} /> Filters{activeFilterCount > 0 && <span>{activeFilterCount}</span>}</button><label className="sort-control">Sort by <select value={draft.sort} onChange={(event) => { setDraft((current) => ({ ...current, sort: event.target.value })); const next = new URLSearchParams(searchParams); next.set('sort', event.target.value); next.delete('page'); setSearchParams(next); }}><option value="featured">Featured</option><option value="price-asc">Price: Low to High</option><option value="price-desc">Price: High to Low</option><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="name-asc">Name A–Z</option><option value="name-desc">Name Z–A</option></select></label></div></div>
    {loading ? <SkeletonGrid count={8} /> : error ? <ErrorState message={error} onRetry={() => { setLoading(true); setAttempt((value) => value + 1); }} /> : products.length ? <>
    <div className="product-grid shop-product-grid">{products.map((product, index) => <Reveal key={product._id} delay={(index % 4) * 0.035}><ProductCard product={product} index={index} /></Reveal>)}</div>
    {pagination?.totalPages > 1 && <nav className="pagination" aria-label="Product pages"><button type="button" className="button button-quiet" onClick={() => changePage(page - 1)} disabled={page <= 1}><ArrowLeft size={15} /> Previous</button><span>Page {pagination.page} of {pagination.totalPages}</span><button type="button" className="button button-quiet" onClick={() => changePage(page + 1)} disabled={page >= pagination.totalPages}>Next <ArrowRight size={15} /></button></nav>}
    </> : <EmptyState title="No pieces found in this edit."><span>Try a different search or clear the filters to see the full collection.</span><button className="button button-outline" type="button" onClick={clear}>Clear filters</button></EmptyState>}
    </section>
    </div>
  </div>;
}
