import { useEffect } from 'react';

const SITE_ORIGIN = (import.meta.env.VITE_SITE_URL || 'https://www.nishree.in').replace(/\/$/, '');
const JSON_LD_ID = 'nishree-seo-jsonld';

export function absoluteSiteUrl(value) {
  if (typeof value !== 'string' || !value.trim()) return '';
  try {
    const url = new URL(value.trim(), SITE_ORIGIN);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
  } catch {
    return '';
  }
}

function setMeta(attribute, key, content) {
  let element = document.head.querySelector(`meta[${attribute}="${key}"]`);
  if (!element) {
    element = document.createElement('meta');
    element.setAttribute(attribute, key);
    document.head.appendChild(element);
  }
  element.content = content;
}

function setLink(rel, href) {
  let element = document.head.querySelector(`link[rel="${rel}"]`);
  if (!element) {
    element = document.createElement('link');
    element.rel = rel;
    document.head.appendChild(element);
  }
  element.href = href;
}

export function applySeoMeta({
  title,
  description,
  path = window.location.pathname,
  image = '/homepage-images/saree-flatlay.jpg',
  type = 'website',
  robots = 'index,follow',
  structuredData,
}) {
  const canonicalUrl = new URL(path, SITE_ORIGIN);
  canonicalUrl.search = '';
  canonicalUrl.hash = '';
  const imageUrl = absoluteSiteUrl(image);
  const safeDescription = String(description || '').replace(/\s+/g, ' ').trim().slice(0, 160);

  document.title = title;
  setMeta('name', 'description', safeDescription);
  setMeta('name', 'robots', robots);
  setLink('canonical', canonicalUrl.href);
  setMeta('property', 'og:type', type);
  setMeta('property', 'og:site_name', 'Nishree Attire');
  setMeta('property', 'og:title', title);
  setMeta('property', 'og:description', safeDescription);
  setMeta('property', 'og:url', canonicalUrl.href);
  setMeta('property', 'og:image', imageUrl);
  setMeta('name', 'twitter:card', 'summary_large_image');
  setMeta('name', 'twitter:title', title);
  setMeta('name', 'twitter:description', safeDescription);
  setMeta('name', 'twitter:image', imageUrl);

  let jsonLd = document.getElementById(JSON_LD_ID);
  if (!structuredData) {
    jsonLd?.remove();
    return;
  }
  if (!jsonLd) {
    jsonLd = document.createElement('script');
    jsonLd.id = JSON_LD_ID;
    jsonLd.type = 'application/ld+json';
    document.head.appendChild(jsonLd);
  }
  jsonLd.textContent = JSON.stringify(structuredData);
}

export function useSeoMeta(metadata) {
  const structuredDataJson = metadata.structuredData
    ? JSON.stringify(metadata.structuredData)
    : '';
  const {
    title,
    description,
    path,
    image,
    type,
    robots,
  } = metadata;

  useEffect(() => {
    applySeoMeta({
      title,
      description,
      path,
      image,
      type,
      robots,
      structuredData: structuredDataJson ? JSON.parse(structuredDataJson) : undefined,
    });
  }, [description, image, path, robots, structuredDataJson, title, type]);
}

export { SITE_ORIGIN };
