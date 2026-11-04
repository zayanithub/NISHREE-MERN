import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  Flower2,
  HeartHandshake,
  MoveUpRight,
} from "lucide-react";
import { Link } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";

import { catalogApi } from "../api/catalogApi";
import { homepageApi } from "../api/homepageApi";
import { Reveal } from "../components/Reveal";
import ProductSection from "../components/ProductSection";
import CataloguePreviewNotice from "../components/CataloguePreviewNotice";
import { ErrorState, LoadingState } from "../components/States";


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
const getHeroAnimation = (slideCount) => {
  const count = Math.max(1, slideCount);
  const transitionSeconds = 5;
  const slideSeconds = 90 / 7;
  const durationSeconds = count * slideSeconds;
  const animationName = `hero-image-drift-${count}`;
  const frames = ["0% { transform: translateX(0); }"];

  for (let index = 1; index <= count; index += 1) {
    const position = `${(-index / (count + 1)) * 100}%`;
    const arrival = ((transitionSeconds + (index - 1) * slideSeconds) / durationSeconds) * 100;
    const pause = ((index * slideSeconds) / durationSeconds) * 100;
    frames.push(
      `${arrival.toFixed(4)}% { transform: translateX(${position}); }`,
      `${pause.toFixed(4)}% { transform: translateX(${position}); }`,
    );
  }

  return {
    animationName,
    durationSeconds,
    keyframes: `@keyframes ${animationName} { ${frames.join(" ")} }`,
  };
};

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

  const [newest, setNewest] = useState([]);
  const [newestStatus, setNewestStatus] = useState("loading");

  const [featured, setFeatured] = useState([]);
  const [featuredStatus, setFeaturedStatus] = useState("loading");
  const [homepageImageSections, setHomepageImageSections] = useState({});
  const [homepageImagesLoaded, setHomepageImagesLoaded] = useState(false);

  const requestControllersRef = useRef({});

  const shouldReduceMotion = useReducedMotion();
  const imagesForSection = (section, fallback) => {
    const images = homepageImageSections[section];
    if (homepageImagesLoaded) return Array.isArray(images) ? images : [];
    return fallback;
  };
  const heroSlides = imagesForSection("hero", heroImages);
  const visibleHeroSlides = heroSlides.length ? heroSlides : heroImages;
  const heroAnimation = getHeroAnimation(visibleHeroSlides.length);
  const categoryImages = imagesForSection("category", categoryArt);
  const editorialImages = imagesForSection("editorial", [{ url: categoryArt[0], altText: "Golden silk folded to reveal its woven border" }]);
  const atelierImages = imagesForSection("atelier", [{ url: "/homepage-images/showroom.png", altText: "A warm boutique interior with sarees displayed throughout" }]);

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
          limit: 4,
        },
        signal,
      );

      if (signal.aborted) return;

      const availableCategories = Array.isArray(response?.categories)
        ? response.categories
        : [];

      const categoriesWithProducts = await Promise.all(
        availableCategories.map(async (category) => {
          if (!category?.slug) return null;

          const productResponse = await catalogApi.products(
            {
              page: 1,
              limit: 1,
              category: category.slug,
            },
            signal,
          );

          if (signal.aborted) return null;

          const totalProducts = Number(productResponse?.pagination?.total ?? 0);

          return totalProducts > 0 ? category : null;
        }),
      );

      if (signal.aborted) return;

      setCategories(categoriesWithProducts.filter(Boolean));
      setCategoryStatus("ready");
    } catch (error) {
      if (isCancelledRequest(error, signal)) return;

      setCategoryStatus("error");
    }
  }, []);

  /* ------------------------------------------
     Load newest products
  ------------------------------------------ */

  const loadNewest = useCallback(async (signal) => {
    try {
      const response = await catalogApi.products(
        {
          page: 1,
          limit: 3,
          sort: "newest",
        },
        signal,
      );

      if (signal.aborted) return;

      setNewest(Array.isArray(response?.products) ? response.products : []);

      setNewestStatus("ready");
    } catch (error) {
      if (isCancelledRequest(error, signal)) return;

      setNewestStatus("error");
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
      newest: new AbortController(),
      featured: new AbortController(),
    };

    requestControllersRef.current = controllers;

    const runInitialLoads = async () => {
      await Promise.allSettled([
        loadCategories(controllers.categories.signal),
        loadNewest(controllers.newest.signal),
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
  }, [loadCategories, loadNewest, loadFeatured]);

  /* ------------------------------------------
     Retry handlers
  ------------------------------------------ */

  const retryCategories = useCallback(() => {
    const controller = createRequestController("categories");

    setCategoryStatus("loading");

    void loadCategories(controller.signal);
  }, [createRequestController, loadCategories]);

  const retryNewest = useCallback(() => {
    const controller = createRequestController("newest");

    setNewestStatus("loading");

    void loadNewest(controller.signal);
  }, [createRequestController, loadNewest]);

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
        <style>{heroAnimation.keyframes}</style>
        <div
          className="hero-image-track"
          aria-hidden="true"
          style={{
            width: `${(visibleHeroSlides.length + 1) * 100}%`,
            animationName: heroAnimation.animationName,
            animationDuration: `${heroAnimation.durationSeconds}s`,
          }}
        >
          {[...visibleHeroSlides, visibleHeroSlides[0]].map((image, index) => (
            <img
              key={`${index}-${image._id || image.url}`}
              src={image.url}
              alt={image.altText || ""}
              style={{ flex: `0 0 ${100 / (visibleHeroSlides.length + 1)}%`, width: `${100 / (visibleHeroSlides.length + 1)}%` }}
              loading={index === 0 ? "eager" : "lazy"}
              fetchPriority={index === 0 ? "high" : "auto"}
              decoding="async"
            />
          ))}
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

              <a href="#new-arrivals" className="hero-secondary">
                Discover Nishree
                <MoveUpRight size={15} aria-hidden="true" />
              </a>
            </div>
          </motion.div>

          <div className="hero-footnote">
            <span>01 / 01</span>

            <span className="hero-footnote-line" aria-hidden="true" />

            <span>Elegance in every thread</span>
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
                  <img
                    src={category.image?.url || categoryImages[index % categoryImages.length]?.url || categoryImages[index % categoryImages.length]}
                    alt={category.image?.url ? "" : categoryImages[index % categoryImages.length]?.altText || ""}
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
          NEW ARRIVALS EDITORIAL
      ====================================== */}

      <section className="new-arrivals-editorial" id="new-arrivals">
        <Reveal className="new-arrivals-image">
          {editorialImages[0] && <img
            src={editorialImages[0].url || editorialImages[0]}
            alt={editorialImages[0].altText || "Golden silk folded to show its woven border and rich colour"}
            loading="lazy"
            decoding="async"
            width="900"
            height="900"
          />}

          <span>THE FIRST LOOK · NISHREE ATTIRE</span>
        </Reveal>

        <div className="new-arrivals-copy">
          <Reveal>
            <span className="eyebrow">The collection, as it unfolds</span>

            <h2>
              New pieces.
              <br />
              <em>Old soul.</em>
            </h2>

            <p>
              Discover the latest additions to our collection, selected from the
              newest pieces available in store.
            </p>

            <Link className="button button-primary" to="/shop?sort=newest">
              Meet the new arrivals
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </Reveal>

          {newestStatus === "loading" ? (
            <LoadingState label="Finding the newest pieces…" compact />
          ) : newestStatus === "error" ? (
            <ErrorState
              message="The newest pieces are unavailable just now."
              onRetry={retryNewest}
            />
          ) : newest.length > 0 ? (
            <div className="new-arrival-list">
              {newest.slice(0, 2).map((product, index) => (
                <Link
                  to={`/products/${product.slug}`}
                  key={product._id ?? product.slug}
                  className="new-arrival-item"
                >
                  <img
                    src={product.primaryImage?.url || categoryImages[index % categoryImages.length]?.url || categoryImages[index % categoryImages.length]}
                    alt={product.primaryImage?.url ? "" : categoryImages[index % categoryImages.length]?.altText || ""}
                    loading="lazy"
                    decoding="async"
                    width="96"
                    height="112"
                  />

                  <span>
                    <small>
                      {product.material ||
                        product.category?.name ||
                        "NEW PIECE"}
                    </small>

                    <strong>{product.name}</strong>
                  </span>

                  <ArrowUpRight size={17} aria-hidden="true" />
                </Link>
              ))}
            </div>
          ) : (
            <p className="quiet-note">
              The newest pieces will appear here as they join the collection.
            </p>
          )}
        </div>
      </section>

      {/* ======================================
          FEATURED PRODUCTS
      ====================================== */}

      <ProductSection
        title="Pieces to remember"
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

      {/* ======================================
          ATELIER EDITORIAL
      ====================================== */}

      <section className="atelier-section" id="atelier">
        <div className="atelier-visual">
          <div className="atelier-photo-frame">
            {atelierImages[0] && <img
              src={atelierImages[0].url || atelierImages[0]}
              alt={atelierImages[0].altText || "A warm boutique interior with sarees displayed throughout"}
              loading="lazy"
              decoding="async"
              width="1024"
              height="1024"
            />}
            <span className="atelier-image-caption">
              <span>THE NISHREE ATELIER</span>
              <span>A PLACE FOR THE BEAUTIFUL</span>
            </span>
            <div className="atelier-medallion" aria-label="Thoughtfully chosen, beautifully yours">
              <span>N</span>
              <small>CHOSEN<br />WITH CARE</small>
            </div>
          </div>
        </div>

        <Reveal className="atelier-copy">
          <span className="eyebrow">A little more personal</span>
          <h2>
            Find the one that feels <em>like you.</em>
          </h2>
          <p className="atelier-lead">
            Some sarees simply feel right. Find yours in a space made for
            taking your time, exploring every detail, and enjoying the moment.
          </p>
          <p className="atelier-description">
            At Nishree, thoughtful edits and a warm welcome make choosing
            something special feel effortless—from the first look to the final
            drape.
          </p>
          <div className="atelier-promises" aria-label="The Nishree atelier experience">
            <span><i aria-hidden="true">01</i> Considered collections</span>
            <span><i aria-hidden="true">02</i> A warm, personal welcome</span>
          </div>
          <div className="atelier-actions">
            <Link to="/shop" className="button button-primary">
              Explore the collection
              <ArrowRight size={16} aria-hidden="true" />
            </Link>
            <Link to="/contact" className="atelier-contact-link">Get in touch</Link>
          </div>
        </Reveal>
      </section>

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