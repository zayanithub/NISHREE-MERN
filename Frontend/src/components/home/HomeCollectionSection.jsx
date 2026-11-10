import { ArrowRight, ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Reveal } from '../Reveal';
import ResponsiveImage from '../ResponsiveImage';
import { ErrorState, LoadingState } from '../States';

export default function HomeCollectionSection({
  categories,
  categoryImages,
  categoryStatus,
  onRetry,
}) {
  return (
    <section className="section-shell collection-intro" id="collection">
      <Reveal className="section-heading-row">
        <div>
          <span className="eyebrow">A world of colour &amp; character</span>
          <h2>
            Find your <em>kind</em> of beautiful.
          </h2>
          <p className="section-deck">
            Explore the collection through the stories and traditions that
            inspire each edit.
          </p>
        </div>
        <Link className="text-link" to="/shop">
          View all sarees
          <ArrowRight size={15} aria-hidden="true" />
        </Link>
      </Reveal>

      {categoryStatus === 'loading' ? (
        <LoadingState label="Opening the collection…" />
      ) : categoryStatus === 'error' ? (
        <ErrorState
          message="We could not load the collection categories."
          onRetry={onRetry}
        />
      ) : categories.length > 0 ? (
        <div className="category-grid">
          {categories.map((category, index) => (
            <Reveal
              key={category._id ?? category.slug}
              delay={index * 0.07}
              className={`category-card category-card-${index + 1}`}
            >
              <Link
                to={`/collections/${category.slug}`}
                aria-label={`Explore ${category.name}`}
              >
                <ResponsiveImage
                  src={category.image?.url || categoryImages[index % categoryImages.length]?.url || categoryImages[index % categoryImages.length]}
                  alt={category.image?.url ? '' : categoryImages[index % categoryImages.length]?.altText || ''}
                  sizes="(max-width: 800px) 45vw, 25vw"
                  loading="lazy"
                  decoding="async"
                  width="720"
                  height="880"
                />
                <span className="category-scrim" aria-hidden="true" />
                <span className="category-copy">
                  <small>THE NISHREE COLLECTION</small>
                  <strong>{category.name}</strong>
                  <span>
                    {category.description || 'A considered edit from Nishree Attire.'}
                  </span>
                </span>
                <span className="category-arrow" aria-hidden="true">
                  <ArrowUpRight size={18} />
                </span>
              </Link>
            </Reveal>
          ))}
        </div>
      ) : (
        <div className="category-empty">
          <p>
            Our collection is being prepared. Browse all available pieces in
            the shop.
          </p>
          <Link className="text-link" to="/shop">
            Visit the shop
            <ArrowRight size={15} aria-hidden="true" />
          </Link>
        </div>
      )}
    </section>
  );
}
