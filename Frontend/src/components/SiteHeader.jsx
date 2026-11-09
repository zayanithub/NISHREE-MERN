import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  Heart,
  Menu,
  Search,
  ShoppingBag,
  Sparkles,
  UserRound,
  X,
} from 'lucide-react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useReducedMotion } from 'framer-motion';

import { useAuth } from '../auth/useAuth';
import { useCart } from '../cart/useCart';
import { catalogApi } from '../api/catalogApi';
import companyLogo from '../assets/Nishree Attire Navbar Logo.png';
import { ThemeToggle } from '../theme/ThemeContext';
import { formatDate, formatPrice } from '../utils/format';
import { currentCouponOffers } from '../utils/couponOffers';
import SecondaryCategoryNavigation from './SecondaryCategoryNavigation';

/* ----------------------------------
   Announcement Bar
---------------------------------- */

function AnnouncementBar() {
  const [offers, setOffers] = useState([]);
  const [offerTime, setOfferTime] = useState(() => Date.now());
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const [isHovered, setIsHovered] = useState(false);
  const [hasFocus, setHasFocus] = useState(false);

  const shouldReduceMotion = useReducedMotion();

  /*
   * Refresh offers periodically.
   *
   * A new request aborts an older unfinished request.
   * Failed refreshes do not discard previously loaded offers.
   */
  useEffect(() => {
    let active = true;
    let controller;

    const refreshOffers = async () => {
      controller?.abort();

      const requestController = new AbortController();
      controller = requestController;

      try {
        const response = await catalogApi.offers(
          requestController.signal,
        );

        if (!active || requestController.signal.aborted) {
          return;
        }

        setOffers(
          Array.isArray(response?.offers)
            ? response.offers
            : [],
        );

        setOfferTime(Date.now());
        setFailed(false);
      } catch (error) {
        const cancelled =
          requestController.signal.aborted ||
          error?.name === 'CanceledError' ||
          error?.name === 'AbortError' ||
          error?.code === 'ERR_CANCELED';

        if (!active || cancelled) {
          return;
        }

        setFailed(true);
      } finally {
        if (
          active &&
          controller === requestController &&
          !requestController.signal.aborted
        ) {
          setLoading(false);
        }
      }
    };

    void refreshOffers();

    const refreshTimer = window.setInterval(() => {
      void refreshOffers();
    }, 5 * 60_000);

    return () => {
      active = false;

      window.clearInterval(refreshTimer);
      controller?.abort();
    };
  }, []);

  /*
   * Filter offers using the existing project utility.
   */
  const currentOffers = currentCouponOffers(
    offers,
    offerTime,
  );

  /*
   * Recalculate when the current offer expires.
   */
  useEffect(() => {
    const nextExpiry = currentOffers.reduce(
      (soonest, offer) => {
        if (!offer.expiresAt) {
          return soonest;
        }

        const expiry = Date.parse(offer.expiresAt);

        return Number.isFinite(expiry)
          ? Math.min(soonest, expiry)
          : soonest;
      },
      Infinity,
    );

    if (!Number.isFinite(nextExpiry)) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      setOfferTime(Date.now());
    }, Math.max(0, nextExpiry - offerTime + 10));

    return () => {
      window.clearTimeout(timer);
    };
  }, [currentOffers, offerTime]);

  /*
   * Rotate offers while avoiding automatic movement when:
   * - Reduced motion is enabled.
   * - The user hovers over the announcement.
   * - Keyboard focus is inside the announcement.
   */
  useEffect(() => {
    if (
      shouldReduceMotion ||
      isHovered ||
      hasFocus ||
      currentOffers.length < 2
    ) {
      return undefined;
    }

    const rotationTimer = window.setInterval(() => {
      setActiveIndex((index) => (
        index + 1
      ) % currentOffers.length);
    }, 7_000);

    return () => {
      window.clearInterval(rotationTimer);
    };
  }, [
    currentOffers.length,
    shouldReduceMotion,
    isHovered,
    hasFocus,
  ]);

  const offer = currentOffers.length
    ? currentOffers[activeIndex % currentOffers.length]
    : null;

  const discount = offer
    ? offer.discountType === 'percentage'
      ? `${offer.discountValue}% off`
      : `${formatPrice(offer.discountValue)} off`
    : '';

  const message = offer
    ? [
        offer.description || 'A special offer from Nishree Attire',
        discount,
        offer.maxDiscount
          ? `up to ${formatPrice(offer.maxDiscount)}`
          : null,
        offer.code ? `Code ${offer.code}` : null,
        offer.minimumOrderValue
          ? `On orders over ${formatPrice(offer.minimumOrderValue)}`
          : null,
        offer.isRestricted
          ? 'Eligible pieces only'
          : null,
        offer.expiresAt
          ? `Until ${formatDate(offer.expiresAt)}`
          : null,
      ]
        .filter(Boolean)
        .join(' · ')
    : failed
      ? 'Current offers are temporarily unavailable'
      : loading
        ? 'Nishree Attire'
        : 'Nishree Attire · Discover the collection';

  const handleBlur = (event) => {
    if (
      !event.currentTarget.contains(event.relatedTarget)
    ) {
      setHasFocus(false);
    }
  };

  return (
    <aside
      className="announcement-bar"
      aria-label="Current store offers"
      aria-live={currentOffers.length > 1 ? 'off' : 'polite'}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onFocusCapture={() => setHasFocus(true)}
      onBlurCapture={handleBlur}
    >
      <div className="announcement-content">
        <span className="announcement-label">
          <Sparkles
            size={13}
            aria-hidden="true"
          />
          A little something for you
        </span>

        <span
          className="announcement-message"
          title={message}
        >
          {message}
        </span>

        <Link
          to="/shop"
          className="announcement-link"
        >
          Explore
          <ArrowRight
            size={13}
            aria-hidden="true"
          />
        </Link>
      </div>
    </aside>
  );
}

/* ----------------------------------
   Main Site Header
---------------------------------- */

export default function SiteHeader() {
  const [scrolled, setScrolled] = useState(
    () => (
      typeof window !== 'undefined' &&
      window.scrollY > 28
    ),
  );

  const [openPanel, setOpenPanel] = useState(null);
  const [search, setSearch] = useState('');

  const menuToggleRef = useRef(null);
  const firstMobileLinkRef = useRef(null);
  const searchToggleRef = useRef(null);
  const searchInputRef = useRef(null);

  const { user } = useAuth();
  const { itemCount, setDrawerOpen } = useCart();

  const location = useLocation();
  const navigate = useNavigate();
  const menuOpen =
    openPanel?.name === 'menu' &&
    openPanel.locationKey === location.key;
  const searchOpen =
    openPanel?.name === 'search' &&
    openPanel.locationKey === location.key;

  const onHome = location.pathname === '/' || location.pathname === '/home';
  const isCatalogRoute = location.pathname === '/shop'
    || location.pathname.startsWith('/collections/');
  const showSecondaryCategories = location.pathname === '/account'
    || location.pathname.startsWith('/account/');

  const accountTo = user
    ? '/account'
    : '/login';

  /*
   * Toggle transparent/solid header styling on scroll.
   */
  useEffect(() => {
    const updateScrollState = () => {
      const nextScrolled = window.scrollY > 28;

      setScrolled((current) => (
        current === nextScrolled
          ? current
          : nextScrolled
      ));
    };

    updateScrollState();

    window.addEventListener(
      'scroll',
      updateScrollState,
      { passive: true },
    );

    return () => {
      window.removeEventListener(
        'scroll',
        updateScrollState,
      );
    };
  }, []);

  /*
   * Focus the first mobile navigation link when opened.
   */
  useEffect(() => {
    if (!menuOpen) {
      return undefined;
    }

    firstMobileLinkRef.current?.focus({
      preventScroll: true,
    });

    return undefined;
  }, [menuOpen]);

  /*
   * Focus the search input when search opens.
   */
  useEffect(() => {
    if (!searchOpen) {
      return undefined;
    }

    searchInputRef.current?.focus({
      preventScroll: true,
    });

    return undefined;
  }, [searchOpen]);

  /*
   * Close open panels when the browser history changes.
   */
  useEffect(() => {
    const closePanels = () => setOpenPanel(null);
    window.addEventListener('popstate', closePanels);
    return () => window.removeEventListener('popstate', closePanels);
  }, []);

  /*
   * Keyboard accessibility:
   * Escape closes an open menu or search panel.
   */
  useEffect(() => {
    if (!menuOpen && !searchOpen) {
      return undefined;
    }

    const handleKeyDown = (event) => {
      if (event.key !== 'Escape') {
        return;
      }

      if (searchOpen) {
        setOpenPanel(null);

        searchToggleRef.current?.focus({
          preventScroll: true,
        });
      }

      if (menuOpen) {
        setOpenPanel(null);

        menuToggleRef.current?.focus({
          preventScroll: true,
        });
      }
    };

    document.addEventListener(
      'keydown',
      handleKeyDown,
    );

    return () => {
      document.removeEventListener(
        'keydown',
        handleKeyDown,
      );
    };
  }, [menuOpen, searchOpen]);

  /*
   * Search submission.
   */
  const submitSearch = useCallback(
    (event) => {
      event.preventDefault();

      const term = search.trim();

      setOpenPanel(null);

      navigate(
        term
          ? `/shop?search=${encodeURIComponent(term)}`
          : '/shop',
      );
    },
    [navigate, search],
  );

  const toggleMenu = () => {
    setOpenPanel((current) => (
      current?.name === 'menu' && current.locationKey === location.key
        ? null
        : { name: 'menu', locationKey: location.key }
    ));
  };

  const toggleSearch = () => {
    setOpenPanel((current) => (
      current?.name === 'search' && current.locationKey === location.key
        ? null
        : { name: 'search', locationKey: location.key }
    ));
  };

  const closeMobileMenu = () => {
    setOpenPanel(null);

    menuToggleRef.current?.focus({
      preventScroll: true,
    });
  };

  const closeSearch = () => {
    setOpenPanel(null);

    searchToggleRef.current?.focus({
      preventScroll: true,
    });
  };

  return (
    <header
      className={[
        'site-chrome',
        onHome && !scrolled
          ? 'is-transparent'
          : 'is-solid',
        showSecondaryCategories
          ? 'has-secondary-navigation'
          : '',
      ].join(' ')}
    >
      <AnnouncementBar />

      {/* Main navigation bar */}
      <div className="nav-shell">
        <button
          ref={menuToggleRef}
          className="icon-button mobile-menu-toggle"
          type="button"
          onClick={toggleMenu}
          aria-label={
            menuOpen
              ? 'Close navigation'
              : 'Open navigation'
          }
          aria-expanded={menuOpen}
          aria-controls="mobile-navigation"
        >
          {menuOpen
            ? <X size={21} aria-hidden="true" />
            : <Menu size={21} aria-hidden="true" />}
        </button>

        <Link
          to="/"
          className="brand-mark"
          aria-label="Nishree Attire home"
        >
          <img
            src={companyLogo}
            alt="Nishree Attire"
            width="1200"
            height="967"
            decoding="async"
          />
        </Link>

        <nav className="desktop-navigation" aria-label="Main navigation">
          <NavLink to="/shop">The collection</NavLink>
          <NavLink to="/product_hub">Product Hub</NavLink>
          <NavLink to="/new-arrivals">New arrivals</NavLink>
          <NavLink to="/find-your-drape">Find Your Drape</NavLink>
          <NavLink to="/atelier">Our atelier</NavLink>
          <NavLink to="/about">About us</NavLink>
          <NavLink to="/contact">Contact us</NavLink>
          <NavLink to="/blogs">Blogs</NavLink>
        </nav>

        {/* Header actions */}
        <div className="nav-actions">
          <button
            ref={searchToggleRef}
            className="icon-button search-toggle"
            type="button"
            onClick={toggleSearch}
            aria-label={
              searchOpen
                ? 'Close search'
                : 'Search sarees'
            }
            aria-expanded={searchOpen}
            aria-controls="header-search"
          >
            {searchOpen
              ? <X size={19} aria-hidden="true" />
              : <Search size={19} aria-hidden="true" />}
          </button>

          <ThemeToggle />

          <Link
            to={accountTo}
            className="icon-button account-link"
            aria-label={
              user
                ? 'Your account'
                : 'Sign in'
            }
          >
            <UserRound
              size={19}
              aria-hidden="true"
            />
          </Link>

          {user && (
            <Link
              to="/wishlist"
              className="icon-button wishlist-link"
              aria-label="Your wishlist"
            >
              <Heart
                size={19}
                aria-hidden="true"
              />
            </Link>
          )}

          <button
            className="bag-link"
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label={`Open shopping bag, ${itemCount} items`}
          >
            <ShoppingBag
              size={19}
              aria-hidden="true"
            />

            <span className="bag-label">
              Bag
            </span>

            <span
              className="bag-count"
              aria-label={`${itemCount} items`}
            >
              {itemCount}
            </span>
          </button>
        </div>
      </div>

      {showSecondaryCategories && <SecondaryCategoryNavigation showCatalogLinks={isCatalogRoute} />}

      {/* Expandable search panel */}
      {searchOpen && (
        <form
          id="header-search"
          className="header-search"
          onSubmit={submitSearch}
          role="search"
        >
          <Search
            size={18}
            aria-hidden="true"
          />

          <label
            className="sr-only"
            htmlFor="site-search"
          >
            Search the collection
          </label>

          <input
            ref={searchInputRef}
            id="site-search"
            type="search"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
            }}
            placeholder="Search the collection"
            autoComplete="off"
          />

          <button
            type="submit"
            aria-label="Submit search"
          >
            <ArrowRight
              size={18}
              aria-hidden="true"
            />
          </button>

          <button
            type="button"
            onClick={closeSearch}
            aria-label="Close search"
          >
            <X
              size={17}
              aria-hidden="true"
            />
          </button>
        </form>
      )}

      {/* Mobile navigation */}
      <nav
        className={`mobile-navigation${menuOpen ? ' is-open' : ''}`}
        id="mobile-navigation"
        aria-label="Mobile navigation"
        aria-hidden={!menuOpen}
        inert={!menuOpen}
      >
        <NavLink
          ref={firstMobileLinkRef}
          to="/shop"
          tabIndex={menuOpen ? 0 : -1}
          onClick={closeMobileMenu}
        >
          The collection
          <ArrowRight size={16} aria-hidden="true" />
        </NavLink>

        <NavLink
          to="/product_hub"
          tabIndex={menuOpen ? 0 : -1}
          onClick={closeMobileMenu}
        >
          Product Hub
          <ArrowRight size={16} aria-hidden="true" />
        </NavLink>

        <Link
          to="/new-arrivals"
          tabIndex={menuOpen ? 0 : -1}
          onClick={closeMobileMenu}
        >
          New arrivals
          <ArrowRight size={16} aria-hidden="true" />
        </Link>

        <Link
          to="/find-your-drape"
          tabIndex={menuOpen ? 0 : -1}
          onClick={closeMobileMenu}
        >
          Find Your Drape
          <ArrowRight size={16} aria-hidden="true" />
        </Link>

        <Link
          to="/atelier"
          tabIndex={menuOpen ? 0 : -1}
          onClick={closeMobileMenu}
        >
          Our atelier
          <ArrowRight size={16} aria-hidden="true" />
        </Link>

        <NavLink
          to="/about"
          tabIndex={menuOpen ? 0 : -1}
          onClick={closeMobileMenu}
        >
          About us
          <ArrowRight size={16} aria-hidden="true" />
        </NavLink>

        <NavLink
          to="/contact"
          tabIndex={menuOpen ? 0 : -1}
          onClick={closeMobileMenu}
        >
          Contact us
          <ArrowRight size={16} aria-hidden="true" />
        </NavLink>

        <NavLink
          to="/blogs"
          tabIndex={menuOpen ? 0 : -1}
          onClick={closeMobileMenu}
        >
          Blogs
          <ArrowRight size={16} aria-hidden="true" />
        </NavLink>

        <Link
          to={accountTo}
          tabIndex={menuOpen ? 0 : -1}
          onClick={closeMobileMenu}
        >
          {user ? 'Your account' : 'Sign in'}
          <ArrowRight size={16} aria-hidden="true" />
        </Link>

        {user && (
          <Link
            to="/wishlist"
            tabIndex={menuOpen ? 0 : -1}
            onClick={closeMobileMenu}
          >
            Saved pieces
            <Heart size={16} aria-hidden="true" />
          </Link>
        )}
      </nav>
    </header>
  );
}
