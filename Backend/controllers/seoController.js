import BlogPost from "../models/BlogPost.js";
import Category from "../models/Category.js";
import Product from "../models/Product.js";
import { buildSitemap, MAX_SITEMAP_URLS } from "../utils/sitemap.js";

const publicPaths = [
  "/",
  "/new-arrivals",
  "/atelier",
  "/find-your-drape",
  "/product_hub",
  "/blogs",
  "/shop",
  "/about",
  "/contact",
  "/faq",
  "/policies",
  "/policies/terms",
  "/policies/privacy",
  "/policies/returns",
  "/policies/shipping",
  "/collections/new-arrival",
  "/collections/silk",
  "/collections/kanjivaram-silk",
  "/collections/banarasi-silk",
  "/collections/other-silks",
  "/collections/cotton",
  "/collections/silk-cotton",
  "/collections/silk-cotton-raagam",
  "/collections/kanchi-silk-cotton",
  "/collections/maheshwari-silk-cotton",
  "/collections/ikat-silk-cotton",
  "/collections/kuppadam-silk-cotton",
  "/collections/mangalgiri-silk-cotton",
  "/collections/kora-silk-cotton",
  "/collections/tussars",
  "/collections/madhubani-saree",
  "/collections/matka-silk",
  "/collections/tussar",
  "/collections/linens",
  "/collections/fancy",
  "/collections/dupion-silk",
  "/collections/semi-tissue-silks",
  "/collections/semi-mysore-silks",
  "/collections/organza-sarees",
  "/collections/semi-patola-sarees",
  "/collections/jute-sarees",
  "/collections/raw-silks",
  "/collections/modal-silks",
  "/collections/kota-sarees",
  "/collections/dola-silk",
  "/collections/designer",
];

export const getSitemap = async (req, res, next) => {
  try {
    const now = new Date();
    const productFilter = {
      status: "active",
      tags: { $nin: ["catalogue-preview"] },
    };
    const [activeCategories, posts] = await Promise.all([
      Category.find({ isActive: true }).select("_id slug updatedAt").lean(),
      BlogPost.find({
        status: { $in: ["published", "scheduled"] },
        publishAt: { $lte: now },
        $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }],
      })
        .select("slug publishAt updatedAt")
        .sort({ publishAt: -1 })
        .limit(MAX_SITEMAP_URLS)
        .lean(),
    ]);
    const activeCategoryIds = activeCategories.map((category) => category._id);
    const products = await Product.find({
      ...productFilter,
      category: { $in: activeCategoryIds },
    })
      .select("slug updatedAt category")
      .sort({ updatedAt: -1 })
      .limit(MAX_SITEMAP_URLS)
      .lean();
    const categoriesWithProducts = new Set(
      products.map((product) => String(product.category))
    );

    const entries = [
      ...publicPaths.map((path) => ({ path })),
      ...activeCategories
        .filter((category) => categoriesWithProducts.has(String(category._id)))
        .map((category) => ({
          path: `/collections/${encodeURIComponent(category.slug)}`,
          lastmod: category.updatedAt,
        })),
      ...products.filter((product) => product.slug).map((product) => ({
        path: `/products/${encodeURIComponent(product.slug)}`,
        lastmod: product.updatedAt,
      })),
      ...posts.filter((post) => post.slug).map((post) => ({
        path: `/blogs/${encodeURIComponent(post.slug)}`,
        lastmod: post.updatedAt || post.publishAt,
      })),
    ];

    res
      .status(200)
      .type("application/xml")
      .set("Cache-Control", "public, max-age=3600, s-maxage=3600")
      .send(buildSitemap(entries));
  } catch (error) {
    return next(error);
  }
};
