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
  limits: { fileSize: 2 * 1024 * 1024, files: 1, fields: 0, parts: 1 },
  fileFilter(_req, file, callback) {
    const extension = path.extname(file.originalname || "").toLowerCase();
    if (!accepted[extension] || accepted[extension] !== file.mimetype) {
      const error = new Error("Upload a JPG, PNG or WebP profile image.");
      error.statusCode = 400;
      callback(error);
      return;
    }
    callback(null, true);
  },
});

export const uploadProfileImage = (req, res, next) => {
  upload.single("profileImage")(req, res, (error) => {
    if (!error && !req.file) {
      return res.status(400).json({ success: false, message: "Choose a profile image to upload." });
    }
    if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
      return res.status(413).json({ success: false, message: "Profile images must be 2 MB or smaller." });
    }
    if (error?.statusCode === 400) {
      return res.status(400).json({ success: false, message: error.message });
    }
    if (error) return next(error);
    next();
  });
};
