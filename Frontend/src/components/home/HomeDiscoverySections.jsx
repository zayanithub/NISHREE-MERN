import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, ArrowUpRight, Camera, Star } from 'lucide-react';
import { Link } from 'react-router-dom';
import { catalogApi } from '../../api/catalogApi';
import { productImage } from '../../utils/format';
import { readRecentlyViewedSlugs } from '../../utils/recentlyViewed';
import { useStoreSettings } from '../../settings/useStoreSettings';
import HomeProductCarousel from './HomeProductCarousel';
import ResponsiveImage from '../ResponsiveImage';
import './HomeDiscoverySections.css';

const NewsletterSection = lazy(() => import('./NewsletterSection'));

const cancelled = (error, signal) => signal?.aborted
  || error?.name === 'CanceledError'
  || error?.name === 'AbortError'
  || error?.code === 'ERR_CANCELED';

function DeferredNewsletterSection() {
  const sectionRef = useRef(null);
  const [shouldLoad, setShouldLoad] = useState(() => typeof IntersectionObserver === 'undefined');

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return undefined;
    if (!('IntersectionObserver' in window)) return undefined;

    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setShouldLoad(true);
        observer.disconnect();
      }
    }, { rootMargin: '800px 0px' });
    observer.observe(section);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="home-newsletter-slot" ref={sectionRef}>
      {shouldLoad && <Suspense fallback={null}><NewsletterSection /></Suspense>}
    </div>
  );
}

function HomeSectionHeading({ kicker, title, description, link, linkText = 'Explore all' }) {
  return (
    <div className="home-discovery-heading">
      <div>
        <span className="eyebrow">{kicker}</span>
        <h2>{title}</h2>
        {description && <p>{description}</p>}
      </div>
      {link && <Link className="text-link" to={link}>{linkText}<ArrowRight size={15} aria-hidden="true" /></Link>}
    </div>
  );
}

export default function HomeDiscoverySections({ featured = [], socialImages = [] }) {
  const settings = useStoreSettings();
  const [bestSellers, setBestSellers] = useState([]);
  const [bestSellerStatus, setBestSellerStatus] = useState('loading');
  const [recentSlugs] = useState(readRecentlyViewedSlugs);
  const [recentProducts, setRecentProducts] = useState([]);
  const [recentStatus, setRecentStatus] = useState(() => recentSlugs.length ? 'loading' : 'ready');
  const [recommendations, setRecommendations] = useState([]);
  const [recommendationStatus, setRecommendationStatus] = useState('loading');
  const [reviews, setReviews] = useState([]);
  const [bestSellersAttempt, setBestSellersAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    catalogApi.bestSellers({ limit: 8 }, controller.signal)
      .then((response) => {
        if (controller.signal.aborted) return;
        setBestSellers(Array.isArray(response.products) ? response.products : []);
        setBestSellerStatus('ready');
      })
      .catch((error) => {
        if (!cancelled(error, controller.signal)) setBestSellerStatus('error');
      });
    return () => controller.abort();
  }, [bestSellersAttempt]);

  useEffect(() => {
    const controller = new AbortController();
    if (!recentSlugs.length) return () => controller.abort();

    Promise.allSettled(recentSlugs.slice(0, 6).map((slug) => catalogApi.product(slug, controller.signal)))
      .then((results) => {
        if (controller.signal.aborted) return;
        setRecentProducts(results
          .filter((result) => result.status === 'fulfilled')
          .map((result) => result.value.product)
          .filter(Boolean));
        setRecentStatus('ready');
      });
    return () => controller.abort();
  }, [recentSlugs]);

  const latestViewed = recentProducts[0];
  useEffect(() => {
    const controller = new AbortController();
    if (!latestViewed?.category?.slug) return () => controller.abort();

    catalogApi.products({ category: latestViewed.category.slug, page: 1, limit: 12, sort: 'newest' }, controller.signal)
      .then((response) => {
        if (controller.signal.aborted) return;
        const viewedIds = new Set(recentProducts.map((product) => String(product._id)));
        setRecommendations((response.products || []).filter((product) => !viewedIds.has(String(product._id))).slice(0, 8));
        setRecommendationStatus('ready');
      })
      .catch((error) => {
        if (!cancelled(error, controller.signal)) setRecommendationStatus('error');
      });
    return () => controller.abort();
  }, [latestViewed?.category?.slug, recentProducts]);

  const reviewCandidates = useMemo(() => {
    const seen = new Set();
    return [...bestSellers, ...featured]
      .filter((product) => product?.slug && Number(product.reviewSummary?.reviewCount) > 0)
      .filter((product) => {
        if (seen.has(product.slug)) return false;
        seen.add(product.slug);
        return true;
      })
      .slice(0, 4);
  }, [bestSellers, featured]);

  useEffect(() => {
    const controller = new AbortController();
    if (!reviewCandidates.length) return () => controller.abort();

    Promise.allSettled(reviewCandidates.map((product) => catalogApi.reviews(product.slug, { page: 1, limit: 2 }, controller.signal)))
      .then((results) => {
        if (controller.signal.aborted) return;
        const entries = results.flatMap((result, index) => result.status === 'fulfilled'
          ? (result.value.data?.reviews || [])
            .filter((review) => review.title || review.comment)
            .map((review) => ({ ...review, product: reviewCandidates[index] }))
          : []);
        setReviews(entries.slice(0, 6));
      });
    return () => controller.abort();
  }, [reviewCandidates]);

  const trendingCollections = useMemo(() => {
    const seen = new Set();
    return bestSellers.filter((product) => {
      const category = product.category;
      if (!category?.slug || seen.has(category.slug)) return false;
      seen.add(category.slug);
      return true;
    }).slice(0, 4);
  }, [bestSellers]);

  return (
    <>
      <HomeProductCarousel
        id="best-sellers"
        title="Best sellers"
        kicker="Chosen by our customers"
        description="A selection informed by completed paid orders and delivered cash-on-delivery orders."
        products={bestSellers}
        status={bestSellerStatus}
        onRetry={() => setBestSellersAttempt((value) => value + 1)}
        link="/shop?sort=featured"
        linkText="Explore the collection"
      />

      {trendingCollections.length > 0 && (
        <section className="home-trending-section section-shell">
          <HomeSectionHeading
            kicker="The collection in motion"
            title="Trending collections"
            description="Discover collection edits represented among our best-selling pieces."
            link="/shop"
            linkText="Browse all"
          />
          <div className="home-trending-grid">
            {trendingCollections.map((product) => (
              <Link className="home-trending-card" to={`/collections/${product.category.slug}`} key={product.category.slug}>
                <ResponsiveImage src={productImage(product)} alt={product.imageAltText || product.category.name} loading="lazy" decoding="async" width="700" height="850" sizes="(max-width: 700px) 85vw, 35vw" />
                <span className="home-trending-overlay" aria-hidden="true" />
                <span className="home-trending-copy"><small>THE NISHREE EDIT</small><strong>{product.category.name}</strong></span>
                <span className="home-trending-arrow" aria-hidden="true"><ArrowUpRight size={17} /></span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {recentProducts.length > 0 && (
        <HomeProductCarousel
          id="recently-viewed"
          title="Recently viewed"
          kicker="Pick up where you left off"
          products={recentProducts}
          status={recentStatus}
          link="/shop"
          linkText="Continue exploring"
        />
      )}

      {latestViewed?.category?.slug && (
        <HomeProductCarousel
          id="recommended-for-you"
          title="A little more to discover"
          kicker="Inspired by your browsing"
          description={`More pieces from ${latestViewed.category.name || 'the collection'} you recently explored.`}
          products={recommendations}
          status={recommendationStatus}
          link={`/collections/${latestViewed.category.slug}`}
          linkText={`Explore ${latestViewed.category.name || 'the collection'}`}
        />
      )}

      {reviewCandidates.length > 0 && reviews.length > 0 && (
        <section className="home-reviews-section section-shell" aria-labelledby="home-reviews-title">
          <HomeSectionHeading kicker="Shared with care" title="Customer notes" description="Approved reviews from customers who have shared their experience." link="/shop" linkText="Find your piece" />
          <div className="home-reviews-grid">
            {reviews.map((review) => (
              <article className="home-review-card" key={review._id}>
                <div className="home-review-stars" aria-label={`${review.rating} out of 5 stars`}>
                  {Array.from({ length: 5 }, (_, index) => <Star size={13} key={index} fill={index < review.rating ? 'currentColor' : 'none'} aria-hidden="true" />)}
                </div>
                {(review.title || review.comment) && <p>“{review.title || review.comment}”</p>}
                <footer>
                  <span>{review.user?.name || 'Nishree customer'}{review.isVerifiedPurchase ? ' · Verified purchase' : ''}</span>
                  <Link to={`/products/${review.product.slug}`}>{review.product.name}<ArrowUpRight size={13} aria-hidden="true" /></Link>
                </footer>
              </article>
            ))}
          </div>
        </section>
      )}

      {socialImages.length > 0 && (
        <section className="home-social-section section-shell" aria-labelledby="home-social-title">
          <div className="home-social-heading">
            <div><span className="eyebrow">From our world</span><h2 id="home-social-title">The Nishree edit, <em>in good company.</em></h2><p>Moments and details selected by our team.</p></div>
            {settings.instagramUrl && <a className="text-link" href={settings.instagramUrl} target="_blank" rel="noreferrer">Follow along <Camera size={15} aria-hidden="true" /></a>}
          </div>
          <div className="home-social-grid">
            {socialImages.slice(0, 6).map((image) => (
              <a href={settings.instagramUrl || '/shop'} target={settings.instagramUrl ? '_blank' : undefined} rel={settings.instagramUrl ? 'noreferrer' : undefined} key={image._id || image.url} aria-label={settings.instagramUrl ? `See ${image.title || 'Nishree Attire on Instagram'}` : image.title || 'Nishree Attire editorial image'}>
                <ResponsiveImage src={image.url} alt={image.altText || image.title || ''} loading="lazy" decoding="async" sizes="(max-width: 600px) 40vw, 16vw" />
                <span><Camera size={17} aria-hidden="true" /></span>
              </a>
            ))}
          </div>
        </section>
      )}

      <DeferredNewsletterSection />
    </>
  );
}
