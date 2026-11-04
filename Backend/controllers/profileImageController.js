import User from "../models/User.js";
import cloudinary, { assertCloudinaryConfigured } from "../config/cloudinary.js";

const matchesImageSignature = (buffer, mimeType) => {
  if (mimeType === "image/jpeg") return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  if (mimeType === "image/png") return buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (mimeType === "image/webp") return buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP";
  return false;
};

const uploadToCloudinary = (file, userId) => new Promise((resolve, reject) => {
  const stream = cloudinary.uploader.upload_stream({
    folder: "nishree/customer-profiles",
    public_id: String(userId),
    overwrite: true,
    invalidate: true,
    resource_type: "image",
    transformation: [{ width: 600, height: 600, crop: "limit", quality: "auto", fetch_format: "auto" }],
  }, (error, result) => error ? reject(error) : resolve(result));
  stream.end(file.buffer);
});

export const saveProfileImage = async (req, res, next) => {
  try {
    const user = await User.findOne({ _id: req.auth?.userId, status: "active" });
    if (!user) return res.status(401).json({ success: false, message: "Customer account is not available." });
    if (!req.file || !matchesImageSignature(req.file.buffer, req.file.mimetype)) {
      return res.status(400).json({ success: false, message: "The selected file is not a valid JPG, PNG or WebP image." });
    }
    assertCloudinaryConfigured();
    const result = await uploadToCloudinary(req.file, user._id);
    user.profileImage = { url: result.secure_url, publicId: result.public_id };
    await user.save();
    return res.status(200).json({ success: true, profileImage: user.profileImage });
  } catch (error) {
    return next(error);
  }
};

export const removeProfileImage = async (req, res, next) => {
  try {
    const user = await User.findOne({ _id: req.auth?.userId, status: "active" });
    if (!user) return res.status(401).json({ success: false, message: "Customer account is not available." });
    if (user.profileImage?.publicId) {
      assertCloudinaryConfigured();
      await cloudinary.uploader.destroy(user.profileImage.publicId, { resource_type: "image" });
    }
    user.profileImage = { url: "", publicId: "" };
    await user.save();
    return res.status(200).json({ success: true, profileImage: user.profileImage });
  } catch (error) {
    return next(error);
  }
};
