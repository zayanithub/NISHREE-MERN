import { useEffect, useState } from 'react';
import { ArrowDownRight, ArrowRight, ArrowUpRight, Sparkles } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { catalogApi } from '../api/catalogApi';
import { formatPrice } from '../utils/format';
import ResponsiveImage from '../components/ResponsiveImage';
import '../components/home/HomeDiscoverySections.css';
import './FindYourDrapePage.css';

const isCancelledRequest = (error, signal) => signal?.aborted
  || error?.name === 'CanceledError'
  || error?.name === 'AbortError'
  || error?.code === 'ERR_CANCELED';

const toSearchHref = (key, value) => `/shop?${new URLSearchParams({ [key]: value }).toString()}`;

function priceBands(priceRange) {
  const minimum = Number(priceRange?.minimum);
  const maximum = Number(priceRange?.maximum);
  if (!Number.isFinite(minimum) || !Number.isFinite(maximum) || minimum <= 0 || maximum < minimum) return [];
  if (minimum === maximum) return [{ minimum, maximum }];
  const step = (maximum - minimum) / 3;
  return [
    { minimum, maximum: minimum + step },
    { minimum: minimum + step, maximum: minimum + step * 2 },
    { minimum: minimum + step * 2, maximum },
  ];
}

function SectionHeading({ kicker, title, description, link, linkText }) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.div
      className="home-discovery-heading find-drape-section-heading"
      initial={reduceMotion ? false : { opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.25 }}
      transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
    >
      <div>
        <span className="eyebrow">{kicker}</span>
        <h2>{title}</h2>
        {description && <p>{description}</p>}
      </div>
      {link && <Link className="text-link" to={link}>{linkText}<ArrowRight size={15} aria-hidden="true" /></Link>}
    </motion.div>
  );
}

export default function FindYourDrapePage() {
  const reduceMotion = useReducedMotion();
  const [facets, setFacets] = useState(null);
  const [facetsStatus, setFacetsStatus] = useState('loading');
  const [facetsAttempt, setFacetsAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    catalogApi.facets(controller.signal)
      .then((response) => {
        if (controller.signal.aborted) return;
        setFacets(response.facets || null);
        setFacetsStatus('ready');
      })
      .catch((error) => {
        if (!isCancelledRequest(error, controller.signal)) setFacetsStatus('error');
      });
    return () => controller.abort();
  }, [facetsAttempt]);

  const materials = facets?.materials || [];
  const occasions = facets?.occasions || [];
  const bands = priceBands(facets?.priceRange);
  const itemReveal = reduceMotion
    ? {}
    : {
      initial: { opacity: 0, y: 18 },
      whileInView: { opacity: 1, y: 0 },
      viewport: { once: true, amount: 0.16 },
      transition: { duration: 0.48, ease: [0.22, 1, 0.36, 1] },
    };

  const renderFacetState = (label, content) => {
    if (facetsStatus === 'loading') {
      return <div className="home-discovery-loading" role="status">Finding the collection’s {label}…</div>;
    }
    if (facetsStatus === 'error') {
      return (
        <div className="home-discovery-retry" role="alert">
          <span>{label} could not be loaded.</span>
          <button type="button" onClick={() => {
            setFacetsStatus('loading');
            setFacetsAttempt((value) => value + 1);
          }}>Try again</button>
        </div>
      );
    }
    return content;
  };

  return (
    <main className="find-your-drape-page">
      <header className="find-your-drape-intro">
        <motion.div
          className="find-drape-hero-copy"
          initial={reduceMotion ? false : { opacity: 0, x: -24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: .7, ease: [0.22, 1, 0.36, 1] }}
        >
          <span className="eyebrow"><Sparkles size={13} aria-hidden="true" /> Your personal collection edit</span>
          <h1>Find the drape<br />that feels <em>like you.</em></h1>
          <p>Start with a texture, follow a feeling, or find a piece for the moment you have in mind.</p>
          <div className="find-drape-hero-actions">
            <Link className="find-drape-primary-link" to="/product_hub">Explore Product Hub <ArrowRight size={15} aria-hidden="true" /></Link>
            <Link className="find-drape-secondary-link" to="/shop">Shop all sarees <ArrowUpRight size={15} aria-hidden="true" /></Link>
          </div>
          <nav className="find-drape-shortcuts" aria-label="Explore the collection">
            <a href="#drape-weaves"><span>01</span> By fabric <ArrowDownRight size={14} aria-hidden="true" /></a>
            <a href="#drape-occasions"><span>02</span> By occasion <ArrowDownRight size={14} aria-hidden="true" /></a>
            <a href="#drape-price"><span>03</span> By price <ArrowDownRight size={14} aria-hidden="true" /></a>
          </nav>
        </motion.div>
        <motion.div
          className="find-drape-hero-art"
          initial={reduceMotion ? false : { opacity: 0, scale: .96, x: 18 }}
          animate={{ opacity: 1, scale: 1, x: 0 }}
          transition={{ duration: .85, delay: .12, ease: [0.22, 1, 0.36, 1] }}
        >
          <ResponsiveImage src="/homepage-images/drape-detail.jpg" alt="A close detail of a saree's intricate woven border" width="1856" height="2304" sizes="(max-width: 800px) 100vw, 45vw" fetchPriority="high" />
          <span className="find-drape-art-label"><i aria-hidden="true" /> THE NISHREE EDIT <b>·</b> 01</span>
          <span className="find-drape-art-caption">Every thread,<br /><em>chosen with feeling.</em></span>
        </motion.div>
        <span className="find-drape-hero-index" aria-hidden="true">NISHREE ATTIRE <i /> COLLECTION GUIDE</span>
      </header>

      <motion.section id="drape-weaves" className="home-weaves-section find-drape-section find-drape-weaves" {...itemReveal}>
        <div className="section-shell">
          <SectionHeading
            kicker="A language of texture"
            title={<>Begin with a <em>feeling.</em></>}
            description="Explore the materials that give every drape its own character."
            link="/shop"
            linkText="All fabrics"
          />
          {renderFacetState('fabrics', materials.length ? (
            <div className="home-weave-grid find-drape-material-grid">
              {materials.map((material, index) => (
                <motion.div key={material} {...itemReveal} transition={{ ...itemReveal.transition, delay: reduceMotion ? 0 : Math.min(index * .045, .27) }}>
                  <Link className="home-weave-link" to={toSearchHref('material', material)}>
                    <span className="home-weave-number">{String(index + 1).padStart(2, '0')}</span>
                    <span>{material}</span>
                    <ArrowUpRight size={16} aria-hidden="true" />
                  </Link>
                </motion.div>
              ))}
            </div>
          ) : <div className="home-discovery-empty">Fabric edits will appear here as products are added to the collection.</div>)}
        </div>
      </motion.section>

      <motion.section id="drape-occasions" className="home-occasion-section find-drape-section find-drape-occasions" {...itemReveal}>
        <div className="section-shell">
          <SectionHeading
            kicker="For every chapter"
            title={<>Dress for the <em>moment.</em></>}
            description="Find a considered drape for the moments that matter to you."
            link="/shop"
            linkText="See every piece"
          />
          {renderFacetState('occasion edits', occasions.length ? (
            <div className="home-occasion-grid find-drape-occasion-grid">
              {occasions.map((occasion, index) => (
                <motion.div key={occasion} {...itemReveal} transition={{ ...itemReveal.transition, delay: reduceMotion ? 0 : Math.min(index * .04, .24) }}>
                  <Link to={toSearchHref('occasion', occasion)} className="home-occasion-link">
                    <small>{String(index + 1).padStart(2, '0')}</small>
                    <span>{occasion}</span><ArrowUpRight size={15} aria-hidden="true" />
                  </Link>
                </motion.div>
              ))}
            </div>
          ) : <div className="home-discovery-empty">Occasion edits will appear here as products are added to the collection.</div>)}
        </div>
      </motion.section>

      <motion.section id="drape-price" className="home-price-section find-drape-section find-drape-prices" {...itemReveal}>
        <div className="section-shell">
          <SectionHeading
            kicker="A thoughtful place to begin"
            title={<>A little something<br /><em>within reach.</em></>}
            description="Browse current pieces within a range drawn from the live collection."
            link="/shop"
            linkText="View all prices"
          />
          {renderFacetState('price range', bands.length ? (
            <div className="home-price-grid find-drape-price-grid">
              {bands.map((band, index) => {
                const params = new URLSearchParams({ minPrice: String(Math.floor(band.minimum)), maxPrice: String(Math.ceil(band.maximum)) });
                return (
                  <motion.div key={`${band.minimum}-${band.maximum}`} {...itemReveal} transition={{ ...itemReveal.transition, delay: reduceMotion ? 0 : index * .1 }}>
                    <Link to={`/shop?${params.toString()}`} className="home-price-card">
                      <span className="home-price-index">0{index + 1}</span>
                      <span className="home-price-label">{formatPrice(band.minimum)} <i aria-hidden="true">—</i> {formatPrice(band.maximum)}</span>
                      <span className="home-price-cta">Explore this range <ArrowUpRight size={15} aria-hidden="true" /></span>
                    </Link>
                  </motion.div>
                );
              })}
            </div>
          ) : <div className="home-discovery-empty">Price edits will appear when the collection has priced pieces.</div>)}
        </div>
      </motion.section>
      <motion.footer className="find-drape-closing" {...itemReveal}>
        <span className="eyebrow">The Nishree collection</span>
        <p>Somewhere in the details,<br /><em>there is one that is yours.</em></p>
        <Link to="/shop" className="button button-primary">Explore all sarees <ArrowRight size={15} aria-hidden="true" /></Link>
      </motion.footer>
    </main>
  );
}
