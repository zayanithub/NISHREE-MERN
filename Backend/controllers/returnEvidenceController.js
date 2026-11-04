import { randomBytes } from "node:crypto";
import cloudinary, { assertCloudinaryConfigured } from "../config/cloudinary.js";

const matchesImageSignature = (buffer, mimeType) => {
  if (mimeType === "image/jpeg") return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  if (mimeType === "image/png") return buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (mimeType === "image/webp") return buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP";
  return false;
};

const uploadToCloudinary = (file, userId) => new Promise((resolve, reject) => {
  const stream = cloudinary.uploader.upload_stream({
    folder: `nishree/return-evidence/${userId}`,
    public_id: randomBytes(16).toString("hex"),
    resource_type: "image",
    transformation: [{ width: 1600, height: 1600, crop: "limit", quality: "auto", fetch_format: "auto" }],
  }, (error, result) => error ? reject(error) : resolve(result));
  stream.end(file.buffer);
});

export const uploadCustomerReturnEvidence = async (req, res, next) => {
  const uploadedImages = [];
  try {
    const userId = String(req.auth?.userId || "");
    if (!/^[a-f\d]{24}$/i.test(userId)) {
      return res.status(401).json({ success: false, message: "Customer authentication is required." });
    }
    if (!Array.isArray(req.files) || req.files.length === 0 || req.files.length > 5) {
      return res.status(400).json({ success: false, message: "Choose between 1 and 5 evidence images." });
    }
    if (req.files.some((file) => !matchesImageSignature(file.buffer, file.mimetype))) {
      return res.status(400).json({ success: false, message: "One or more files are not valid JPG, PNG or WebP images." });
    }

    assertCloudinaryConfigured();
    for (const file of req.files) {
      const result = await uploadToCloudinary(file, userId);
      uploadedImages.push({ url: result.secure_url, publicId: result.public_id });
    }

    return res.status(201).json({
      success: true,
      data: { evidenceImages: uploadedImages },
    });
  } catch (error) {
    if (uploadedImages.length) {
      await Promise.allSettled(uploadedImages.map(({ publicId }) =>
        cloudinary.uploader.destroy(publicId, { resource_type: "image" })
      ));
    }
    return next(error);
  }
};
