import test from "node:test";
import assert from "node:assert/strict";
import { createBlogPostSchema, updateBlogPostSchema } from "../validations/blogPostValidation.js";

const validPost = () => ({
  title: "A story from the loom",
  slug: "",
  excerpt: "A short introduction to this journal story.",
  category: "Stories",
  contentType: "story",
  contentBlocks: [
    { type: "paragraph", text: "A considered story." },
    { type: "image", url: "/blog-media/weave.webp", altText: "A woven textile" },
  ],
  heroImage: "/blog-media/cover.webp",
  heroImageAlt: "A folded textile",
  mediaType: "image",
  author: "Nishree Attire",
  tags: ["weaving"],
  status: "draft",
  isFeatured: false,
  publishAt: "",
  expiresAt: "",
  ctaLabel: "",
  ctaUrl: "",
  eventDate: "",
  eventLocation: "",
  eventRegistrationUrl: "",
  campaignLabel: "",
});

test("accepts reusable journal posts with safe site-relative media", () => {
  const result = createBlogPostSchema.safeParse(validPost());
  assert.equal(result.success, true);
  assert.equal(result.data.contentBlocks[1].url, "/blog-media/weave.webp");
});

test("rejects protocol-relative media and campaign links", () => {
  const unsafeImage = validPost();
  unsafeImage.heroImage = "//example.com/cover.jpg";
  assert.equal(createBlogPostSchema.safeParse(unsafeImage).success, false);

  const unsafeLink = validPost();
  unsafeLink.ctaUrl = "//example.com";
  assert.equal(createBlogPostSchema.safeParse(unsafeLink).success, false);

  const malformedImage = validPost();
  malformedImage.heroImage = "https://";
  assert.equal(createBlogPostSchema.safeParse(malformedImage).success, false);
});

test("requires publication dates to define a valid scheduled window", () => {
  const scheduled = validPost();
  scheduled.status = "scheduled";
  scheduled.publishAt = new Date(Date.now() + 60_000).toISOString();
  scheduled.expiresAt = new Date(Date.now() + 120_000).toISOString();
  assert.equal(createBlogPostSchema.safeParse(scheduled).success, true);

  scheduled.expiresAt = new Date(Date.now() + 30_000).toISOString();
  assert.equal(createBlogPostSchema.safeParse(scheduled).success, false);

  scheduled.publishAt = new Date(Date.now() - 60_000).toISOString();
  scheduled.expiresAt = "";
  assert.equal(createBlogPostSchema.safeParse(scheduled).success, false);
});

test("allows non-empty partial updates without requiring create-only fields", () => {
  const result = updateBlogPostSchema.safeParse({ status: "archived" });
  assert.equal(result.success, true);
  assert.deepEqual(result.data, { status: "archived" });
  assert.equal(updateBlogPostSchema.safeParse({}).success, false);
  assert.equal(updateBlogPostSchema.safeParse({ unknownField: true }).success, false);
  assert.equal(updateBlogPostSchema.safeParse({ contentBlocks: [{ type: "image" }] }).success, false);
});
