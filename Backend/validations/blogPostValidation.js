import { z } from "zod";

const safeUrl = z.string()
  .trim()
  .max(2048)
  .refine((value) => {
    if (!value || (value.startsWith("/") && !value.startsWith("//"))) return true;
    try {
      const url = new URL(value);
      return ["http:", "https:"].includes(url.protocol) && Boolean(url.hostname);
    } catch {
      return false;
    }
  }, "Use an HTTP(S) URL or a site-relative path.");

const optionalDate = z.preprocess(
  (value) => value === "" || value == null ? null : value,
  z.coerce.date().nullable()
);

const contentBlockSchema = z.object({
  type: z.enum(["paragraph", "heading", "quote", "image", "video", "link"]),
  text: z.string().trim().max(12000).default(""),
  url: safeUrl.optional().default(""),
  altText: z.string().trim().max(200).optional().default(""),
}).strict();
const contentBlocksSchema = z.array(contentBlockSchema).max(100).superRefine((blocks, context) => {
  if (blocks.some((block) => ["image", "video", "link"].includes(block.type) && !block.url)) {
    context.addIssue({ code: "custom", message: "Image, video, and link blocks need a safe URL." });
  }
});

const blogPostFields = {
  title: z.string().trim().min(1).max(180),
  slug: z.string().trim().max(200).optional().default(""),
  excerpt: z.string().trim().min(1).max(500),
  category: z.string().trim().min(1).max(80),
  contentType: z.enum(["story", "festival", "product", "event", "promotion", "guide", "announcement", "update", "campaign"]),
  contentBlocks: contentBlocksSchema,
  heroImage: safeUrl,
  heroImageAlt: z.string().trim().min(1).max(200),
  mediaUrl: safeUrl.optional().default(""),
  mediaType: z.enum(["image", "video"]).default("image"),
  author: z.string().trim().min(1).max(100).default("Nishree Attire"),
  tags: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
  status: z.enum(["draft", "scheduled", "published", "archived"]).default("draft"),
  isFeatured: z.preprocess((value) => value === true || value === "true", z.boolean()).default(false),
  publishAt: optionalDate,
  expiresAt: optionalDate,
  ctaLabel: z.string().trim().max(80).optional().default(""),
  ctaUrl: safeUrl.optional().default(""),
  eventDate: optionalDate,
  eventLocation: z.string().trim().max(200).optional().default(""),
  eventRegistrationUrl: safeUrl.optional().default(""),
  campaignLabel: z.string().trim().max(120).optional().default(""),
};
const withoutDefault = (schema) => (
  typeof schema.removeDefault === "function" ? schema.removeDefault() : schema
);
const updateBlogPostFields = Object.fromEntries(
  Object.entries(blogPostFields).map(([field, schema]) => [field, withoutDefault(schema)])
);

export const createBlogPostSchema = z.object(blogPostFields).strict().superRefine((post, context) => {
  if (post.expiresAt && post.publishAt && post.expiresAt <= post.publishAt) {
    context.addIssue({ code: "custom", path: ["expiresAt"], message: "Expiry must be later than the publication date." });
  }
  if (post.status === "scheduled" && (!post.publishAt || post.publishAt <= new Date())) {
    context.addIssue({ code: "custom", path: ["publishAt"], message: "Scheduled posts need a future publication date." });
  }
});

export const updateBlogPostSchema = z.object(updateBlogPostFields).partial().strict()
  .refine((post) => Object.keys(post).length > 0, "Provide at least one post field to update.");
