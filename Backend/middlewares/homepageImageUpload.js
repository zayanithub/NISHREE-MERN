import multer from "multer";
import path from "node:path";

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const MAX_IMAGES = 8;
const allowedImageTypes = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_IMAGE_SIZE,
    files: MAX_IMAGES,
    fields: 10,
    parts: MAX_IMAGES + 10,
  },
  fileFilter: (_req, file, callback) => {
    const extension = path.extname(file.originalname || "").toLowerCase();
    if (allowedImageTypes[extension] !== file.mimetype) {
      const error = new Error(
        "Invalid image format. Only JPG, JPEG, PNG and WEBP images are allowed."
      );
      error.statusCode = 400;
      return callback(error);
    }
    return callback(null, true);
  },
});

const handleUpload = (upload) => (req, res, next) => {
  upload(req, res, (error) => {
    if (!error) return next();

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
          message: "Upload a maximum of 8 images per request.",
        });
      }
      return res.status(400).json({
        success: false,
        message: "Invalid image upload request.",
      });
    }

    if (error.statusCode === 400) {
      return res.status(400).json({ success: false, message: error.message });
    }
    return next(error);
  });
};

export const uploadHomepageImages = handleUpload(imageUpload.array("images", MAX_IMAGES));
export const replaceHomepageImage = handleUpload(imageUpload.single("image"));
