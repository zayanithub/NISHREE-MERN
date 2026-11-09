import { useLocation } from 'react-router-dom';
import { SITE_ORIGIN, useSeoMeta } from '../utils/seo';

const publicPages = {
  '/': {
    title: 'Nishree Attire | Sarees for Every Moment',
    description: 'Discover handpicked silk, cotton and designer sarees at Nishree Attire. Find a considered drape for weddings, celebrations and everyday moments.',
  },
  '/new-arrivals': {
    title: 'New Arrival Sarees | Nishree Attire',
    description: 'Explore the latest saree arrivals at Nishree Attire, with fresh colours, considered details and graceful drapes for the season.',
  },
  '/atelier': {
    title: 'The Nishree Atelier | Saree Stories',
    description: 'Step into the Nishree Attire atelier for thoughtful saree stories, craft, styling and inspiration for the moments that matter.',
  },
  '/find-your-drape': {
    title: 'Find Your Saree | Nishree Attire',
    description: 'Find a saree to suit your style, occasion and preferred fabric with the Nishree Attire drape guide.',
  },
  '/product_hub': {
    title: 'Saree Collections | Nishree Attire',
    description: 'Explore saree collections at Nishree Attire, from traditional silk and breathable cotton to distinctive designer drapes.',
  },
  '/blogs': {
    title: 'Saree Stories, Guides & Journal | Nishree Attire',
    description: 'Read the Nishree Attire journal for saree guides, styling ideas, stories of craft and inspiration for special occasions.',
  },
  '/shop': {
    title: 'Shop Sarees Online | Nishree Attire',
    description: 'Shop sarees online at Nishree Attire. Explore silk, cotton and designer sarees selected for thoughtful style and graceful draping.',
  },
  '/about': {
    title: 'Our Story | Nishree Attire',
    description: 'Get to know Nishree Attire, our point of view and our considered selection of sarees for personal, memorable moments.',
  },
  '/contact': {
    title: 'Contact Nishree Attire | Customer Care',
    description: 'Contact Nishree Attire for help with sarees, orders, delivery, returns or styling. Our team is here to help.',
  },
  '/faq': {
    title: 'Frequently Asked Questions | Nishree Attire',
    description: 'Find answers to common questions about Nishree Attire orders, payments, shipping, returns and saree care.',
  },
  '/policies': {
    title: 'Store Policies | Nishree Attire',
    description: 'Review Nishree Attire shopping, privacy, shipping and returns policies before placing an order.',
  },
};

const privatePath = /^\/(?:admin|account|checkout|bag|cart|login|register|forgot-password|orders|wishlist)(?:\/|$)/;
const indexableQueryKeys = new Set([
  'search', 'category', 'categories', 'material', 'occasion', 'color',
  'minPrice', 'maxPrice', 'available', 'sort', 'page', 'q',
]);

function getRouteMetadata(pathname) {
  if (privatePath.test(pathname)) {
    return {
      title: 'Your Nishree Account',
      description: 'Sign in to your Nishree Attire account.',
      robots: 'noindex,nofollow',
    };
  }

  if (pathname.startsWith('/products/')) {
    return {
      title: 'Saree Details | Nishree Attire',
      description: 'Explore saree details, fabric and availability at Nishree Attire.',
    };
  }
  if (pathname.startsWith('/blogs/')) {
    return {
      title: 'Nishree Attire Journal',
      description: 'Read stories, guides and inspiration from Nishree Attire.',
    };
  }
  if (pathname.startsWith('/collections/')) {
    const collectionName = pathname.split('/').filter(Boolean).at(-1)
      .split('-').map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
    return {
      title: `${collectionName} Sarees | Nishree Attire`,
      description: `Explore the ${collectionName.toLowerCase()} saree collection at Nishree Attire.`,
    };
  }
  if (pathname.startsWith('/policies/')) {
    const section = pathname.split('/').filter(Boolean).at(-1);
    const sectionName = section.charAt(0).toUpperCase() + section.slice(1);
    return {
      title: `${sectionName} Policy | Nishree Attire`,
      description: `Read the Nishree Attire ${sectionName.toLowerCase()} policy and find helpful information for your order.`,
    };
  }

  return publicPages[pathname] || {
    title: 'Page Not Found | Nishree Attire',
    description: 'The page you are looking for could not be found at Nishree Attire.',
    robots: 'noindex,follow',
  };
}

export default function RouteSeo() {
  const location = useLocation();
  const metadata = getRouteMetadata(location.pathname);
  const query = new URLSearchParams(location.search);
  const hasIndexableFilters = [...query.keys()].some((key) => indexableQueryKeys.has(key));
  const robots = metadata.robots || (hasIndexableFilters ? 'noindex,follow' : 'index,follow');
  const structuredData = location.pathname === '/'
    ? [
      {
        '@context': 'https://schema.org',
        '@type': 'Organization',
        name: 'Nishree Attire',
        url: `${SITE_ORIGIN}/`,
        logo: `${SITE_ORIGIN}/favicon.svg`,
      },
      {
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: 'Nishree Attire',
        url: `${SITE_ORIGIN}/`,
        potentialAction: {
          '@type': 'SearchAction',
          target: `${SITE_ORIGIN}/shop?search={search_term_string}`,
          'query-input': 'required name=search_term_string',
        },
      },
    ]
    : undefined;

  useSeoMeta({
    ...metadata,
    path: location.pathname,
    robots,
    structuredData,
  });
  return null;
}
