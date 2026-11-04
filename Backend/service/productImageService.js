import { Readable } from "node:stream";

import cloudinary, {
  assertCloudinaryConfigured,
} from "../config/cloudinary.js";

import Product from "../models/Product.js";
import ProductImage from "../models/ProductImage.js";

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
  assertCloudinaryConfigured();

  if (!Array.isArray(files) || files.length === 0) {
    throw createError(
      "Please provide at least one image.",
      400
    );
  }

  if (files.length > 8) {
    throw createError(
      "A maximum of 8 images can be uploaded at a time.",
      400
    );
  }

  for (const file of files) {
    if (
      !Buffer.isBuffer(file.buffer) ||
      file.buffer.length === 0
    ) {
      throw createError(
        "An uploaded image is invalid or empty.",
        400
      );
    }
  }

  const product = await findProduct(productId);

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

  const nextSortOrder =
    (lastImage?.sortOrder ?? -1) + 1;

  const shouldSetPrimary = existingCount === 0;

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

    /*
     * Prepare MongoDB documents only after all uploads succeed.
     */

    const imageDocuments = uploadedAssets.map(
      (asset, index) => ({
        product: product._id,
        url: asset.url,
        publicId: asset.publicId,
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
      isPrimary: -1,
      sortOrder: 1,
      createdAt: 1,
    })
    .lean();

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

  await destroyCloudinaryImage(image.publicId);

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