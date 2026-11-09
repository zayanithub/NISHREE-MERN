export const SITE_ORIGIN = "https://www.nishree.in";
export const MAX_SITEMAP_URLS = 50_000;

export const escapeXml = (value) => String(value)
  .replaceAll("&", "&amp;")
  .replaceAll("<", "&lt;")
  .replaceAll(">", "&gt;")
  .replaceAll('"', "&quot;")
  .replaceAll("'", "&apos;");

export const buildSitemap = (entries, siteOrigin = SITE_ORIGIN) => {
  const origin = siteOrigin.replace(/\/$/, "");
  const uniqueEntries = new Map();
  for (const entry of entries) {
    if (!entry?.path || !entry.path.startsWith("/") || entry.path.startsWith("//")) {
      continue;
    }
    if (!uniqueEntries.has(entry.path) || (!uniqueEntries.get(entry.path) && entry.lastmod)) {
      uniqueEntries.set(entry.path, entry.lastmod);
    }
  }

  const urls = [...uniqueEntries.entries()]
    .slice(0, MAX_SITEMAP_URLS)
    .map(([path, lastmod]) => {
      const location = escapeXml(`${origin}${path}`);
      const modified = lastmod ? new Date(lastmod) : null;
      const lastmodTag = modified && Number.isFinite(modified.getTime())
        ? `<lastmod>${modified.toISOString().slice(0, 10)}</lastmod>`
        : "";
      return `<url><loc>${location}</loc>${lastmodTag}</url>`;
    });

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls,
    "</urlset>",
  ].join("");
};
