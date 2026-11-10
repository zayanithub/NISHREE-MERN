import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  Flower2,
  HeartHandshake,
  MoveUpRight,
  Pause,
  Play,
} from "lucide-react";
import { Link } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

import { catalogApi } from "../api/catalogApi";
import { homepageApi } from "../api/homepageApi";
import { Reveal } from "../components/Reveal";
import ProductSection from "../components/ProductSection";
import CataloguePreviewNotice from "../components/CataloguePreviewNotice";
import HomeDiscoverySections from "../components/home/HomeDiscoverySections";
import { ErrorState, LoadingState } from "../components/States";
import ResponsiveImage from "../components/ResponsiveImage";


/* ------------------------------------------
   Home page configuration
------------------------------------------ */

const categoryArt = [
  "/homepage-images/folded-silk.jpg",
  "/homepage-images/saree-flatlay.jpg",
  "/homepage-images/red-saree.jpg",
  "/homepage-images/drape-detail.jpg",
];
const heroImages = [
  { url: "/homepage-images/showroom.png", altText: "A welcoming Nishree saree showroom" },
  { url: "/homepage-images/celestial-mandala.png", altText: "A golden mandala-inspired saree editorial" },
  { url: "/homepage-images/heavenly-dancer.png", altText: "A saree dancer beneath a luminous halo" },
  { url: "/homepage-images/neon-carnival.png", altText: "A vivid saree at a neon carnival" },
  { url: "/homepage-images/blush-arch.png", altText: "A blush saree framed by a floral arch" },
  { url: "/homepage-images/glass-reflections.png", altText: "A regal saree reflected in glass cubes" },
  { url: "/homepage-images/palace-editorial.png", altText: "A royal blue and ivory saree in a palace" },
];
const isCancelledRequest = (error, signal) =>
  signal?.aborted ||
  error?.name === "AbortError" ||
  error?.name === "CanceledError" ||
  error?.code === "ERR_CANCELED";

/* ------------------------------------------
   Home page
------------------------------------------ */

export default function HomePage() {
  const [categories, setCategories] = useState([]);
  const [categoryStatus, setCategoryStatus] = useState("loading");

  const [featured, setFeatured] = useState([]);
  const [featuredStatus, setFeaturedStatus] = useState("loading");
  const [homepageImageSections, setHomepageImageSections] = useState({});
  const [homepageImagesLoaded, setHomepageImagesLoaded] = useState(false);
  const [activeHeroSlide, setActiveHeroSlide] = useState(0);
  const [heroPaused, setHeroPaused] = useState(false);

  const requestControllersRef = useRef({});

  const shouldReduceMotion = useReducedMotion();
  const imagesForSection = (section, fallback) => {
    const images = homepageImageSections[section];
    if (homepageImagesLoaded) return Array.isArray(images) ? images : [];
    return fallback;
  };
  const heroSlides = imagesForSection("hero", heroImages);
  const visibleHeroSlides = heroSlides.length ? heroSlides : heroImages;
  const activeHeroIndex = activeHeroSlide % visibleHeroSlides.length;
  const categoryImages = imagesForSection("category", categoryArt);
  const socialImages = imagesForSection("social", []);

  useEffect(() => {
    if (shouldReduceMotion || heroPaused || visibleHeroSlides.length < 2) return undefined;
    const timer = window.setInterval(() => {
      setActiveHeroSlide((index) => (index + 1) % visibleHeroSlides.length);
    }, 7_000);
    return () => window.clearInterval(timer);
  }, [heroPaused, shouldReduceMotion, visibleHeroSlides.length]);

  /* ------------------------------------------
     Request controller management
  ------------------------------------------ */

  const createRequestController = useCallback((key) => {
    requestControllersRef.current[key]?.abort();

    const controller = new AbortController();

    requestControllersRef.current[key] = controller;

    return controller;
  }, []);

  /* ------------------------------------------
     Load available categories
  ------------------------------------------ */

  const loadCategories = useCallback(async (signal) => {
    try {
      const response = await catalogApi.categories(
        {
          page: 1,
          limit: 100,
        },
        signal,
      );

      if (signal.aborted) return;

      setCategories(
        (Array.isArray(response?.categories) ? response.categories : [])
          .filter((category) => Number(category.productCount) > 0)
          .slice(0, 4),
      );
      setCategoryStatus("ready");
    } catch (error) {
      if (isCancelledRequest(error, signal)) return;

      setCategoryStatus("error");
    }
  }, []);

  /* ------------------------------------------
     Load featured products
  ------------------------------------------ */

  const loadFeatured = useCallback(async (signal) => {
    try {
      const response = await catalogApi.products(
        {
          page: 1,
          limit: 4,
          isFeatured: true,
          sort: "featured",
        },
        signal,
      );

      if (signal.aborted) return;

      setFeatured(Array.isArray(response?.products) ? response.products : []);

      setFeaturedStatus("ready");
    } catch (error) {
      if (isCancelledRequest(error, signal)) return;

      setFeaturedStatus("error");
    }
  }, []);

  /* ------------------------------------------
     Initial loading and cleanup
  ------------------------------------------ */

  useEffect(() => {
    const controller = new AbortController();
    homepageApi.images(controller.signal)
      .then((images) => {
        if (controller.signal.aborted || !Array.isArray(images)) return;
        setHomepageImageSections(
          images.reduce((sections, image) => {
            if (!sections[image.section]) sections[image.section] = [];
            sections[image.section].push(image);
            return sections;
          }, {})
        );
        setHomepageImagesLoaded(true);
      })
      .catch((error) => {
        if (!isCancelledRequest(error, controller.signal)) {
          console.error("Homepage image content could not be loaded:", error.message);
        }
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controllers = {
      categories: new AbortController(),
      featured: new AbortController(),
    };

    requestControllersRef.current = controllers;

    const runInitialLoads = async () => {
      await Promise.allSettled([
        loadCategories(controllers.categories.signal),
        loadFeatured(controllers.featured.signal),
      ]);
    };

    void runInitialLoads();

    return () => {
      Object.values(requestControllersRef.current).forEach((controller) =>
        controller?.abort(),
      );

      requestControllersRef.current = {};
    };
  }, [loadCategories, loadFeatured]);

  /* ------------------------------------------
     Retry handlers
  ------------------------------------------ */

  const retryCategories = useCallback(() => {
    const controller = createRequestController("categories");

    setCategoryStatus("loading");

    void loadCategories(controller.signal);
  }, [createRequestController, loadCategories]);

  const retryFeatured = useCallback(() => {
    const controller = createRequestController("featured");

    setFeaturedStatus("loading");

    void loadFeatured(controller.signal);
  }, [createRequestController, loadFeatured]);

  /* ------------------------------------------
     Hero animation settings
  ------------------------------------------ */

  const heroInitial = shouldReduceMotion
    ? false
    : {
        opacity: 0,
        y: 18,
      };

  const heroTransition = shouldReduceMotion
    ? {
        duration: 0,
      }
    : {
        duration: 0.85,
        delay: 0.15,
        ease: [0.22, 1, 0.36, 1],
      };

  return (
    <main className="home-page">
      {/* ======================================
          HERO SECTION
      ====================================== */}

      <section className="hero" aria-labelledby="hero-title">
        <div className="hero-image-track" aria-hidden="true" role="presentation">
          <AnimatePresence mode="sync" initial={false}>
            <motion.div
              key={`${activeHeroIndex}-${visibleHeroSlides[activeHeroIndex]?._id || visibleHeroSlides[activeHeroIndex]?.url}`}
              initial={shouldReduceMotion || activeHeroIndex === 0 ? false : { opacity: 0, scale: 1.025 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 1.015 }}
              transition={shouldReduceMotion ? { duration: 0 } : { duration: 1.05, ease: [0.22, 1, 0.36, 1] }}
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
            >
              <ResponsiveImage
                src={visibleHeroSlides[activeHeroIndex]?.url}
                responsiveKey={visibleHeroSlides[activeHeroIndex]?.url}
                alt=""
                width="1672"
                height="941"
                sizes="100vw"
                loading={activeHeroIndex === 0 ? "eager" : "lazy"}
                fetchPriority={activeHeroIndex === 0 ? "high" : "auto"}
                decoding="async"
              />
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="hero-shade" aria-hidden="true" />

        <div className="hero-content">
          <motion.div
            initial={heroInitial}
            animate={{
              opacity: 1,
              y: 0,
            }}
            transition={heroTransition}
          >
            <span className="hero-eyebrow">
              <span aria-hidden="true" />
              THE NISHREE EDIT · 2026
            </span>

            <h1 id="hero-title">
              A story woven
              <br />
              in every <em>drape.</em>
            </h1>

            <p>
              For the moments that become memories, discover sarees with a
              little more feeling.
            </p>

            <div className="hero-actions">
              <Link to="/shop" className="button button-light">
                Explore the collection
                <ArrowRight size={16} aria-hidden="true" />
              </Link>

              <Link to="/new-arrivals" className="hero-secondary">
                Discover Nishree
                <MoveUpRight size={15} aria-hidden="true" />
              </Link>
            </div>
          </motion.div>

          <div className="hero-footnote">
            <span>{String(activeHeroIndex + 1).padStart(2, "0")} / {String(visibleHeroSlides.length).padStart(2, "0")}</span>

            <span className="hero-footnote-line" aria-hidden="true" />

            <span>Elegance in every thread</span>

            {visibleHeroSlides.length > 1 && (
              <span className="hero-slide-controls" role="group" aria-label="Hero story controls">
                <button type="button" onClick={() => setActiveHeroSlide((activeHeroIndex - 1 + visibleHeroSlides.length) % visibleHeroSlides.length)} aria-label="Previous story">
                  <ChevronLeft size={14} aria-hidden="true" />
                </button>
                {!shouldReduceMotion && (
                  <button type="button" onClick={() => setHeroPaused((paused) => !paused)} aria-label={heroPaused ? "Play hero stories" : "Pause hero stories"} aria-pressed={heroPaused}>
                    {heroPaused ? <Play size={11} aria-hidden="true" /> : <Pause size={11} aria-hidden="true" />}
                  </button>
                )}
                <button type="button" onClick={() => setActiveHeroSlide((activeHeroIndex + 1) % visibleHeroSlides.length)} aria-label="Next story">
                  <ChevronRight size={14} aria-hidden="true" />
                </button>
              </span>
            )}
          </div>
        </div>

        <a
          className="scroll-cue"
          href="#collection"
          aria-label="Scroll to discover the collection"
        >
          <span>Scroll to discover</span>

          <ArrowDown size={15} aria-hidden="true" />
        </a>

        <div className="hero-side-note" aria-hidden="true">
          THE ART OF THE DRAPE · EST. WITH CARE
        </div>
      </section>

      {/* ======================================
          BRAND VALUES
      ====================================== */}

      <section className="brand-values" aria-label="The Nishree point of view">
        <div>
          <Flower2 size={20} strokeWidth={1.3} aria-hidden="true" />

          <span>Rooted in the ritual of dressing</span>
        </div>

        <i aria-hidden="true" />

        <div>
          <HeartHandshake size={20} strokeWidth={1.3} aria-hidden="true" />

          <span>Made for moments worth keeping</span>
        </div>

        <i aria-hidden="true" />

        <div>
          <span className="value-star" aria-hidden="true">
            ✧
          </span>

          <span>Elegance in every thread</span>
        </div>
      </section>

      {/* ======================================
          CATALOGUE NOTICE
      ====================================== */}

      <CataloguePreviewNotice className="home-catalogue-notice" />

      {/* ======================================
          COLLECTION CATEGORIES
      ====================================== */}

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

        {categoryStatus === "loading" ? (
          <LoadingState label="Opening the collection…" />
        ) : categoryStatus === "error" ? (
          <ErrorState
            message="We could not load the collection categories."
            onRetry={retryCategories}
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
                    alt={category.image?.url ? "" : categoryImages[index % categoryImages.length]?.altText || ""}
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
                      {category.description ||
                        "A considered edit from Nishree Attire."}
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

      {/* ======================================
          FEATURED PRODUCTS
      ====================================== */}

      <ProductSection
        title="Exclusive picks"
        kicker="A considered collection"
        products={featured}
        loading={featuredStatus === "loading"}
        error={
          featuredStatus === "error"
            ? "Our curated pieces are unavailable just now."
            : ""
        }
        onRetry={retryFeatured}
        linkText="Explore all sarees"
      />

      <HomeDiscoverySections
        featured={featured}
        socialImages={socialImages}
      />

      {/* ======================================
          CLOSING CALL TO ACTION
      ====================================== */}

      <section className="closing-note">
        <div className="closing-ornament" aria-hidden="true">
          ✧
        </div>

        <span className="eyebrow">An invitation from Nishree</span>

        <h2>
          For all the stories
          <br />
          still to be <em>woven.</em>
        </h2>

        <Link className="button button-primary" to="/shop">
          Find your next heirloom
          <ArrowRight size={16} aria-hidden="true" />
        </Link>
      </section>
    </main>
  );
}
