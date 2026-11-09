import multer from "multer";
import path from "node:path";

/*
|--------------------------------------------------------------------------
| Product Image Upload Configuration
|--------------------------------------------------------------------------
*/

const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5 MB per image
const MAX_IMAGES = 5;

/*
|--------------------------------------------------------------------------
| Allowed Image Types
|--------------------------------------------------------------------------
| Accept JPEG, PNG and WEBP only.
*/

const allowedImageTypes = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

/*
|--------------------------------------------------------------------------
| File Filter
|--------------------------------------------------------------------------
*/

const productImageFileFilter = (req, file, callback) => {
  const extension = path
    .extname(file.originalname || "")
    .toLowerCase();

  const expectedMimeType = allowedImageTypes[extension];

  const validExtensionAndMime =
    expectedMimeType &&
    file.mimetype === expectedMimeType;

  if (!validExtensionAndMime) {
    const error = new Error(
      "Invalid image format. Only JPG, JPEG, PNG and WEBP images are allowed."
    );

    error.statusCode = 400;

    return callback(error);
  }

  return callback(null, true);
};

/*
|--------------------------------------------------------------------------
| Multer Configuration
|--------------------------------------------------------------------------
*/

const upload = multer({
  storage: multer.memoryStorage(),

  limits: {
    fileSize: MAX_IMAGE_SIZE,
    files: MAX_IMAGES,
    fields: 10,
    parts: MAX_IMAGES + 10,
  },

  fileFilter: productImageFileFilter,
});

/*
|--------------------------------------------------------------------------
| Product Images Middleware
|--------------------------------------------------------------------------
| Expected multipart/form-data field name: images
| Maximum: 5 images per request
| Maximum size: 5 MB per image
|--------------------------------------------------------------------------
*/

export const uploadProductImages = (req, res, next) => {
  upload.array("images", MAX_IMAGES)(req, res, (error) => {
    if (!error) {
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({
          success: false,
          message: "Please select at least one image to upload.",
        });
      }

      return next();
    }

    /*
     * Handle Multer-specific errors.
     */

    if (error instanceof multer.MulterError) {
      if (error.code === "LIMIT_FILE_SIZE") {
        return res.status(413).json({
          success: false,
          message: "Each image must be 5 MB or smaller.",
        });
      }

      if (
        error.code === "LIMIT_FILE_COUNT" ||
        error.code === "LIMIT_UNEXPECTED_FILE"
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Upload a maximum of 5 images using the field name 'images'.",
        });
      }

      if (
        error.code === "LIMIT_FIELD_COUNT" ||
        error.code === "LIMIT_PART_COUNT"
      ) {
        return res.status(400).json({
          success: false,
          message: "Too many form fields were provided.",
        });
      }

      return res.status(400).json({
        success: false,
        message: "Invalid image upload request.",
      });
    }

    /*
     * Handle unsupported file types.
     */

    if (error.statusCode === 400) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    return next(error);
  });
};

export default uploadProductImages;