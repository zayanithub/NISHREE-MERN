import test from "node:test";
import assert from "node:assert/strict";
import { buildSitemap, escapeXml, MAX_SITEMAP_URLS } from "../utils/sitemap.js";

test("escapes XML values", () => {
  assert.equal(escapeXml(`a&b <c> "d" 'e'`), "a&amp;b &lt;c&gt; &quot;d&quot; &apos;e&apos;");
});

test("builds a sitemap with unique absolute URLs and last modified dates", () => {
  const sitemap = buildSitemap([
    { path: "/", lastmod: "2026-11-09T12:00:00.000Z" },
    { path: "/", lastmod: "2026-11-08T12:00:00.000Z" },
    { path: "/products/silk-saree&blue" },
    { path: "//external.example/path" },
    { path: "not-an-absolute-path" },
  ]);

  assert.match(sitemap, /<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">/);
  assert.match(sitemap, /<loc>https:\/\/www\.nishree\.in\/<\/loc><lastmod>2026-11-09<\/lastmod>/);
  assert.match(sitemap, /<loc>https:\/\/www\.nishree\.in\/products\/silk-saree&amp;blue<\/loc>/);
  assert.equal((sitemap.match(/<url>/g) || []).length, 2);
  assert.doesNotMatch(sitemap, /external\.example|not-an-absolute-path/);
});

test("limits the sitemap to the protocol maximum", () => {
  const entries = Array.from({ length: MAX_SITEMAP_URLS + 1 }, (_, index) => ({
    path: `/products/${index}`,
  }));
  const sitemap = buildSitemap(entries);

  assert.equal((sitemap.match(/<url>/g) || []).length, MAX_SITEMAP_URLS);
});
