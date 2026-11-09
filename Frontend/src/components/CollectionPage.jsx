import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import './CollectionExperience.css';

function CollectionBreadcrumb({ collection }) {
  return (
    <nav className="collection-breadcrumbs" aria-label="Breadcrumb">
      <Link to="/">Home</Link>
      <span aria-hidden="true">/</span>
      {collection.parent && <>
        <Link to={`/collections/${collection.parent.slug}`}>{collection.parent.name}</Link>
        <span aria-hidden="true">/</span>
      </>}
      <span aria-current="page">{collection.name}</span>
    </nav>
  );
}

function SubcategoryGrid({ categories }) {
  if (!categories?.length) return null;

  return (
    <section className="collection-subcategories" aria-labelledby="collection-subcategories-title">
      <div className="collection-section-heading">
        <span className="eyebrow">Explore the collection</span>
        <h2 id="collection-subcategories-title">Find your kind of weave</h2>
      </div>
      <div className="collection-category-grid">
        {categories.map((category) => (
          <Link className="collection-category-card" to={`/collections/${category.slug}`} key={category.slug}>
            <div className="collection-category-image">
              <img src={category.image} alt="" loading="lazy" decoding="async" width="600" height="760" />
              <span className="collection-category-arrow" aria-hidden="true"><ArrowRight size={17} /></span>
            </div>
            <span className="collection-category-name">{category.name}</span>
            <span className="collection-category-description">{category.description}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

export default function CollectionPage({ collection }) {
  if (!collection) return null;

  return (
    <div className="collection-page-intro">
      <CollectionBreadcrumb collection={collection} />
      <section className="collection-banner" aria-labelledby="collection-title">
        <img
          className="collection-banner-image"
          src={collection.bannerImage}
          alt=""
          fetchPriority="high"
          decoding="async"
          width="1800"
          height="900"
        />
        <div className="collection-banner-shade" />
        <div className="collection-banner-copy">
          <span className="eyebrow">Nishree Attire · The collection</span>
          <h1 id="collection-title">{collection.name}</h1>
          <p>{collection.description}</p>
        </div>
      </section>
      <SubcategoryGrid categories={collection.children} />
    </div>
  );
}
