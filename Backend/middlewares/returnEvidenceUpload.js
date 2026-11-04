import multer from "multer";
import path from "node:path";

const accepted = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024, files: 5, fields: 0, parts: 5 },
  fileFilter(_req, file, callback) {
    const extension = path.extname(file.originalname || "").toLowerCase();
    if (!accepted[extension] || accepted[extension] !== file.mimetype) {
      const error = new Error("Upload JPG, PNG or WebP evidence images.");
      error.statusCode = 400;
      callback(error);
      return;
    }
    callback(null, true);
  },
});

export const uploadReturnEvidence = (req, res, next) => {
  upload.array("images", 5)(req, res, (error) => {
    if (!error && (!req.files || req.files.length === 0)) {
      return res.status(400).json({ success: false, message: "Choose at least one evidence image." });
    }
    if (error instanceof multer.MulterError) {
      const tooLarge = error.code === "LIMIT_FILE_SIZE" || error.code === "LIMIT_FILE_COUNT" || error.code === "LIMIT_PART_COUNT";
      const message = error.code === "LIMIT_FILE_SIZE"
        ? "Evidence images must be 2 MB or smaller each."
        : tooLarge
          ? "Upload no more than 5 evidence images."
          : "Upload JPG, PNG or WebP evidence images using the images field.";
      return res.status(tooLarge ? 413 : 400).json({ success: false, message });
    }
    if (error?.statusCode === 400) {
      return res.status(400).json({ success: false, message: error.message });
    }
    if (error) return next(error);
    next();
  });
};
