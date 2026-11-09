import { Readable } from "node:stream";
import BlogPost from "../models/BlogPost.js";
import cloudinary, { assertCloudinaryConfigured } from "../config/cloudinary.js";
import { createBlogPostSchema, updateBlogPostSchema } from "../validations/blogPostValidation.js";

const slugify = (value) => value.toLowerCase().normalize("NFKD")
  .replace(/[\u0300-\u036f]/g, "")
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/^-|-$/g, "");
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const createError = (message, statusCode) => Object.assign(new Error(message), { statusCode });
const validId = (id) => typeof id === "string" && /^[a-f\d]{24}$/i.test(id);

const parseBody = (body, { partial = false } = {}) => {
  const parsed = { ...body };
  for (const field of ["contentBlocks", "tags"]) {
    if (typeof parsed[field] === "string") {
      try {
        parsed[field] = JSON.parse(parsed[field]);
      } catch {
        throw createError(`${field} must be valid JSON.`, 400);
      }
    }
  }
  const schema = partial ? updateBlogPostSchema : createBlogPostSchema;
  const result = schema.safeParse(parsed);
  if (!result.success) {
    throw createError(JSON.stringify(result.error.issues.map((issue) => ({
      field: issue.path.join("."),
      message: issue.message,
    }))), 400);
  }
  return result.data;
};

const publicationFilter = (now = new Date()) => ({
  status: { $in: ["published", "scheduled"] },
  publishAt: { $lte: now },
  $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }],
});

const normalizePublication = (post) => {
  if (post.mediaType === "video" && !post.mediaUrl) {
    throw createError("Add a video URL for a video feature.", 400);
  }
  if (post.status === "published" && !post.publishAt) post.publishAt = new Date();
  if (post.status === "scheduled" && (!post.publishAt || post.publishAt <= new Date())) {
    throw createError("Choose a future publication date for a scheduled post.", 400);
  }
  if (post.expiresAt && post.publishAt && post.expiresAt <= post.publishAt) {
    throw createError("Expiry must be later than the publication date.", 400);
  }
};

const allocateSlug = async (title, requestedSlug, exceptId) => {
  const base = slugify(requestedSlug || title);
  if (!base) throw createError("A title is required to create a post URL.", 400);
  let candidate = base.slice(0, 180);
  let suffix = 2;
  while (await BlogPost.exists({ slug: candidate, ...(exceptId ? { _id: { $ne: exceptId } } : {}) })) {
    candidate = `${base.slice(0, 170)}-${suffix}`;
    suffix += 1;
  }
  return candidate;
};

const uploadImage = async (file) => {
  if (!file) return null;
  if (!Buffer.isBuffer(file.buffer) || file.buffer.length === 0) {
    throw createError("The uploaded image is empty or invalid.", 400);
  }
  assertCloudinaryConfigured();
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: "nishree-attaire/blogs",
        resource_type: "image",
        allowed_formats: ["jpg", "jpeg", "png", "webp"],
        use_filename: false,
        unique_filename: true,
        overwrite: false,
      },
      (error, result) => {
        if (error) return reject(error);
        if (!result?.secure_url || !result?.public_id) {
          return reject(new Error("Image storage did not return valid image details."));
        }
        return resolve({ url: result.secure_url, publicId: result.public_id });
      }
    );
    Readable.from([file.buffer]).pipe(stream);
  });
};

const removeUploadedImage = async (publicId) => {
  if (!publicId) return;
  assertCloudinaryConfigured();
  const result = await cloudinary.uploader.destroy(publicId, { resource_type: "image", invalidate: true });
  if (result.result !== "ok" && result.result !== "not found") {
    throw createError("The previous blog image could not be removed from storage.", 502);
  }
};

const imageCleanupWarning = async (publicId, context) => {
  try {
    await removeUploadedImage(publicId);
    return null;
  } catch (error) {
    console.error(`Blog image cleanup failed after ${context}:`, error.message);
    return "The post was saved, but its previous image could not be removed from storage.";
  }
};

export const listPublicBlogPosts = async ({ search = "", category = "", sort = "latest", page = 1, limit = 9 } = {}) => {
  const safePage = Math.max(1, Number.parseInt(page, 10) || 1);
  const safeLimit = Math.min(24, Math.max(1, Number.parseInt(limit, 10) || 9));
  const filter = publicationFilter();
  if (category && category !== "all") filter.category = category;
  const needle = String(search).trim().slice(0, 120);
  if (needle) {
    const expression = new RegExp(escapeRegex(needle), "i");
    filter.$and = [{ $or: [
      { title: expression },
      { excerpt: expression },
      { category: expression },
      { tags: expression },
    ] }];
  }
  const sorts = {
    latest: { publishAt: -1, _id: -1 },
    popular: { views: -1, publishAt: -1 },
    featured: { isFeatured: -1, publishAt: -1 },
  };
  const now = new Date();
  const projection = "title slug excerpt category contentType heroImage heroImageAlt mediaType author tags publishAt expiresAt isFeatured views readingMinutes ctaLabel ctaUrl eventDate eventLocation campaignLabel mediaUrl";
  const [posts, total, featured, trending, upcomingEvents, campaigns, productHighlights, categoryRows] = await Promise.all([
    BlogPost.find(filter).select(projection).sort(sorts[sort] || sorts.latest).skip((safePage - 1) * safeLimit).limit(safeLimit).lean(),
    BlogPost.countDocuments(filter),
    BlogPost.find({ ...publicationFilter(now), isFeatured: true }).select(projection).sort({ publishAt: -1 }).limit(3).lean(),
    BlogPost.find(publicationFilter(now)).select(projection).sort({ views: -1, publishAt: -1 }).limit(4).lean(),
    BlogPost.find({ ...publicationFilter(now), contentType: "event", eventDate: { $gte: now } }).select(projection).sort({ eventDate: 1 }).limit(3).lean(),
    BlogPost.find({ ...publicationFilter(now), contentType: { $in: ["promotion", "campaign"] } }).select(projection).sort({ publishAt: -1 }).limit(3).lean(),
    BlogPost.find({ ...publicationFilter(now), contentType: "product" }).select(projection).sort({ publishAt: -1 }).limit(3).lean(),
    BlogPost.distinct("category", publicationFilter(now)),
  ]);
  return {
    posts,
    featured,
    trending,
    upcomingEvents,
    campaigns,
    productHighlights,
    categories: categoryRows.sort((left, right) => left.localeCompare(right)),
    pagination: { page: safePage, limit: safeLimit, total, totalPages: Math.ceil(total / safeLimit) },
  };
};

export const getPublicBlogPost = async (slug) => {
  const filter = { ...publicationFilter(), slug };
  const post = await BlogPost.findOneAndUpdate(filter, { $inc: { views: 1 } }, { new: true }).lean();
  if (!post) throw createError("This story could not be found.", 404);
  const relatedFilter = {
    ...publicationFilter(),
    category: post.category,
    _id: { $ne: post._id },
  };
  const [sameCategoryStories, previous, next] = await Promise.all([
    BlogPost.find(relatedFilter).select("title slug excerpt category heroImage heroImageAlt publishAt author").sort({ publishAt: -1 }).limit(3).lean(),
    BlogPost.findOne({ ...publicationFilter(), publishAt: { $lt: post.publishAt } })
      .select("title slug").sort({ publishAt: -1 }).lean(),
    BlogPost.findOne({ ...publicationFilter(), publishAt: { $gt: post.publishAt } })
      .select("title slug").sort({ publishAt: 1 }).lean(),
  ]);
  const related = [...sameCategoryStories];
  if (related.length < 3) {
    const excludedIds = [post._id, ...related.map((story) => story._id)];
    const additionalStories = await BlogPost.find({
      ...publicationFilter(),
      _id: { $nin: excludedIds },
      category: { $ne: post.category },
    })
      .select("title slug excerpt category heroImage heroImageAlt publishAt author")
      .sort({ isFeatured: -1, views: -1, publishAt: -1 })
      .limit(3 - related.length)
      .lean();
    related.push(...additionalStories);
  }
  return { post, related, previous, next };
};

export const listAdminBlogPosts = async ({ search = "", status = "", page = 1, limit = 20 } = {}) => {
  const safePage = Math.max(1, Number.parseInt(page, 10) || 1);
  const safeLimit = Math.min(100, Math.max(1, Number.parseInt(limit, 10) || 20));
  const filter = {};
  if (status && ["draft", "scheduled", "published", "archived"].includes(status)) filter.status = status;
  const needle = String(search).trim().slice(0, 120);
  if (needle) {
    const expression = new RegExp(escapeRegex(needle), "i");
    filter.$or = [{ title: expression }, { category: expression }, { slug: expression }];
  }
  const [posts, total] = await Promise.all([
    BlogPost.find(filter).select("-contentBlocks").sort({ updatedAt: -1 }).skip((safePage - 1) * safeLimit).limit(safeLimit).lean(),
    BlogPost.countDocuments(filter),
  ]);
  return { posts, pagination: { page: safePage, limit: safeLimit, total, totalPages: Math.ceil(total / safeLimit) } };
};

export const getAdminBlogPost = async (id) => {
  if (!validId(id)) throw createError("Invalid post ID.", 400);
  const post = await BlogPost.findById(id).lean();
  if (!post) throw createError("Post not found.", 404);
  return post;
};

export const createBlogPost = async (body, file, adminId) => {
  const data = parseBody(body);
  normalizePublication(data);
  const image = await uploadImage(file);
  if (image) {
    data.heroImage = image.url;
    data.heroImagePublicId = image.publicId;
  }
  if (!data.heroImage) {
    if (image) await imageCleanupWarning(image.publicId, "a missing cover image");
    throw createError("Add a featured image URL or upload a featured image.", 400);
  }
  data.slug = await allocateSlug(data.title, data.slug);
  try {
    const post = await BlogPost.create({ ...data, createdBy: adminId, updatedBy: adminId });
    return post.toObject();
  } catch (error) {
    if (image) await imageCleanupWarning(image.publicId, "a failed post creation");
    if (error.code === 11000) throw createError("A post with this URL already exists.", 409);
    throw error;
  }
};

export const updateBlogPost = async (id, body, file, adminId) => {
  if (!validId(id)) throw createError("Invalid post ID.", 400);
  const existing = await BlogPost.findById(id);
  if (!existing) throw createError("Post not found.", 404);
  const data = parseBody(body, { partial: true });
  const candidate = { ...existing.toObject(), ...data };
  normalizePublication(candidate);
  if (data.status === "published" && !data.publishAt && !existing.publishAt) {
    data.publishAt = candidate.publishAt;
  }
  if (data.title || data.slug) data.slug = await allocateSlug(candidate.title, data.slug || candidate.slug, id);
  const image = await uploadImage(file);
  if (image) {
    data.heroImage = image.url;
    data.heroImagePublicId = image.publicId;
  }
  try {
    Object.assign(existing, data, { updatedBy: adminId });
    await existing.save();
  } catch (error) {
    if (image) await imageCleanupWarning(image.publicId, "a failed post update");
    if (error.code === 11000) throw createError("A post with this URL already exists.", 409);
    throw error;
  }
  const cleanupWarning = image && candidate.heroImagePublicId !== image.publicId
    ? await imageCleanupWarning(candidate.heroImagePublicId, "a post image replacement")
    : null;
  return { post: existing.toObject(), cleanupWarning };
};

export const deleteBlogPost = async (id) => {
  if (!validId(id)) throw createError("Invalid post ID.", 400);
  const post = await BlogPost.findByIdAndDelete(id).lean();
  if (!post) throw createError("Post not found.", 404);
  const cleanupWarning = await imageCleanupWarning(post.heroImagePublicId, "post deletion");
  return { cleanupWarning };
};
