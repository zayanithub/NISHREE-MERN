import { useEffect, useState } from 'react';
import { ArrowRight, ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { catalogApi } from '../api/catalogApi';
import { homepageApi } from '../api/homepageApi';
import HomeProductCarousel from '../components/home/HomeProductCarousel';
import { ErrorState, LoadingState } from '../components/States';
import { Reveal } from '../components/Reveal';
import './NewArrivalsPage.css';

const isCancelledRequest = (error, signal) => signal?.aborted
  || error?.name === 'CanceledError'
  || error?.name === 'AbortError'
  || error?.code === 'ERR_CANCELED';

const fallbackEditorial = {
  url: '/homepage-images/folded-silk.jpg',
  altText: 'Golden silk folded to show its woven border and rich colour',
};

export default function NewArrivalsPage() {
  const [products, setProducts] = useState([]);
  const [productsStatus, setProductsStatus] = useState('loading');
  const [attempt, setAttempt] = useState(0);
  const [editorial, setEditorial] = useState(fallbackEditorial);

  useEffect(() => {
    const controller = new AbortController();
    catalogApi.products({ page: 1, limit: 8, sort: 'newest' }, controller.signal)
      .then((response) => {
        if (controller.signal.aborted) return;
        setProducts(Array.isArray(response.products) ? response.products : []);
        setProductsStatus('ready');
      })
      .catch((error) => {
        if (!isCancelledRequest(error, controller.signal)) setProductsStatus('error');
      });
    return () => controller.abort();
  }, [attempt]);

  useEffect(() => {
    const controller = new AbortController();
    homepageApi.images(controller.signal)
      .then((images) => {
        if (controller.signal.aborted) return;
        const image = images.find((item) => item.section === 'editorial');
        if (image) setEditorial(image);
      })
      .catch((error) => {
        if (!isCancelledRequest(error, controller.signal)) {
          console.error('New arrivals editorial image could not be loaded:', error.message);
        }
      });
    return () => controller.abort();
  }, []);

  const retryProducts = () => {
    setProductsStatus('loading');
    setAttempt((value) => value + 1);
  };

  return (
    <main className="new-arrivals-page">
      <h1 className="sr-only">New arrivals</h1>
      <section className="new-arrivals-editorial">
        <Reveal className="new-arrivals-image">
          <img
            src={editorial.url || fallbackEditorial.url}
            alt={editorial.altText || fallbackEditorial.altText}
            loading="eager"
            decoding="async"
            width="900"
            height="900"
            onError={(event) => {
              event.currentTarget.onerror = null;
              event.currentTarget.src = fallbackEditorial.url;
            }}
          />
          <span>THE FIRST LOOK · NISHREE ATTIRE</span>
        </Reveal>

        <div className="new-arrivals-copy">
          <Reveal>
            <span className="eyebrow">The collection, as it unfolds</span>
            <h2>New pieces.<br /><em>Old soul.</em></h2>
            <p>Discover the latest additions to our collection, selected from the newest pieces available in store.</p>
            <div className="new-arrivals-hero-actions">
              <Link className="button button-primary" to="/shop?sort=newest">
                Meet the new arrivals
                <ArrowRight size={16} aria-hidden="true" />
              </Link>
              <Link className="new-arrivals-hub-link" to="/product_hub">Explore Product Hub <ArrowUpRight size={15} aria-hidden="true" /></Link>
            </div>
          </Reveal>

          {productsStatus === 'loading' ? (
            <LoadingState label="Finding the newest pieces…" compact />
          ) : productsStatus === 'error' ? (
            <ErrorState message="The newest pieces are unavailable just now." onRetry={retryProducts} />
          ) : products.length > 0 ? (
            <div className="new-arrival-list">
              {products.slice(0, 2).map((product) => (
                <Link to={`/products/${product.slug}`} key={product._id ?? product.slug} className="new-arrival-item">
                  <img
                    src={product.primaryImage?.url || fallbackEditorial.url}
                    alt={product.primaryImage?.url ? '' : fallbackEditorial.altText}
                    loading="lazy"
                    decoding="async"
                    width="96"
                    height="112"
                    onError={(event) => {
                      event.currentTarget.onerror = null;
                      event.currentTarget.src = fallbackEditorial.url;
                    }}
                  />
                  <span>
                    <small>{product.material || product.category?.name || 'NEW PIECE'}</small>
                    <strong>{product.name}</strong>
                  </span>
                  <ArrowUpRight size={17} aria-hidden="true" />
                </Link>
              ))}
            </div>
          ) : (
            <p className="quiet-note">The newest pieces will appear here as they join the collection.</p>
          )}
        </div>
      </section>

      <HomeProductCarousel
        id="new-arrivals-carousel"
        title="New arrivals"
        kicker="Just added to the collection"
        description="Meet the latest pieces selected from the live Nishree collection."
        products={products}
        status={productsStatus}
        onRetry={retryProducts}
        link="/shop?sort=newest"
        linkText="See all new arrivals"
      />
    </main>
  );
}
