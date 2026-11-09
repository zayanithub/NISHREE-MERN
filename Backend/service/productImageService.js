import { Readable } from "node:stream";

import cloudinary, {
  assertCloudinaryConfigured,
} from "../config/cloudinary.js";

import Product from "../models/Product.js";
import ProductImage from "../models/ProductImage.js";
import {
  hashProductImage,
  validateProductImageFiles,
} from "./productImageValidation.js";

/*
|--------------------------------------------------------------------------
| Common Helpers
|--------------------------------------------------------------------------
*/

const createError = (message, statusCode) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
};

const isValidObjectId = (id) => {
  return (
    typeof id === "string" &&
    /^[a-f\d]{24}$/i.test(id)
  );
};

const validateAdminId = (adminId) => {
  if (!isValidObjectId(String(adminId))) {
    throw createError(
      "A valid authenticated admin ID is required.",
      401
    );
  }
};

/*
|--------------------------------------------------------------------------
| Find Product
|--------------------------------------------------------------------------
*/

const findProduct = async (productId) => {
  if (!isValidObjectId(String(productId))) {
    throw createError(
      "Invalid product ID.",
      400
    );
  }

  const product = await Product.findById(productId);

  if (!product) {
    throw createError(
      "Product not found.",
      404
    );
  }

  return product;
};

/*
|--------------------------------------------------------------------------
| Upload Buffer to Cloudinary
|--------------------------------------------------------------------------
| Multer memoryStorage provides each image as a Buffer.
|--------------------------------------------------------------------------
*/

const uploadBufferToCloudinary = (file, folder) => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: "image",
        allowed_formats: ["jpg", "jpeg", "png", "webp"],
        use_filename: false,
        unique_filename: true,
        overwrite: false,
      },
      (error, result) => {
        if (error) {
          return reject(error);
        }

        if (!result?.secure_url || !result?.public_id) {
          return reject(
            new Error("Cloudinary did not return valid image details.")
          );
        }

        return resolve({
          url: result.secure_url,
          publicId: result.public_id,
        });
      }
    );

    Readable.from([file.buffer]).pipe(uploadStream);
  });
};

/*
|--------------------------------------------------------------------------
| Delete Cloudinary Asset
|--------------------------------------------------------------------------
*/

const destroyCloudinaryImage = async (publicId) => {
  assertCloudinaryConfigured();

  const result = await cloudinary.uploader.destroy(
    publicId,
    {
      resource_type: "image",
      invalidate: true,
    }
  );

  // An already-missing asset can still be removed from our database.
  if (
    result.result !== "ok" &&
    result.result !== "not found"
  ) {
    throw createError(
      "Cloudinary could not delete the image.",
      502
    );
  }

  return result;
};

/*
|--------------------------------------------------------------------------
| Cleanup Helpers
|--------------------------------------------------------------------------
*/

const cleanupCloudinaryAssets = async (assets = []) => {
  const results = await Promise.allSettled(
    assets.map((asset) =>
      destroyCloudinaryImage(asset.publicId)
    )
  );

  results.forEach((result) => {
    if (result.status === "rejected") {
      console.error(
        "Cloudinary cleanup failed:",
        result.reason?.message
      );
    }
  });
};

const parseAltTexts = (value, count) => {
  let values = value;

  if (typeof values === "string") {
    try {
      const parsed = JSON.parse(values);

      values = Array.isArray(parsed)
        ? parsed
        : [values];
    } catch {
      values = [values];
    }
  }

  if (!Array.isArray(values)) {
    values = [];
  }

  return Array.from(
    { length: count },
    (_, index) =>
      String(values[index] ?? "")
        .trim()
        .slice(0, 200)
  );
};

/*
|--------------------------------------------------------------------------
| 1. Upload Product Images
|--------------------------------------------------------------------------
| Product must already exist.
|
| files:
|   Array of files from uploadProductImages middleware.
|
| adminId:
|   Authenticated admin ID from req.admin.adminId.
|
| altTexts:
|   Optional array of image alt text values.
|--------------------------------------------------------------------------
*/

export const uploadProductImages = async (
  productId,
  files,
  adminId,
  altTexts
) => {
  validateAdminId(adminId);
  const hashes = validateProductImageFiles(files);
  assertCloudinaryConfigured();

  const product = await findProduct(productId);
  const contentHashes = hashes;
  const existingHashes = await ProductImage.find({
    product: product._id,
    contentHash: { $in: contentHashes },
  }).select("_id");

  if (existingHashes.length) {
    throw createError("This product already contains one or more of these images.", 409);
  }

  const folder =
    `nishree-attaire/products/${product._id}`;

  /*
   * Determine the next image sort order and whether an
   * initial primary image should be selected.
   */

  const [existingCount, lastImage] = await Promise.all([
    ProductImage.countDocuments({
      product: product._id,
    }),

    ProductImage.findOne({
      product: product._id,
    })
      .sort({ sortOrder: -1 })
      .select("sortOrder")
      .lean(),
  ]);

  const hasLegacyPrimary = existingCount === 0 && Boolean(product.primaryImage?.url);
  const currentImageCount = existingCount + Number(hasLegacyPrimary);
  if (currentImageCount + files.length > 5) {
    throw createError(
      `This product can have up to 5 unique images. It currently has ${currentImageCount}.`,
      400
    );
  }

  const nextSortOrder = Math.max(
    lastImage?.sortOrder ?? -1,
    hasLegacyPrimary ? 0 : -1
  ) + 1;

  const shouldSetPrimary = existingCount === 0 && !hasLegacyPrimary;

  let uploadedAssets = [];
  let savedImages = [];

  const normalizedAltTexts = parseAltTexts(
    altTexts,
    files.length
  );

  try {
    /*
     * Upload images to Cloudinary.
     *
     * Promise.allSettled lets us identify successful uploads
     * even if another file fails, so we can clean them up.
     */

    const uploadResults = await Promise.allSettled(
      files.map((file) =>
        uploadBufferToCloudinary(file, folder)
      )
    );

    uploadedAssets = uploadResults
      .filter((result) => result.status === "fulfilled")
      .map((result) => result.value);

    const failedUpload = uploadResults.find(
      (result) => result.status === "rejected"
    );

    if (failedUpload) {
      console.error(
        "Cloudinary image upload failed:",
        failedUpload.reason?.message
      );

      await cleanupCloudinaryAssets(uploadedAssets);

      throw createError(
        "One or more images could not be uploaded. Please try again.",
        502
      );
    }

    if (hasLegacyPrimary) {
      const legacyImage = await ProductImage.create({
        product: product._id,
        url: product.primaryImage.url,
        publicId: product.primaryImage.publicId || `legacy:${product._id}`,
        contentHash: "",
        altText: product.imageAltText || product.name,
        sortOrder: 0,
        isPrimary: true,
      });
      savedImages.push(legacyImage);
    }

    /*
     * Prepare MongoDB documents only after all uploads succeed.
     */

    const imageDocuments = uploadedAssets.map(
      (asset, index) => ({
        product: product._id,
        url: asset.url,
        publicId: asset.publicId,
        contentHash: hashProductImage(files[index].buffer),
        altText: normalizedAltTexts[index],
        sortOrder: nextSortOrder + index,
        isPrimary: shouldSetPrimary && index === 0,
      })
    );

    savedImages = await ProductImage.insertMany(
      imageDocuments
    );

    /*
     * For a product's first gallery upload, automatically
     * select the first image as the primary image.
     */

    if (shouldSetPrimary) {
      product.primaryImage = {
        url: savedImages[0].url,
        publicId: savedImages[0].publicId,
      };

      product.updatedBy = adminId;

      await product.save();
    }

    return savedImages;
  } catch (error) {
    /*
     * Compensating cleanup in case a database write fails
     * after images have been uploaded.
     */

    if (savedImages.length > 0) {
      try {
        await ProductImage.deleteMany({
          _id: {
            $in: savedImages.map((image) => image._id),
          },
        });
      } catch (cleanupError) {
        console.error(
          "Product image database cleanup failed:",
          cleanupError.message
        );
      }
    }

    await cleanupCloudinaryAssets(uploadedAssets);

    throw error;
  }
};

/*
|--------------------------------------------------------------------------
| 2. List Images For A Product
|--------------------------------------------------------------------------
*/

export const listProductImages = async (productId) => {
  const product = await findProduct(productId);

  const images = await ProductImage.find({
    product: product._id,
  })
    .sort({
      sortOrder: 1,
      createdAt: 1,
    })
    .lean();

  if (!images.length && product.primaryImage?.url) {
    return [{
      _id: null,
      product: product._id,
      url: product.primaryImage.url,
      publicId: product.primaryImage.publicId || "",
      altText: product.imageAltText || product.name,
      sortOrder: 0,
      isPrimary: true,
      isLegacy: true,
    }];
  }

  return images;
};

/*
|--------------------------------------------------------------------------
| 3. Set Primary Product Image
|--------------------------------------------------------------------------
| The selected image must belong to the specified product.
|--------------------------------------------------------------------------
*/

export const setPrimaryProductImage = async (
  productId,
  imageId,
  adminId
) => {
  validateAdminId(adminId);

  const product = await findProduct(productId);

  if (!isValidObjectId(String(imageId))) {
    throw createError(
      "Invalid product image ID.",
      400
    );
  }

  const image = await ProductImage.findOne({
    _id: imageId,
    product: product._id,
  });

  if (!image) {
    throw createError(
      "Image not found for this product.",
      404
    );
  }

  /*
   * Record the current primary selection in case a later
   * database operation fails.
   */

  const previousPrimary = await ProductImage.findOne({
    product: product._id,
    isPrimary: true,
  }).lean();

  const previousProductImage = {
    url: product.primaryImage?.url || "",
    publicId: product.primaryImage?.publicId || "",
  };

  try {
    await ProductImage.updateMany(
      {
        product: product._id,
      },
      {
        $set: {
          isPrimary: false,
        },
      }
    );

    image.isPrimary = true;
    await image.save();

    product.primaryImage = {
      url: image.url,
      publicId: image.publicId,
    };

    product.updatedBy = adminId;
    await product.save();

    return image;
  } catch (error) {
    /*
     * Best-effort restoration if the primary-image update fails.
     */

    try {
      await ProductImage.updateMany(
        {
          product: product._id,
        },
        {
          $set: {
            isPrimary: false,
          },
        }
      );

      if (previousPrimary) {
        await ProductImage.updateOne(
          {
            _id: previousPrimary._id,
            product: product._id,
          },
          {
            $set: {
              isPrimary: true,
            },
          }
        );
      }

      await Product.updateOne(
        {
          _id: product._id,
        },
        {
          $set: {
            primaryImage: previousProductImage,
          },
        }
      );
    } catch (rollbackError) {
      console.error(
        "Primary image rollback failed:",
        rollbackError.message
      );
    }

    throw error;
  }
};

export const reorderProductImages = async (
  productId,
  imageIds,
  adminId
) => {
  validateAdminId(adminId);
  const product = await findProduct(productId);

  if (!Array.isArray(imageIds) || imageIds.length < 1 || imageIds.length > 5) {
    throw createError("Provide the ordered IDs for 1–5 product images.", 400);
  }

  if (new Set(imageIds).size !== imageIds.length ||
    imageIds.some((id) => !isValidObjectId(String(id)))) {
    throw createError("Product image order contains invalid or repeated IDs.", 400);
  }

  const existing = await ProductImage.find({ product: product._id })
    .select("_id")
    .lean();
  const existingIds = new Set(existing.map((image) => String(image._id)));
  if (existingIds.size !== imageIds.length ||
    imageIds.some((id) => !existingIds.has(String(id)))) {
    throw createError("Image order must include each current product image exactly once.", 400);
  }

  await Promise.all(imageIds.map((id, sortOrder) => ProductImage.updateOne(
    { _id: id, product: product._id },
    { $set: { sortOrder } }
  )));

  product.updatedBy = adminId;
  await product.save();
  return listProductImages(product._id);
};

/*
|--------------------------------------------------------------------------
| 4. Delete A Product Image
|--------------------------------------------------------------------------
| If the primary image is removed, select the next available
| image as primary. If no images remain, clear primaryImage.
|--------------------------------------------------------------------------
*/

export const deleteProductImage = async (
  productId,
  imageId,
  adminId
) => {
  validateAdminId(adminId);

  const product = await findProduct(productId);

  if (!isValidObjectId(String(imageId))) {
    throw createError(
      "Invalid product image ID.",
      400
    );
  }

  const image = await ProductImage.findOne({
    _id: imageId,
    product: product._id,
  });

  if (!image) {
    throw createError(
      "Image not found for this product.",
      404
    );
  }

  /*
   * Find a replacement image if the selected image is primary.
   */

  let replacementImage = null;

  if (image.isPrimary) {
    replacementImage = await ProductImage.findOne({
      product: product._id,
      _id: {
        $ne: image._id,
      },
    })
      .sort({
        sortOrder: 1,
        createdAt: 1,
      })
      .lean();
  }

  /*
   * Delete from Cloudinary first.
   * If Cloudinary deletion fails, retain the database record.
   */

  if (!String(image.publicId || "").startsWith("legacy:")) {
    await destroyCloudinaryImage(image.publicId);
  }

  await ProductImage.deleteOne({
    _id: image._id,
    product: product._id,
  });

  if (image.isPrimary) {
    if (replacementImage) {
      await ProductImage.updateMany(
        {
          product: product._id,
        },
        {
          $set: {
            isPrimary: false,
          },
        }
      );

      await ProductImage.updateOne(
        {
          _id: replacementImage._id,
          product: product._id,
        },
        {
          $set: {
            isPrimary: true,
          },
        }
      );

      product.primaryImage = {
        url: replacementImage.url,
        publicId: replacementImage.publicId,
      };
    } else {
      product.primaryImage = {
        url: "",
        publicId: "",
      };
    }

    product.updatedBy = adminId;

    await product.save();
  }

  return {
    id: String(image._id),
    productId: String(product._id),
    message: "Product image deleted successfully.",
  };
};

export const removePrimaryProductImage = async (
  productId,
  adminId
) => {
  validateAdminId(adminId);
  const product = await findProduct(productId);
  const primaryImage = await ProductImage.findOne({
    product: product._id,
    isPrimary: true,
  });

  if (primaryImage) {
    await deleteProductImage(product._id, primaryImage._id, adminId);
    return Product.findById(product._id);
  }

  if (!product.primaryImage?.url) {
    return product;
  }

  if (product.primaryImage.publicId) {
    await destroyCloudinaryImage(product.primaryImage.publicId);
  }

  product.primaryImage = { url: "", publicId: "" };
  product.imageAltText = "";
  product.updatedBy = adminId;
  await product.save();
  return product;
};