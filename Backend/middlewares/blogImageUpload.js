import multer from "multer";
import path from "node:path";

const allowedTypes = new Map([
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".png", "image/png"],
  [".webp", "image/webp"],
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 30, parts: 31 },
  fileFilter: (_req, file, callback) => {
    const extension = path.extname(file.originalname || "").toLowerCase();
    if (allowedTypes.get(extension) !== file.mimetype) {
      return callback(Object.assign(
        new Error("Choose a JPG, PNG or WEBP image."),
        { statusCode: 400 }
      ));
    }
    return callback(null, true);
  },
});

export const uploadBlogImage = (req, res, next) => {
  upload.single("image")(req, res, (error) => {
    if (!error) return next();
    if (error instanceof multer.MulterError) {
      const tooLarge = error.code === "LIMIT_FILE_SIZE";
      return res.status(tooLarge ? 413 : 400).json({
        success: false,
        message: tooLarge ? "Images must be 5 MB or smaller." : "Upload one image at a time.",
      });
    }
    if (error.statusCode === 400) {
      return res.status(400).json({ success: false, message: error.message });
    }
    return next(error);
  });
};
