import { useRef } from 'react';
import { ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import ProductCard from '../ProductCard';
import { Reveal } from '../Reveal';
import { ErrorState, SkeletonGrid } from '../States';
import useReducedMotionPreference from '../../hooks/useReducedMotionPreference';

export default function HomeProductCarousel({
  title,
  kicker,
  description,
  products = [],
  status = 'ready',
  onRetry,
  link = '/shop',
  linkText = 'View the collection',
  id,
}) {
  const trackRef = useRef(null);
  const reduceMotion = useReducedMotionPreference();
  const moveTrack = (direction) => {
    const track = trackRef.current;
    if (!track) return;
    track.scrollBy({
      left: direction * Math.max(260, track.clientWidth * 0.82),
      behavior: reduceMotion ? 'auto' : 'smooth',
    });
  };

  return (
    <Reveal
      as="section"
      id={id}
      className="home-product-carousel section-shell"
      aria-labelledby={`${id || title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-title`}
      once
      amount={0.12}
      distance={16}
      duration={0.48}
    >
      <div className="home-carousel-heading">
        <div>
          <span className="eyebrow">{kicker}</span>
          <h2 id={`${id || title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-title`}>{title}</h2>
          {description && <p>{description}</p>}
        </div>
        <div className="home-carousel-actions">
          <Link className="text-link" to={link}>{linkText}<ArrowRight size={15} aria-hidden="true" /></Link>
          <div className="home-carousel-controls" aria-label={`${title} carousel controls`}>
            <button type="button" onClick={() => moveTrack(-1)} aria-label={`Scroll ${title} left`}>
              <ChevronLeft size={18} aria-hidden="true" />
            </button>
            <button type="button" onClick={() => moveTrack(1)} aria-label={`Scroll ${title} right`}>
              <ChevronRight size={18} aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>

      {status === 'loading' ? (
        <div className="home-carousel-loading"><SkeletonGrid count={4} /></div>
      ) : status === 'error' ? (
        <ErrorState message={`We could not load ${title.toLowerCase()} right now.`} onRetry={onRetry} />
      ) : products.length ? (
        <div className="home-carousel-viewport" ref={trackRef} tabIndex={0} role="region" aria-label={`${title} products`}>
          {products.map((product, index) => (
            <Reveal
              as="div"
              className="home-carousel-product min-w-0"
              key={product._id || product.slug}
              once
              amount={0.12}
              distance={12}
              duration={0.35}
              delay={reduceMotion ? 0 : Math.min(index * 0.055, 0.22)}
            >
              <ProductCard product={product} index={index} />
            </Reveal>
          ))}
        </div>
      ) : (
        <div className="home-carousel-empty" role="status">
          <span className="eyebrow">A pause in the edit</span>
          <p>There are no pieces to show here yet. Please return soon.</p>
        </div>
      )}
    </Reveal>
  );
}
