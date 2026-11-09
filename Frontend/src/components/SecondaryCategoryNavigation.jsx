import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowDownRight, ArrowRight, ChevronDown, X } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Link, useLocation } from 'react-router-dom';
import { allCollections } from '../data/collectionCatalog';
import { catalogApi } from '../api/catalogApi';
import './SecondaryCategoryNavigation.css';

const closeDelay = 150;

function CollectionLink({ collection, onClick, className = '', children, ...linkProps }) {
  return (
    <Link
      className={className}
      to={`/collections/${collection.slug}`}
      onClick={onClick ? () => onClick() : undefined}
      {...linkProps}
    >
      {children ?? collection.name}
    </Link>
  );
}

function MegaMenu({ collection, onClose, reduceMotion }) {
  const highlights = collection.children.length
    ? collection.children.slice(0, 3)
    : [collection];

  return (
    <motion.div
      className={`secondary-category-menu${collection.children.length > 5 ? ' has-many' : ''}${collection.children.length === 0 ? ' has-no-subcategories' : ''}`}
      id={`category-menu-${collection.slug}`}
      role="region"
      aria-label={`${collection.name} collections`}
      initial={{ opacity: 0, y: reduceMotion ? 0 : -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: reduceMotion ? 0 : -5 }}
      transition={{ duration: reduceMotion ? 0 : 0.22, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="secondary-category-menu-inner">
        <div className="mega-menu-intro">
          <span className="eyebrow">The Nishree edit</span>
          <h2>{collection.name}</h2>
          <p>{collection.description}</p>
          <CollectionLink
            collection={collection}
            className="mega-menu-view-all"
            onClick={onClose}
          >
            View all {collection.name} <ArrowRight size={15} aria-hidden="true" />
          </CollectionLink>
        </div>

        <div className="mega-menu-collection-list">
          <span className="mega-menu-kicker">
            {collection.children.length ? 'Explore by weave' : 'The collection'}
          </span>
          {collection.children.length ? collection.children.map((child, index) => (
            <CollectionLink
              collection={child}
              key={child.slug}
              className="mega-menu-text-link"
              onClick={onClose}
            >
              <span className="mega-menu-link-number">{String(index + 1).padStart(2, '0')}</span>
              <span>{child.name}</span>
              <ArrowRight size={14} aria-hidden="true" />
            </CollectionLink>
          )) : (
            <CollectionLink collection={collection} className="mega-menu-text-link" onClick={onClose}>
              <span className="mega-menu-link-number">01</span>
              <span>Discover {collection.name}</span>
              <ArrowRight size={14} aria-hidden="true" />
            </CollectionLink>
          )}
        </div>

        {highlights.length > 0 && (
          <div className="mega-menu-highlights">
            <span className="mega-menu-kicker">Selected pieces</span>
            <div className="mega-menu-highlight-grid">
              {highlights.map((child, index) => (
                <CollectionLink
                  collection={child}
                  key={child.slug}
                  className="mega-menu-highlight"
                  onClick={onClose}
                >
                  <img
                    src={child.image}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    width="420"
                    height="520"
                    style={{ '--menu-item-index': index }}
                  />
                  <span>{child.name}<ArrowRight size={13} aria-hidden="true" /></span>
                </CollectionLink>
              ))}
            </div>
          </div>
        )}

        <Link to={`/collections/${collection.slug}`} className="mega-menu-editorial" onClick={onClose}>
          <img src={collection.bannerImage} alt="" loading="lazy" decoding="async" />
          <span className="mega-menu-editorial-shade" />
          <span className="mega-menu-editorial-copy">
            <span className="eyebrow">Woven with intention</span>
            <span className="mega-menu-editorial-title">A story in every drape.</span>
            <span className="mega-menu-editorial-cta">Discover {collection.name}<ArrowDownRight size={15} aria-hidden="true" /></span>
          </span>
        </Link>
      </div>
    </motion.div>
  );
}

function MobileSubcategoryDrawer({ collection, onClose, reduceMotion }) {
  const closeButtonRef = useRef(null);
  useEffect(() => {
    closeButtonRef.current?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  const trapFocus = (event) => {
    if (event.key !== 'Tab') return;
    const focusable = event.currentTarget.querySelectorAll('button, a[href]');
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  };

  return createPortal(
    <motion.div
      className="mobile-category-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: reduceMotion ? 0 : 0.2 }}
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onClose(true);
      }}
    >
      <motion.section
        className="mobile-category-drawer"
        role="dialog"
        aria-modal="true"
        aria-labelledby="mobile-category-title"
        id={`category-menu-${collection.slug}`}
        onKeyDown={trapFocus}
        initial={{ y: reduceMotion ? 0 : 28 }}
        animate={{ y: 0 }}
        exit={{ y: reduceMotion ? 0 : 20 }}
        transition={{ duration: reduceMotion ? 0 : 0.26, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="mobile-category-drawer-handle" aria-hidden="true" />
        <div className="mobile-category-drawer-heading">
          <div>
            <span className="eyebrow">Explore the collection</span>
            <h2 id="mobile-category-title">{collection.name}</h2>
          </div>
          <button ref={closeButtonRef} type="button" className="mobile-category-close" onClick={() => onClose(true)} aria-label="Close categories">
            <X size={19} aria-hidden="true" />
          </button>
        </div>
        <div className="mobile-category-drawer-links">
          {collection.children.length ? collection.children.map((child, index) => (
            <CollectionLink
              collection={child}
              key={child.slug}
              className="mobile-category-drawer-link"
              onClick={onClose}
            >
              <span className="mobile-category-drawer-image">
                <img src={child.image} alt="" loading="lazy" decoding="async" width="100" height="120" />
              </span>
              <span className="mobile-category-drawer-copy">
                <span className="mega-menu-link-number">{String(index + 1).padStart(2, '0')}</span>
                <span>{child.name}</span>
              </span>
              <ArrowRight size={16} aria-hidden="true" />
            </CollectionLink>
          )) : (
            <p className="mobile-category-empty">
              Explore the considered edit of {collection.name.toLowerCase()} sarees.
            </p>
          )}
        </div>
        <CollectionLink collection={collection} className="mobile-category-view-all" onClick={onClose}>
          View all {collection.name}<ArrowRight size={15} aria-hidden="true" />
        </CollectionLink>
      </motion.section>
    </motion.div>,
    document.body,
  );
}

export default function SecondaryCategoryNavigation({ showCatalogLinks = false }) {
  const location = useLocation();
  const reduceMotion = useReducedMotion();
  const navigationRef = useRef(null);
  const closeTimerRef = useRef(null);
  const menuButtonRefs = useRef(new Map());
  const inputModalityRef = useRef('pointer');
  const mobileModeRef = useRef(window.matchMedia('(max-width: 800px)').matches);
  const [availableCollections, setAvailableCollections] = useState([]);
  const [categoryError, setCategoryError] = useState('');
  const [menuState, setMenuState] = useState(null);
  const openMenu = menuState?.locationKey === location.key ? menuState : null;
  const openCollection = availableCollections.find((item) => item.slug === openMenu?.slug);
  const mobileCollection = openMenu?.source === 'mobile' ? openCollection : null;
  const currentSlug = location.pathname.startsWith('/collections/')
    ? location.pathname.split('/')[2]
    : null;
  const currentCollection = availableCollections.find((item) => item.slug === currentSlug);
  const currentParentSlug = currentCollection?.parent?.slug || currentCollection?.slug;

  useEffect(() => {
    const controller = new AbortController();
    catalogApi.allCategories(controller.signal)
      .then((response) => {
        if (controller.signal.aborted) return;
        const collections = (response.categories || [])
          .filter((category) => Number(category.productCount) > 0)
          .map((category, index) => {
            const fallback = allCollections[index % allCollections.length];
            const image = category.image?.url || fallback.image;
            return {
              ...fallback,
              ...category,
              image,
              bannerImage: image,
              children: [],
              menuEnabled: true,
              parent: null,
            };
          });
        setAvailableCollections(collections);
        setCategoryError('');
      })
      .catch((error) => {
        if (error.name !== 'CanceledError' && error.name !== 'AbortError' && error.code !== 'ERR_CANCELED') {
          setCategoryError(error.response?.data?.message || 'Categories could not be loaded.');
        }
      });
    return () => controller.abort();
  }, []);

  const cancelClose = useCallback(() => {
    window.clearTimeout(closeTimerRef.current);
  }, []);
  const closeMenu = useCallback(() => {
    cancelClose();
    setMenuState(null);
  }, [cancelClose]);
  const closeMobileMenu = (restoreFocus = false) => {
    const slug = openMenu?.slug;
    closeMenu();
    if (restoreFocus === true && slug) {
      window.requestAnimationFrame(() => menuButtonRefs.current.get(slug)?.focus({ preventScroll: true }));
    }
  };
  const scheduleClose = () => {
    if (!['hover', 'keyboard'].includes(openMenu?.source)) return;
    cancelClose();
    closeTimerRef.current = window.setTimeout(() => {
      if (!navigationRef.current?.contains(document.activeElement)) setMenuState(null);
    }, closeDelay);
  };
  const showMenu = (slug, source = 'desktop') => {
    cancelClose();
    setMenuState({ slug, source, locationKey: location.key });
  };
  const toggleMenu = (slug, source) => {
    cancelClose();
    setMenuState((current) => {
      if (current?.locationKey !== location.key || current?.slug !== slug) {
        return { slug, source, locationKey: location.key };
      }
      if (source === 'desktop' && current.source === 'hover') {
        return { ...current, source: 'click' };
      }
      return null;
    });
  };
  const interactionSource = () => window.matchMedia('(max-width: 800px)').matches ? 'mobile' : 'desktop';

  useEffect(() => {
    if (!openMenu) return undefined;
    const handlePointerDown = (event) => {
      if (event.target.closest?.('.mobile-category-overlay')) return;
      if (!navigationRef.current?.contains(event.target)) closeMenu();
    };
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        closeMenu();
        menuButtonRefs.current.get(openMenu.slug)?.focus({ preventScroll: true });
      }
    };
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [openMenu, closeMenu]);

  useEffect(() => {
    const markKeyboardInput = () => { inputModalityRef.current = 'keyboard'; };
    const markPointerInput = () => { inputModalityRef.current = 'pointer'; };
    document.addEventListener('keydown', markKeyboardInput, true);
    document.addEventListener('pointerdown', markPointerInput, true);
    return () => {
      document.removeEventListener('keydown', markKeyboardInput, true);
      document.removeEventListener('pointerdown', markPointerInput, true);
    };
  }, []);

  useEffect(() => {
    const closeOnResize = () => {
      const mobileMode = window.matchMedia('(max-width: 800px)').matches;
      if (mobileMode !== mobileModeRef.current) {
        mobileModeRef.current = mobileMode;
        closeMenu();
      }
    };
    window.addEventListener('resize', closeOnResize);
    return () => window.removeEventListener('resize', closeOnResize);
  }, [closeMenu]);

  useEffect(() => () => cancelClose(), [cancelClose]);

  return (
    <nav
      className="secondary-category-navigation"
      aria-label="Shop by category"
      ref={navigationRef}
      onPointerDownCapture={() => { inputModalityRef.current = 'pointer'; }}
      onKeyDownCapture={() => { inputModalityRef.current = 'keyboard'; }}
      onPointerLeave={(event) => event.pointerType === 'mouse' && scheduleClose()}
      onPointerEnter={(event) => event.pointerType === 'mouse' && cancelClose()}
      onKeyDown={(event) => {
        if (event.key === 'ArrowDown' && openCollection && openMenu?.source !== 'mobile') {
          event.preventDefault();
          document.getElementById(`category-menu-${openCollection.slug}`)?.querySelector('a[href]')?.focus();
        }
      }}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) scheduleClose();
      }}
    >
      <div className="secondary-category-scroll">
        <ul className="secondary-category-list">
          {showCatalogLinks && (
            <>
              <li className={`secondary-category-item secondary-category-overview${location.pathname === '/shop' ? ' is-active' : ''}`}>
                <Link className="secondary-category-label" to="/shop" aria-current={location.pathname === '/shop' ? 'page' : undefined}>All sarees</Link>
              </li>
            </>
          )}
          {categoryError && <li className="secondary-category-load-error" role="status" title={categoryError}>Categories unavailable</li>}
          {availableCollections.map((category, index) => {
            const isOpen = openMenu?.slug === category.slug;
            const canOpenMenu = category.menuEnabled;
            const isActive = currentParentSlug === category.slug;
            return (
              <li
                className={`secondary-category-item${isOpen ? ' is-open' : ''}${isActive ? ' is-active' : ''}${index === 0 || category.slug === 'designer' ? ' is-featured' : ''}`}
                key={category.slug}
                onPointerEnter={(event) => canOpenMenu && event.pointerType === 'mouse' && window.matchMedia('(min-width: 801px) and (hover: hover) and (pointer: fine)').matches && showMenu(category.slug, 'hover')}
                onFocus={() => {
                  const desktopKeyboard = inputModalityRef.current === 'keyboard'
                    && !window.matchMedia('(max-width: 800px)').matches;
                  if (canOpenMenu && desktopKeyboard && openMenu?.slug !== category.slug) {
                    showMenu(category.slug, 'keyboard');
                  }
                }}
              >
                <CollectionLink
                  collection={category}
                  className="secondary-category-label"
                  onClick={closeMenu}
                  aria-current={currentSlug === category.slug ? 'page' : undefined}
                />
                {canOpenMenu && (
                  <button
                    ref={(element) => {
                      if (element) menuButtonRefs.current.set(category.slug, element);
                      else menuButtonRefs.current.delete(category.slug);
                    }}
                    type="button"
                    className="secondary-category-toggle"
                    aria-label={`${isOpen ? 'Close' : 'Open'} ${category.name} collection menu`}
                    aria-expanded={isOpen}
                    aria-controls={isOpen ? `category-menu-${category.slug}` : undefined}
                    onClick={() => toggleMenu(category.slug, interactionSource())}
                  >
                    <ChevronDown size={13} aria-hidden="true" />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </div>
      <AnimatePresence initial={false}>
        {openCollection && openMenu?.source !== 'mobile' && (
          <MegaMenu collection={openCollection} onClose={closeMenu} reduceMotion={reduceMotion} />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {mobileCollection && <MobileSubcategoryDrawer key={mobileCollection.slug} collection={mobileCollection} onClose={closeMobileMenu} reduceMotion={reduceMotion} />}
      </AnimatePresence>
    </nav>
  );
}
