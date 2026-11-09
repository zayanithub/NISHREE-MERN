import { useMemo, useState } from 'react';
import { ArrowRight, ArrowUp, ArrowUpRight, ChevronDown, Heart, SlidersHorizontal, Sparkles, Star, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import heroDuo from '../assets/saree girls image.jpg';
import showroomMaroon from '../assets/saree girl image.jpg';
import blueEditorial from '../assets/saree design girl 1.jpg';
import tealEditorial from '../assets/saree design girl 2.jpg';
import blueSeated from '../assets/saree design girl 3.jpg';
import redSeated from '../assets/saree design girl 4.jpg';
import festiveShowroom from '../assets/saree design girl.jpg';
import redBridal from '../assets/saree design girl 5.webp';
import redGarden from '../assets/saree design girl 6.webp';
import fireworksRed from '../assets/Regal Red Saree Fireworks Gala.png';
import palaceBlue from '../assets/Royal Blue and Ivory Palace Wedding Editorial.png';
import diwaliGold from '../assets/Regal Diwali Palace Portrait.png';
import blushArch from '../assets/Regal Blush Saree in a Floral Arch.png';
import './ProductHubPage.css';

const departments = ['Women’s Clothing', 'Ethnic Wear', 'Dresses', 'Kurtas', 'Sarees', 'Traditional Sets'];
const sizes = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
const brands = ['Nishree Edit', 'Aangan', 'House of Gulabi', 'Saanvi'];
const discounts = [10, 20, 30, 50, 70];
const MAX_PRICE = 18000;

const products = [
  { id: 'ruby-heirloom', slug: 'rosewood-zari-festive-saree', name: 'Rosewood Zari Festive Saree', category: 'Sarees', brand: 'Nishree Edit', price: 10791, original: 11990, discount: 10, rating: 4.8, reviews: 124, image: showroomMaroon, shade: 'Ruby', sizes: ['S', 'M', 'L'], available: true },
  { id: 'blue-ikat', slug: 'sambalpuri-blue-ikat-saree', name: 'Sambalpuri Blue Ikat Saree', category: 'Sarees', brand: 'Aangan', price: 3890, original: 4890, discount: 20, rating: 4.6, reviews: 86, image: blueEditorial, shade: 'Blue', sizes: ['XS', 'S', 'M', 'XL'], available: true },
  { id: 'teal-zari', slug: 'peacock-teal-banarasi-pallu-saree', name: 'Peacock Teal Banarasi Pallu Saree', category: 'Sarees', brand: 'House of Gulabi', price: 6290, original: 7990, discount: 21, rating: 4.5, reviews: 52, image: tealEditorial, shade: 'Teal', sizes: ['S', 'M', 'L', 'XL'], available: true },
  { id: 'sapphire-silk', slug: 'kanchipuram-lotus-weave-silk-saree', name: 'Kanchipuram Lotus Weave Silk Saree', category: 'Sarees', brand: 'Nishree Edit', price: 8490, original: 9990, discount: 15, rating: 4.7, reviews: 93, image: blueSeated, shade: 'Blue', sizes: ['M', 'L', 'XL', 'XXL'], available: true },
  { id: 'red-temple', slug: 'red-gold-temple-border-kanchipuram', name: 'Red Gold Temple Border Kanchipuram', category: 'Sarees', brand: 'Saanvi', price: 13491, original: 14990, discount: 10, rating: 4.9, reviews: 208, image: redSeated, shade: 'Red', sizes: ['S', 'M', 'L'], available: true },
  { id: 'marigold-edit', slug: 'soft-silk-marigold-woven-saree', name: 'Soft Silk Marigold Woven Saree', category: 'Sarees', brand: 'Aangan', price: 5790, original: 6990, discount: 17, rating: 4.4, reviews: 48, image: festiveShowroom, shade: 'Gold', sizes: ['XS', 'S', 'M', 'L'], available: true },
  { id: 'bridal-red', slug: 'kanchipuram-bridal-lotus-saree', name: 'Kanchipuram Bridal Lotus Saree', category: 'Traditional Sets', brand: 'Nishree Edit', price: 16191, original: 17990, discount: 10, rating: 4.9, reviews: 163, image: redBridal, shade: 'Red', sizes: ['M', 'L', 'XL'], available: true },
  { id: 'garden-red', slug: 'crimson-boutique-georgette-saree', name: 'Crimson Boutique Georgette Saree', category: 'Ethnic Wear', brand: 'House of Gulabi', price: 6290, original: 7990, discount: 21, rating: 4.6, reviews: 72, image: redGarden, shade: 'Red', sizes: ['S', 'M', 'L', 'XL'], available: true },
  { id: 'firework-edit', slug: 'kanchipuram-red-gold-brocade-saree', name: 'Kanchipuram Red Gold Brocade Saree', category: 'Dresses', brand: 'Saanvi', price: 7490, original: 9990, discount: 25, rating: 4.3, reviews: 41, image: fireworksRed, shade: 'Red', sizes: ['XS', 'S', 'M', 'L'], available: true },
  { id: 'palace-blue', slug: 'timeless-kanchipuram-peacock-saree', name: 'Timeless Kanchipuram Peacock Saree', category: 'Ethnic Wear', brand: 'Aangan', price: 8990, original: 11990, discount: 25, rating: 4.7, reviews: 117, image: palaceBlue, shade: 'Blue', sizes: ['S', 'M', 'L', 'XL'], available: true },
  { id: 'diwali-gold', slug: 'kanchipuram-bridal-mango-silk-saree', name: 'Kanchipuram Bridal Mango Silk Saree', category: 'Traditional Sets', brand: 'Nishree Edit', price: 11990, original: 14990, discount: 20, rating: 4.8, reviews: 91, image: diwaliGold, shade: 'Gold', sizes: ['M', 'L', 'XL'], available: true },
  { id: 'blush-arch', slug: 'kota-doria-sky-check-saree', name: 'Kota Doria Sky-Check Saree', category: 'Women’s Clothing', brand: 'Saanvi', price: 6990, original: 8990, discount: 22, rating: 4.5, reviews: 64, image: blushArch, shade: 'Blush', sizes: ['XS', 'S', 'M', 'L', 'XXL'], available: true },
];

const categories = [
  { name: 'Kurtas Sets', image: tealEditorial, filter: 'Kurtas' },
  { name: 'Denim', image: blueEditorial, filter: 'Women’s Clothing' },
  { name: 'Festive Wear', image: redBridal, filter: 'Ethnic Wear' },
  { name: 'Sarees', image: showroomMaroon, filter: 'Sarees' },
  { name: 'Workwear', image: blueSeated, filter: 'Dresses' },
  { name: 'Sleepwear', image: blushArch, filter: 'Traditional Sets' },
];

const brandDeals = [
  { brand: 'Aangan', deal: 'Min. 70% off', image: redGarden, tone: 'rose' },
  { brand: 'Nishree Edit', deal: 'Extra 5% off', image: palaceBlue, tone: 'cream' },
  { brand: 'House of Gulabi', deal: 'Styles under ₹599', image: tealEditorial, tone: 'lilac' },
  { brand: 'Saanvi', deal: 'Up to 60% off', image: diwaliGold, tone: 'gold' },
  { brand: 'The Festive Edit', deal: 'Big day, big deals', image: redBridal, tone: 'pink' },
  { brand: 'Everyday Ethnic', deal: 'Fresh finds from ₹799', image: blueSeated, tone: 'peach' },
];

const spotlights = [
  { label: 'Min. 70% off', sub: 'Festive favourites', image: redBridal, brand: 'The Celebration Edit' },
  { label: 'Min. 60% off', sub: 'The silk story', image: diwaliGold, brand: 'Nishree Classics' },
  { label: 'Under ₹599', sub: 'Little lovely finds', image: tealEditorial, brand: 'Everyday Edit' },
  { label: 'Best deals', sub: 'Colour made for you', image: blueSeated, brand: 'House of Gulabi' },
];

const extraDeals = [
  { brand: 'Aangan', deal: 'Up to 70% off', image: blueEditorial },
  { brand: 'Saanvi Studio', deal: 'Min. 50% off', image: redSeated },
  { brand: 'The Silk Edit', deal: 'From ₹1,299', image: showroomMaroon },
  { brand: 'Nishree Finds', deal: 'New deals daily', image: blushArch },
];

const specialCollections = [
  { title: 'The festive wardrobe', note: 'Up to 70% off', image: redBridal, color: 'coral' },
  { title: 'Colour, considered', note: 'Styles from ₹899', image: palaceBlue, color: 'amber' },
  { title: 'A little more zari', note: 'Extra 5% off', image: diwaliGold, color: 'pink' },
  { title: 'Softly in bloom', note: 'Min. 50% off', image: blushArch, color: 'tangerine' },
  { title: 'Tradition, renewed', note: 'Deals from ₹1,499', image: showroomMaroon, color: 'rose' },
  { title: 'The occasion edit', note: 'Up to 60% off', image: blueSeated, color: 'gold' },
];

function scrollToCatalog() {
  document.getElementById('hub-products')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function ProductTile({ product, compact = false }) {
  const [saved, setSaved] = useState(false);
  return (
    <article className={`hub-product-card${compact ? ' is-compact' : ''}`}>
      <div className="hub-product-image">
        <Link to={`/products/${product.slug}`} aria-label={`View ${product.name}`}>
          <img src={product.image} alt={product.name} loading="lazy" decoding="async" />
        </Link>
        <span className="hub-discount-badge">{product.discount}% OFF</span>
        <button type="button" className={`hub-favorite${saved ? ' is-saved' : ''}`} onClick={() => setSaved((value) => !value)} aria-label={saved ? `Remove ${product.name} from saved pieces` : `Save ${product.name}`} aria-pressed={saved}>
          <Heart size={16} fill={saved ? 'currentColor' : 'none'} aria-hidden="true" />
        </button>
      </div>
      <div className="hub-product-info">
        <span className="hub-product-brand">{product.brand}</span>
        <Link to={`/products/${product.slug}`} className="hub-product-name">{product.name}</Link>
        <div className="hub-product-price"><strong>₹{product.price.toLocaleString('en-IN')}</strong><del>₹{product.original.toLocaleString('en-IN')}</del><span>{product.discount}% off</span></div>
        <div className="hub-product-rating"><Star size={12} fill="currentColor" aria-hidden="true" /> {product.rating} <span>({product.reviews})</span></div>
        <div className="hub-product-swatches" aria-label={`${product.shade} colour option`}><i style={{ backgroundColor: product.shade.toLowerCase() }} /><i style={{ backgroundColor: '#c4a26a' }} /><i style={{ backgroundColor: '#264c45' }} /></div>
      </div>
    </article>
  );
}

function PromoDealCard({ deal }) {
  return (
    <button className={`hub-deal-card tone-${deal.tone || 'rose'}`} type="button" onClick={scrollToCatalog}>
      <img src={deal.image} alt="" loading="lazy" decoding="async" />
      <span className="hub-deal-copy"><strong>{deal.brand}</strong><b>{deal.deal}</b><small>DISCOVER THE EDIT <ArrowUpRight size={11} aria-hidden="true" /></small></span>
    </button>
  );
}

function SectionTitle({ kicker, title, note, light = false, headingId }) {
  return <header className={`hub-section-title${light ? ' is-light' : ''}`}><div><span className="hub-kicker">{kicker}</span><h2 id={headingId}>{title}</h2></div>{note && <p>{note}</p>}</header>;
}

function FilterHeading({ children }) {
  return <h3 className="hub-filter-heading">{children}<ChevronDown size={14} aria-hidden="true" /></h3>;
}

function ProductFilters({ state, update, mobileOpen, closeMobile }) {
  const toggleArrayValue = (key, value) => update((current) => ({ ...current, [key]: current[key].includes(value) ? current[key].filter((item) => item !== value) : [...current[key], value] }));
  return (
    <>
      {mobileOpen && <button className="hub-filter-backdrop" type="button" onClick={closeMobile} aria-label="Close filters" />}
      <aside className={`hub-filters${mobileOpen ? ' is-open' : ''}`} aria-label="Product filters">
        <div className="hub-filter-top"><strong>Filters</strong><button type="button" onClick={closeMobile} aria-label="Close filters"><X size={18} /></button></div>
        <section className="hub-filter-group"><FilterHeading>Department / Category</FilterHeading>{departments.map((item) => <label className="hub-check" key={item}><input type="radio" name="hub-department" checked={state.department === item} onChange={() => update((current) => ({ ...current, department: item }))} /><span>{item}</span></label>)}</section>
        <section className="hub-filter-group"><FilterHeading>Customer reviews</FilterHeading>{[4, 3, 2].map((rating) => <label className="hub-check hub-review-check" key={rating}><input type="radio" name="hub-rating" checked={state.rating === rating} onChange={() => update((current) => ({ ...current, rating }))} /><span><b>{rating}+ <Star size={11} fill="currentColor" /></b> & above</span></label>)}</section>
        <section className="hub-filter-group"><FilterHeading>Price · ₹{state.minPrice.toLocaleString('en-IN')} – ₹{state.maxPrice.toLocaleString('en-IN')}</FilterHeading>
          <div className="hub-price-inputs"><label>Min<input type="number" min="0" max={state.maxPrice} value={state.minPrice} onChange={(event) => update((current) => ({ ...current, minPrice: Math.min(Number(event.target.value) || 0, current.maxPrice) }))} /></label><span>—</span><label>Max<input type="number" min={state.minPrice} max={MAX_PRICE} value={state.maxPrice} onChange={(event) => update((current) => ({ ...current, maxPrice: Math.max(Number(event.target.value) || 0, current.minPrice) }))} /></label></div>
          <div className="hub-range-controls"><input aria-label="Minimum price" type="range" min="0" max={MAX_PRICE - 100} step="250" value={state.minPrice} onChange={(event) => update((current) => ({ ...current, minPrice: Math.min(Number(event.target.value), current.maxPrice) }))} /><input aria-label="Maximum price" type="range" min="250" max={MAX_PRICE} step="250" value={state.maxPrice} onChange={(event) => update((current) => ({ ...current, maxPrice: Math.max(Number(event.target.value), current.minPrice) }))} /></div>
        </section>
        <section className="hub-filter-group"><FilterHeading>Size</FilterHeading><div className="hub-size-options">{sizes.map((size) => <button type="button" key={size} className={state.sizes.includes(size) ? 'is-selected' : ''} aria-pressed={state.sizes.includes(size)} onClick={() => toggleArrayValue('sizes', size)}>{size}</button>)}</div></section>
        <section className="hub-filter-group"><FilterHeading>Brand</FilterHeading>{brands.map((brand) => <label className="hub-check" key={brand}><input type="checkbox" checked={state.brands.includes(brand)} onChange={() => toggleArrayValue('brands', brand)} /><span>{brand}</span></label>)}</section>
        <section className="hub-filter-group"><FilterHeading>Discount</FilterHeading>{discounts.map((discount) => <label className="hub-check" key={discount}><input type="radio" name="hub-discount" checked={state.discount === discount} onChange={() => update((current) => ({ ...current, discount }))} /><span>{discount}% off or more</span></label>)}</section>
        <section className="hub-filter-group"><FilterHeading>Availability</FilterHeading><label className="hub-check"><input type="checkbox" checked={state.availableOnly} onChange={(event) => update((current) => ({ ...current, availableOnly: event.target.checked }))} /><span>In stock and ready to ship</span></label></section>
        <button className="hub-clear-filters" type="button" onClick={() => update({ department: '', rating: 0, minPrice: 0, maxPrice: MAX_PRICE, sizes: [], brands: [], discount: 0, availableOnly: false })}>Clear all filters</button>
      </aside>
    </>
  );
}

export default function ProductHubPage() {
  const [slide, setSlide] = useState(0);
  const [filterOpen, setFilterOpen] = useState(false);
  const [sort, setSort] = useState('featured');
  const [filters, setFilters] = useState({ department: '', rating: 0, minPrice: 0, maxPrice: MAX_PRICE, sizes: [], brands: [], discount: 0, availableOnly: false });

  const slides = [
    { image: heroDuo, kicker: 'THE GRAND FESTIVE EDIT', title: 'Min. 70% Off', extra: '+ Extra 5% off', note: 'Trendy ethnic wear', cta: 'Shop the celebration' },
    { image: fireworksRed, kicker: 'A LITTLE MORE MAGIC', title: 'Big festive energy', extra: 'Up to 60% off', note: 'Looks for every invitation', cta: 'Find your festive look' },
    { image: festiveShowroom, kicker: 'MADE FOR THE MOMENT', title: 'New season, new drapes', extra: 'Styles from ₹599', note: 'The occasion edit is here', cta: 'Explore the new edit' },
  ];
  const currentSlide = slides[slide];

  const visibleProducts = useMemo(() => {
    const filtered = products.filter((product) => (
      (!filters.department || product.category === filters.department) &&
      (!filters.rating || product.rating >= filters.rating) &&
      product.price >= filters.minPrice && product.price <= filters.maxPrice &&
      (!filters.sizes.length || filters.sizes.some((size) => product.sizes.includes(size))) &&
      (!filters.brands.length || filters.brands.includes(product.brand)) &&
      (!filters.discount || product.discount >= filters.discount) &&
      (!filters.availableOnly || product.available)
    ));
    if (sort === 'price-low') filtered.sort((a, b) => a.price - b.price);
    if (sort === 'price-high') filtered.sort((a, b) => b.price - a.price);
    if (sort === 'discount') filtered.sort((a, b) => b.discount - a.discount);
    if (sort === 'rating') filtered.sort((a, b) => b.rating - a.rating);
    return filtered;
  }, [filters, sort]);

  const chooseDepartment = (department) => {
    setFilters((current) => ({ ...current, department }));
    scrollToCatalog();
  };

  return (
    <main id="main-content" className="product-hub-page">
      <div className="hub-page-shell">
        <section className="hub-hero" aria-label="Festive fashion sale">
          <div className="hub-hero-photo"><img src={currentSlide.image} alt="Women dressed in traditional Indian festive wear" fetchPriority="high" /><span className="hub-photo-arch" /><span className="hub-hero-seal"><Sparkles size={16} /> THE FESTIVE<br />SEASON EDIT</span></div>
          <div className="hub-hero-copy"><span className="hub-kicker">{currentSlide.kicker}</span><h1>{currentSlide.title}</h1><p className="hub-hero-extra">{currentSlide.extra}</p><p className="hub-hero-note">{currentSlide.note}</p><button className="hub-primary-cta" type="button" onClick={scrollToCatalog}>{currentSlide.cta}<ArrowRight size={16} /></button><span className="hub-hero-footnote">CELEBRATE IN COLOUR · DRESS UP IN JOY</span></div>
          <span className="hub-hero-flower flower-one" aria-hidden="true">✿</span><span className="hub-hero-flower flower-two" aria-hidden="true">✿</span>
        </section>
        <div className="hub-hero-pagination" aria-label="Promotional slides">{slides.map((item, index) => <button type="button" key={item.kicker} className={index === slide ? 'is-active' : ''} aria-label={`Show promotional slide ${index + 1}`} aria-pressed={index === slide} onClick={() => setSlide(index)} />)}</div>
        <p className="hub-preview-note">Promotional offers and catalogue prices shown here are illustrative design previews.</p>

        <section className="hub-festival section-red" aria-labelledby="hub-festival-title">
          <div className="hub-inner">
            <SectionTitle kicker="A celebration of colour" title="Mega Festival Deals" note="A little something lovely for every kind of plan." light headingId="hub-festival-title" />
            <div className="hub-category-rail" aria-label="Shop festive categories">{categories.map((category) => <button type="button" className="hub-category-tile" key={category.name} onClick={() => chooseDepartment(category.filter)}><span><img src={category.image} alt="" loading="lazy" /></span><strong>{category.name}</strong><small>Shop the edit <ArrowUpRight size={11} /></small></button>)}</div>
            <div className="hub-deal-grid">{brandDeals.map((deal) => <PromoDealCard deal={deal} key={deal.brand} />)}</div>
          </div>
        </section>

        <section className="hub-spotlight section-crimson">
          <div className="hub-inner">
            <SectionTitle kicker="Your front-row seat to the good stuff" title="Spotlight Steals" note="Biggest savings on the biggest brands" light />
            <div className="hub-spotlight-rail">{spotlights.map((item) => <button className="hub-spotlight-card" key={item.label} type="button" onClick={scrollToCatalog}><img src={item.image} alt="" loading="lazy" /><span className="hub-spotlight-overlay"><b>{item.label}</b><small>{item.sub}</small></span><strong>{item.brand}</strong></button>)}</div>
            <div className="hub-mini-deals">{extraDeals.map((deal) => <PromoDealCard deal={{ ...deal, tone: 'rose' }} key={deal.brand} />)}</div>
          </div>
        </section>

        <section className="hub-save-banner" aria-label="Buy more, save more"><span className="hub-save-ornament" aria-hidden="true">✿</span><span className="hub-kicker">A LITTLE EXTRA JOY</span><h2>Buy more, save more</h2><p>More moments. More colour. More reasons to celebrate.</p><span className="hub-save-ornament" aria-hidden="true">✿</span></section>

        <section className="hub-ethnic section-red">
          <div className="hub-inner"><SectionTitle kicker="Made for your kind of occasion" title="Ethnic edit" note="Find a favourite for every celebration." light /><div className="hub-ethnic-rail">{products.slice(0, 6).map((product) => <ProductTile key={product.id} product={product} compact />)}</div></div>
        </section>

        <section className="hub-hot">
          <div className="hub-gold-heading"><span className="hub-kicker">THE NEW-SEASON LINE-UP</span><h2>Hot styles, hotter deals</h2><p>Good things, gathered in one place.</p></div>
          <div className="hub-inner"><div className="hub-hot-rail">{products.slice(3, 9).map((product, index) => <button className="hub-hot-card" key={product.id} type="button" onClick={scrollToCatalog}><img src={product.image} alt="" loading="lazy" /><span>{index % 2 === 0 ? 'FESTIVE FIND' : 'STYLE STEAL'}</span><strong>{product.discount}% OFF</strong></button>)}</div><div className="hub-mini-deals hub-hot-deals">{brandDeals.slice(0, 4).map((deal) => <PromoDealCard deal={deal} key={deal.brand} />)}</div></div>
        </section>

        <section className="hub-special section-orange">
          <div className="hub-inner"><SectionTitle kicker="Good style, even better finds" title="Special fashion deals" note="A colourful little shortcut to your next favourite." light /><div className="hub-special-grid">{specialCollections.map((collection) => <button className={`hub-special-card tone-${collection.color}`} key={collection.title} type="button" onClick={scrollToCatalog}><img src={collection.image} alt="" loading="lazy" /><span><small>THE SPECIAL EDIT</small><strong>{collection.title}</strong><b>{collection.note}</b></span></button>)}</div><div className="hub-pink-deals">{extraDeals.map((deal) => <PromoDealCard deal={{ ...deal, tone: 'rose' }} key={deal.brand} />)}</div></div>
        </section>

        <section className="hub-clearance section-crimson">
          <div className="hub-inner"><SectionTitle kicker="One last reason to look" title="Clearance deals" note="A final flourish to the collection." light /><div className="hub-clearance-grid">{[80, 70, 60].map((discount, index) => <button className="hub-clearance-tile" type="button" key={discount} onClick={() => { setFilters((current) => ({ ...current, discount })); scrollToCatalog(); }}><span>THE LAST-CALL EDIT</span><strong>Min. <b>{discount}%</b> Off</strong><small>{['A few favourites left', 'Finishing touches', 'Lovely finds, for less'][index]}</small><ArrowUpRight size={18} /></button>)}</div></div>
        </section>
      </div>

      <section id="hub-products" className="hub-catalog">
        <div className="hub-catalog-inner">
          <header className="hub-catalog-heading"><div><span className="hub-kicker">THE NISHREE COLLECTION · PREVIEW EDIT</span><h2>Find your new favourite.</h2><p>Fashion finds for celebrations, traditions and the everyday in between.</p></div><Link to="/shop" className="hub-catalog-link">Explore the live collection <ArrowUpRight size={15} /></Link></header>
          <div className="hub-catalog-toolbar"><button className="hub-mobile-filter-trigger" type="button" onClick={() => setFilterOpen(true)}><SlidersHorizontal size={15} /> Filters <span>{[filters.department, filters.rating, filters.sizes.length, filters.brands.length, filters.discount, filters.availableOnly].filter(Boolean).length}</span></button><span className="hub-results-count">{visibleProducts.length} preview styles</span><label className="hub-sort">Sort by <select value={sort} onChange={(event) => setSort(event.target.value)}><option value="featured">Featured</option><option value="price-low">Price: Low to High</option><option value="price-high">Price: High to Low</option><option value="discount">Discount</option><option value="rating">Top rated</option></select></label></div>
          <div className="hub-catalog-layout"><ProductFilters state={filters} update={setFilters} mobileOpen={filterOpen} closeMobile={() => setFilterOpen(false)} /><div className="hub-products-area">{visibleProducts.length ? <div className="hub-product-grid">{visibleProducts.map((product) => <ProductTile key={product.id} product={product} />)}</div> : <div className="hub-empty"><span className="hub-kicker">A fresh page</span><h3>No styles in this edit just yet.</h3><p>Try changing a filter to discover more from this preview.</p><button type="button" onClick={() => setFilters({ department: '', rating: 0, minPrice: 0, maxPrice: MAX_PRICE, sizes: [], brands: [], discount: 0, availableOnly: false })}>Clear all filters</button></div>}</div></div>
          <p className="hub-catalog-disclaimer">Product images, names, prices, ratings, stock and promotional details are illustrative previews only and do not represent verified inventory.</p>
        </div>
      </section>
      <a className="hub-back-top" href="#main-content" aria-label="Back to top"><ArrowUp size={16} /></a>
    </main>
  );
}
