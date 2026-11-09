import { useMemo } from 'react';
import { ArrowRight, ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { productImage } from '../utils/format';
import ShopProductRail from './ShopProductRail';
import categoryImageOne from '../assets/saree product image 1.jpg';
import categoryImageTwo from '../assets/saree images.jpg';
import categoryImageThree from '../assets/saree imagess.jpg';
import categoryImageFour from '../assets/saree product image.jpg';
import '../pages/ShopPage.css';

const categoryFallbackImages = [categoryImageOne, categoryImageTwo, categoryImageThree, categoryImageFour];
const searchHref = (key, value) => `/shop?${new URLSearchParams({ [key]: value }).toString()}`;


function ShopByCategory({ categories, loading, error, onRetry }) {
  return (
    <section id="shop-all-categories" className="shop-category-section" aria-labelledby="shop-all-categories-title">
      <div className="shop-section-heading">
        <div>
          <span className="eyebrow">Find the weave that speaks to you</span>
          <h2 id="shop-all-categories-title">Shop by category</h2>
        </div>
        <Link to="/shop" className="text-link">View all sarees <ArrowRight size={15} aria-hidden="true" /></Link>
      </div>
      {loading ? (
        <div className="shop-category-grid-loading" role="status">Gathering the available categories…</div>
      ) : error ? (
        <div className="shop-category-state" role="alert"><span>Categories could not be loaded.</span><button type="button" onClick={onRetry}>Try again</button></div>
      ) : categories.length ? (
        <div className="shop-category-card-grid">
          {categories.map((category, index) => {
            const fallback = categoryFallbackImages[index % categoryFallbackImages.length];
            return (
              <Link className="shop-category-card" to={`/collections/${category.slug}`} key={category._id || category.slug}>
                <span className="shop-category-card-image"><img src={category.image?.url || fallback} alt="" loading="lazy" decoding="async" onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = fallback; }} /></span>
                <span className="shop-category-card-copy"><strong>{category.name}</strong><small>{category.description || 'Explore this Nishree collection'}</small></span>
                <ArrowUpRight size={16} aria-hidden="true" />
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="shop-category-grid-loading">Categories will appear here as they become available.</div>
      )}
    </section>
  );
}

function ShopByOccasion({ facets, status, products, onRetry }) {
  const occasions = facets?.occasions || [];
  const productByOccasion = useMemo(() => {
    const map = new Map();
    products.forEach((product) => (product.occasion || []).forEach((occasion) => {
      if (!map.has(occasion) && productImage(product)) map.set(occasion, product);
    }));
    return map;
  }, [products]);

  if (status === 'ready' && !occasions.length) return null;

  return (
    <section className="shop-occasion-section" aria-labelledby="shop-occasion-title">
      <div className="shop-section-heading">
        <div><span className="eyebrow">For the moments that matter</span><h2 id="shop-occasion-title">Shop by occasion</h2></div>
        <Link to="/shop" className="text-link">View all pieces <ArrowRight size={15} aria-hidden="true" /></Link>
      </div>
      {status === 'loading' ? (
        <div className="shop-occasion-state" role="status">Finding occasion edits from the collection…</div>
      ) : status === 'error' ? (
        <div className="shop-category-state" role="alert"><span>Occasion edits could not be loaded.</span><button type="button" onClick={onRetry}>Try again</button></div>
      ) : (
        <div className="shop-occasion-grid">
          {occasions.map((occasion, index) => {
            const product = productByOccasion.get(occasion);
            const fallback = categoryFallbackImages[index % categoryFallbackImages.length];
            return (
              <Link to={searchHref('occasion', occasion)} className="shop-occasion-card" key={occasion}>
                <img
                  src={product ? productImage(product) : fallback}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  onError={(event) => {
                    event.currentTarget.onerror = null;
                    event.currentTarget.src = fallback;
                  }}
                />
                <span className="shop-occasion-shade" aria-hidden="true" />
                <span className="shop-occasion-copy"><small>{String(index + 1).padStart(2, '0')}</small><strong>{occasion}</strong><ArrowUpRight size={15} aria-hidden="true" /></span>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}

export default function ShopLanding({
  categories,
  categoriesLoading,
  categoryError,
  onRetryCategories,
  bestSellers,
  bestSellerStatus,
  onRetryBestSellers,
  featured,
  featuredStatus,
  onRetryFeatured,
  facets,
  facetsStatus,
  onRetryContent,
}) {
  const productSet = [...bestSellers, ...featured];

  return (
    <div className="shop-landing">
      <ShopByCategory categories={categories} loading={categoriesLoading} error={categoryError} onRetry={onRetryCategories} />

      <ShopByOccasion facets={facets} status={facetsStatus} products={productSet} onRetry={onRetryContent} />

      <ShopProductRail
        id="shop-best-sellers"
        title="Best sellers"
        kicker="Chosen by customers"
        description="Pieces ranked from completed paid orders and delivered cash-on-delivery orders."
        products={bestSellers}
        status={bestSellerStatus}
        onRetry={onRetryBestSellers}
        to="/shop?sort=featured"
        linkLabel="Browse the full collection"
      />

      <ShopProductRail
        id="shop-featured-pieces"
        title="Featured pieces"
        kicker="A considered edit"
        products={featured}
        status={featuredStatus}
        onRetry={onRetryFeatured}
        to="/shop?sort=featured"
        linkLabel="Explore featured pieces"
      />
    </div>
  );
}
