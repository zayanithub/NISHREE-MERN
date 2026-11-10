import { useEffect, useState } from 'react';
import { ArrowRight, ArrowUpRight, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import { catalogApi } from '../api/catalogApi';
import ProductCard from '../components/ProductCard';
import { ErrorState, LoadingState } from '../components/States';
import ResponsiveImage from '../components/ResponsiveImage';
import heroImage from '../assets/saree girls image.jpg';
import categoryImageOne from '../assets/saree product image 1.jpg';
import categoryImageTwo from '../assets/saree images.jpg';
import categoryImageThree from '../assets/saree imagess.jpg';
import categoryImageFour from '../assets/saree product image.jpg';
import './ProductHubPage.css';

const pageSize = 12;
const categoryFallbackImages = [categoryImageOne, categoryImageTwo, categoryImageThree, categoryImageFour];

export default function ProductHubPage() {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [status, setStatus] = useState('loading');
  const [error, setError] = useState('');
  const [categoryError, setCategoryError] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [sort, setSort] = useState('featured');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    Promise.allSettled([
      catalogApi.allCategories(controller.signal),
      catalogApi.products({
        page,
        limit: pageSize,
        category: selectedCategory || undefined,
        sort,
      }, controller.signal),
    ]).then(([categoryResult, productResult]) => {
      if (controller.signal.aborted) return;

      if (categoryResult.status === 'fulfilled') {
        setCategories((categoryResult.value.categories || [])
          .filter((category) => Number(category.productCount) > 0));
        setCategoryError('');
      } else {
        setCategories([]);
        setCategoryError(categoryResult.reason.response?.data?.message || 'Categories could not be loaded.');
      }

      if (productResult.status === 'fulfilled') {
        setProducts(productResult.value.products || []);
        setPagination(productResult.value.pagination || { page, totalPages: 1, total: 0 });
        setError('');
        setStatus('ready');
      } else {
        setProducts([]);
        setError(productResult.reason.response?.data?.message || 'Products could not be loaded.');
        setStatus('error');
      }
    });

    return () => controller.abort();
  }, [attempt, page, selectedCategory, sort]);

  const chooseCategory = (categorySlug) => {
    setStatus('loading');
    setSelectedCategory((current) => current === categorySlug ? '' : categorySlug);
    setPage(1);
  };

  const changePage = (nextPage) => {
    setStatus('loading');
    setPage(nextPage);
  };

  const changeSort = (nextSort) => {
    setStatus('loading');
    setSort(nextSort);
    setPage(1);
  };

  const retry = () => {
    setError('');
    setStatus('loading');
    setAttempt((value) => value + 1);
  };

  return (
    <main id="main-content" className="product-hub-page">
      <div className="hub-page-shell">
        <section className="hub-hero" aria-label="The Nishree collection">
          <div className="hub-hero-photo">
            <ResponsiveImage
              pictureClassName="hub-hero-picture"
              src={heroImage}
              responsiveKey="/assets/saree girls image.jpg"
              alt="Sarees from the Nishree collection"
              fetchPriority="high"
              decoding="async"
              width="1024"
              height="1024"
              sizes="(max-width: 600px) 100vw, (max-width: 900px) 55vw, 45vw"
            />
            <span className="hub-photo-arch" />
            <span className="hub-hero-seal"><Sparkles size={16} /> THE NISHREE<br />COLLECTION</span>
          </div>
          <div className="hub-hero-copy">
            <span className="hub-kicker">A considered edit</span>
            <h1>Tradition, <em>made for you.</em></h1>
            <p className="hub-hero-note">Explore the sarees currently available in the Nishree collection.</p>
            <Link className="hub-primary-cta" to="/new-arrivals">Discover new arrivals <ArrowRight size={16} /></Link>
            <span className="hub-hero-footnote">WOVEN WITH INTENTION · CHOSEN WITH CARE</span>
          </div>
          <span className="hub-hero-flower flower-one" aria-hidden="true">✿</span>
          <span className="hub-hero-flower flower-two" aria-hidden="true">✿</span>
        </section>

        <section className="hub-live-categories" aria-labelledby="hub-categories-title">
          <header className="hub-section-title">
            <div><span className="hub-kicker">Find your kind of weave</span><h2 id="hub-categories-title">Shop by category</h2></div>
            <p>Every category leads to pieces from the live catalogue.</p>
          </header>
          {categoryError && <p className="hub-live-error" role="alert">{categoryError}</p>}
          {categories.length > 0 ? (
            <div className="hub-category-rail" aria-label="Product categories">
              {categories.map((category, index) => (
                <button
                  type="button"
                  className={`hub-category-tile${selectedCategory === category.slug ? ' is-selected' : ''}`}
                  key={category._id || category.slug}
                  aria-pressed={selectedCategory === category.slug}
                  onClick={() => chooseCategory(category.slug)}
                >
                  <span><ResponsiveImage src={category.image?.url || categoryFallbackImages[index % categoryFallbackImages.length]} alt="" loading="lazy" decoding="async" sizes="(max-width: 600px) 132px, (max-width: 900px) 25vw, 16vw" /> </span>
                  <strong>{category.name}</strong>
                  <small>{category.productCount} {category.productCount === 1 ? 'piece' : 'pieces'} <ArrowUpRight size={11} /></small>
                </button>
              ))}
            </div>
          ) : !categoryError && status !== 'loading' ? (
            <p className="hub-live-empty">Categories will appear here when products are available.</p>
          ) : null}
        </section>
      </div>

      <section id="hub-products" className="hub-catalog">
        <div className="hub-catalog-inner">
          <header className="hub-catalog-heading">
            <div>
              <span className="hub-kicker">THE NISHREE COLLECTION</span>
              <h2>Find your new favourite.</h2>
              <p>{selectedCategory ? `Explore ${categories.find((category) => category.slug === selectedCategory)?.name || 'this category'}.` : 'Shop every product currently listed in the live collection.'}</p>
            </div>
            <Link to="/shop" className="hub-catalog-link">Explore all collections <ArrowUpRight size={15} /></Link>
          </header>
          <div className="hub-catalog-toolbar">
            <span className="hub-results-count">{pagination.total} {pagination.total === 1 ? 'product' : 'products'}</span>
            <label className="hub-sort">Sort by
              <select value={sort} onChange={(event) => changeSort(event.target.value)}>
                <option value="featured">Featured</option>
                <option value="newest">Newest</option>
                <option value="price-asc">Price: Low to High</option>
                <option value="price-desc">Price: High to Low</option>
              </select>
            </label>
          </div>

          {status === 'loading' ? (
            <LoadingState label="Gathering the live collection…" />
          ) : status === 'error' ? (
            <ErrorState message={error} onRetry={retry} />
          ) : products.length > 0 ? (
            <>
              <div className="hub-live-product-grid">
                {products.map((product, index) => <ProductCard key={product._id || product.slug} product={product} index={index} />)}
              </div>
              {pagination.totalPages > 1 && (
                <nav className="hub-live-pagination" aria-label="Product pages">
                  <button type="button" className="hub-primary-cta" disabled={page <= 1} onClick={() => changePage(page - 1)}>Previous</button>
                  <span>Page {page} of {pagination.totalPages}</span>
                  <button type="button" className="hub-primary-cta" disabled={page >= pagination.totalPages} onClick={() => changePage(page + 1)}>Next</button>
                </nav>
              )}
            </>
          ) : (
            <div className="hub-live-empty">
              <span className="hub-kicker">A pause in the edit</span>
              <h3>{selectedCategory ? 'No products are currently listed in this category.' : 'The collection is being prepared.'}</h3>
              <p>Choose another category or return to all products.</p>
              <button type="button" onClick={() => chooseCategory('')}>View all products</button>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
