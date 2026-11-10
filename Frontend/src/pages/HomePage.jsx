import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Flower2,
  HeartHandshake,
  MoveUpRight,
  Pause,
  Play,
} from "lucide-react";
import { Link } from "react-router-dom";

import { catalogApi } from "../api/catalogApi";
import { homepageApi } from "../api/homepageApi";
import CataloguePreviewNotice from "../components/CataloguePreviewNotice";
import { SkeletonGrid } from "../components/States";
import ResponsiveImage from "../components/ResponsiveImage";
import useReducedMotionPreference from "../hooks/useReducedMotionPreference";

const HomeCollectionSection = lazy(() => import("../components/home/HomeCollectionSection"));
const ProductSection = lazy(() => import("../components/ProductSection"));
const HomeDiscoverySections = lazy(() => import("../components/home/HomeDiscoverySections"));


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

function ProductSectionFallback() {
  return (
    <section className="section-shell product-section" aria-busy="true">
      <div className="section-heading-row">
        <div>
          <span className="eyebrow">A considered collection</span>
          <h2>Exclusive picks</h2>
        </div>
        <Link className="text-link" to="/shop">
          Explore all sarees
          <ArrowRight size={15} aria-hidden="true" />
        </Link>
      </div>
      <SkeletonGrid count={4} />
    </section>
  );
}

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

  const shouldReduceMotion = useReducedMotionPreference();
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

  return (
    <main className="home-page">
      {/* ======================================
          HERO SECTION
      ====================================== */}

      <section className="hero" aria-labelledby="hero-title">
        <div className="hero-image-track" aria-hidden="true" role="presentation">
          <div
            key={`${activeHeroIndex}-${visibleHeroSlides[activeHeroIndex]?._id || visibleHeroSlides[activeHeroIndex]?.url}`}
            className={`hero-slide${activeHeroIndex === 0 ? ' is-first' : ''}`}
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
          </div>
        </div>

        <div className="hero-shade" aria-hidden="true" />

        <div className="hero-content">
          <div className="hero-copy">
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
          </div>

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

      <Suspense fallback={null}>
        <HomeCollectionSection
          categories={categories}
          categoryImages={categoryImages}
          categoryStatus={categoryStatus}
          onRetry={retryCategories}
        />
      </Suspense>

      {/* ======================================
          FEATURED PRODUCTS
      ====================================== */}

      <Suspense fallback={<ProductSectionFallback />}>
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
      </Suspense>

      <Suspense fallback={null}>
        <HomeDiscoverySections
          featured={featured}
          socialImages={socialImages}
        />
      </Suspense>

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
