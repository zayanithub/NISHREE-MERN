import { Readable } from "node:stream";
import cloudinary, { assertCloudinaryConfigured } from "../config/cloudinary.js";
import HomepageImage from "../models/HomepageImage.js";

const SECTIONS = ["hero", "category", "editorial", "atelier"];

const DEFAULT_IMAGES = [
  { seedKey: "hero-showroom", section: "hero", url: "/homepage-images/showroom.png", title: "Saree showroom", altText: "A welcoming Nishree saree showroom", sortOrder: 0 },
  { seedKey: "hero-celestial", section: "hero", url: "/homepage-images/celestial-mandala.png", title: "Celestial golden mandala", altText: "A golden mandala-inspired saree editorial", sortOrder: 1 },
  { seedKey: "hero-heavenly", section: "hero", url: "/homepage-images/heavenly-dancer.png", title: "Heavenly saree dancer", altText: "A saree dancer beneath a luminous halo", sortOrder: 2 },
  { seedKey: "hero-neon", section: "hero", url: "/homepage-images/neon-carnival.png", title: "Neon carnival saree", altText: "A vivid saree at a neon carnival", sortOrder: 3 },
  { seedKey: "hero-blush", section: "hero", url: "/homepage-images/blush-arch.png", title: "Regal blush saree", altText: "A blush saree framed by a floral arch", sortOrder: 4 },
  { seedKey: "hero-reflections", section: "hero", url: "/homepage-images/glass-reflections.png", title: "Saree reflections", altText: "A regal saree reflected in glass cubes", sortOrder: 5 },
  { seedKey: "hero-royal", section: "hero", url: "/homepage-images/palace-editorial.png", title: "Royal blue and ivory", altText: "A royal blue and ivory saree in a palace", sortOrder: 6 },
  { seedKey: "category-folded-silk", section: "category", url: "/homepage-images/folded-silk.jpg", title: "Folded silk", altText: "Golden silk folded to show its woven border", sortOrder: 0 },
  { seedKey: "category-flatlay", section: "category", url: "/homepage-images/saree-flatlay.jpg", title: "Saree flatlay", altText: "A saree arranged to show its fabric and details", sortOrder: 1 },
  { seedKey: "category-red-saree", section: "category", url: "/homepage-images/red-saree.jpg", title: "Red saree", altText: "A red saree presented as a collection image", sortOrder: 2 },
  { seedKey: "category-drape-detail", section: "category", url: "/homepage-images/drape-detail.jpg", title: "Drape detail", altText: "A close look at the drape and texture of a saree", sortOrder: 3 },
  { seedKey: "editorial-folded-silk", section: "editorial", url: "/homepage-images/folded-silk.jpg", title: "New arrivals editorial", altText: "Golden silk folded to reveal its woven border", sortOrder: 0 },
  { seedKey: "atelier-showroom", section: "atelier", url: "/homepage-images/showroom.png", title: "Nishree atelier", altText: "A warm boutique interior with sarees displayed throughout", sortOrder: 0 },
];
let seedPromise = null;

const createError = (message, statusCode) => Object.assign(new Error(message), { statusCode });
const validId = (id) => typeof id === "string" && /^[a-f\d]{24}$/i.test(id);
const requireImageStorage = () => {
  try {
    assertCloudinaryConfigured();
  } catch (error) {
    throw createError(error.message, 503);
  }
};

export const seedHomepageImages = async () => {
  if (!seedPromise) {
    seedPromise = (async () => {
      const seededCount = await HomepageImage.countDocuments({
        seedKey: { $in: DEFAULT_IMAGES.map((image) => image.seedKey) },
      });
      if (seededCount === DEFAULT_IMAGES.length) return;
      await HomepageImage.bulkWrite(
        DEFAULT_IMAGES.map((image) => ({
          updateOne: {
            filter: { seedKey: image.seedKey },
            update: {
              $setOnInsert: {
                ...image,
                cloudinaryPublicId: "",
                isDeleted: false,
              },
            },
            upsert: true,
          },
        }))
      );
    })().catch((error) => {
      seedPromise = null;
      throw error;
    });
  }
  return seedPromise;
};

const uploadBuffer = (file) =>
  new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: "nishree-attaire/homepage",
        resource_type: "image",
        allowed_formats: ["jpg", "jpeg", "png", "webp"],
        use_filename: false,
        unique_filename: true,
        overwrite: false,
      },
      (error, result) => {
        if (error) return reject(error);
        if (!result?.secure_url || !result?.public_id) {
          return reject(new Error("Cloudinary did not return valid image details."));
        }
        return resolve({ url: result.secure_url, publicId: result.public_id });
      }
    );
    Readable.from([file.buffer]).pipe(stream);
  });

const removeCloudinaryImage = async (publicId) => {
  if (!publicId) return;
  requireImageStorage();
  const result = await cloudinary.uploader.destroy(publicId, {
    resource_type: "image",
    invalidate: true,
  });
  if (result.result !== "ok" && result.result !== "not found") {
    throw createError("Cloudinary could not remove the previous image.", 502);
  }
};

const cleanupUploads = async (assets) => {
  const results = await Promise.allSettled(
    assets.map((asset) => removeCloudinaryImage(asset.publicId))
  );
  results.filter((result) => result.status === "rejected").forEach((result) => {
    console.error("Homepage image upload cleanup failed:", result.reason?.message);
  });
};

const validateFile = (file) => {
  if (!file || !Buffer.isBuffer(file.buffer) || file.buffer.length === 0) {
    throw createError("The uploaded image is empty or invalid.", 400);
  }
};

const normalizeMetadata = (value, { required = false, maxLength }) => {
  if (value === undefined) return undefined;
  if (typeof value !== "string") throw createError("Image details must be text.", 400);
  const normalized = value.trim();
  if (required && !normalized) throw createError("Image title and alt text are required.", 400);
  if (normalized.length > maxLength) {
    throw createError(`Image details must be ${maxLength} characters or fewer.`, 400);
  }
  return normalized;
};

const sectionMaximum = async (section) =>
  HomepageImage.countDocuments({ section, isDeleted: false });

export const listHomepageImages = async ({ includeDeleted = false } = {}) => {
  const filter = includeDeleted ? {} : { isDeleted: false };
  return HomepageImage.find(filter)
    .sort({ section: 1, sortOrder: 1, createdAt: 1 })
    .lean();
};

export const addHomepageImages = async (section, files, adminId) => {
  if (!SECTIONS.includes(section)) throw createError("Choose a valid homepage image section.", 400);
  if (!Array.isArray(files) || files.length === 0) {
    throw createError("Select at least one image to upload.", 400);
  }
  files.forEach(validateFile);
  assertCloudinaryConfigured();

  const startOrder = await sectionMaximum(section);
  let uploadedAssets = [];
  try {
    const results = await Promise.allSettled(files.map(uploadBuffer));
    uploadedAssets = results
      .filter((result) => result.status === "fulfilled")
      .map((result) => result.value);
    const failed = results.find((result) => result.status === "rejected");
    if (failed) throw createError("One or more images could not be uploaded. Please try again.", 502);

    const documents = uploadedAssets.map((asset, index) => {
      const title = files[index].originalname
        .replace(/\.[^.]+$/, "")
        .replace(/[_-]+/g, " ")
        .trim()
        .slice(0, 120) || "Homepage image";
      return {
        section,
        url: asset.url,
        cloudinaryPublicId: asset.publicId,
        title,
        description: "",
        altText: title.slice(0, 200),
        sortOrder: startOrder + index,
        updatedBy: adminId,
      };
    });
    return await HomepageImage.insertMany(documents);
  } catch (error) {
    await cleanupUploads(uploadedAssets);
    throw error;
  }
};

export const updateHomepageImage = async (id, fields = {}, file, adminId) => {
  if (!validId(id)) throw createError("Invalid homepage image ID.", 400);
  const image = await HomepageImage.findOne({ _id: id, isDeleted: false });
  if (!image) throw createError("Homepage image not found.", 404);

  const title = normalizeMetadata(fields.title, { required: true, maxLength: 120 });
  const description = normalizeMetadata(fields.description, { maxLength: 500 });
  const altText = normalizeMetadata(fields.altText, { required: true, maxLength: 200 });

  let uploadedAsset = null;
  const oldPublicId = image.cloudinaryPublicId;
  try {
    if (file) {
      validateFile(file);
      requireImageStorage();
      try {
        uploadedAsset = await uploadBuffer(file);
      } catch (error) {
        console.error("Homepage image replacement upload failed:", error.message);
        throw createError("The replacement image could not be uploaded. Please try again.", 502);
      }
      image.url = uploadedAsset.url;
      image.cloudinaryPublicId = uploadedAsset.publicId;
    }
    if (title !== undefined) image.title = title;
    if (description !== undefined) image.description = description;
    if (altText !== undefined) image.altText = altText;
    image.updatedBy = adminId;
    await image.save();
  } catch (error) {
    if (uploadedAsset) await cleanupUploads([uploadedAsset]);
    throw error;
  }

  let cleanupWarning = null;
  if (uploadedAsset && oldPublicId) {
    try {
      await removeCloudinaryImage(oldPublicId);
    } catch (error) {
      console.error("Previous homepage image cleanup failed:", error.message);
      cleanupWarning = "The replacement was saved, but the previous stored file could not be cleaned up.";
    }
  }
  return { image, cleanupWarning };
};

export const reorderHomepageImages = async ({ section, imageIds } = {}) => {
  if (!SECTIONS.includes(section) || !Array.isArray(imageIds)) {
    throw createError("A valid image section and ordered image list are required.", 400);
  }
  if (new Set(imageIds).size !== imageIds.length || imageIds.some((id) => !validId(id))) {
    throw createError("The image order contains invalid or duplicate records.", 400);
  }
  const existing = await HomepageImage.find({ section, isDeleted: false })
    .select("_id")
    .lean();
  if (
    existing.length !== imageIds.length ||
    existing.some((image) => !imageIds.includes(String(image._id)))
  ) {
    throw createError("Refresh the image list before saving its order.", 409);
  }
  await HomepageImage.bulkWrite(
    imageIds.map((id, sortOrder) => ({
      updateOne: {
        filter: { _id: id, section, isDeleted: false },
        update: { $set: { sortOrder } },
      },
    }))
  );
  return listHomepageImages();
};

export const deleteHomepageImage = async (id) => {
  if (!validId(id)) throw createError("Invalid homepage image ID.", 400);
  const image = await HomepageImage.findOne({ _id: id, isDeleted: false });
  if (!image) throw createError("Homepage image not found.", 404);
  if (
    image.section === "hero" &&
    (await HomepageImage.countDocuments({ section: "hero", isDeleted: false })) <= 1
  ) {
    throw createError("Keep at least one image in the homepage hero carousel.", 409);
  }

  image.isDeleted = true;
  await image.save();
  if (image.cloudinaryPublicId) {
    try {
      await removeCloudinaryImage(image.cloudinaryPublicId);
    } catch (error) {
      console.error("Deleted homepage image asset cleanup failed:", error.message);
      return { cleanupWarning: "The image was removed, but its stored file could not be cleaned up." };
    }
  }
  return {};
};
