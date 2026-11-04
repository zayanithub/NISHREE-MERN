import connectDB from "../config/DBconfig.js";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import AdminUser from "../models/AdminUser.js";
import Role from "../models/Role.js";

const seedAdmin = async () => {
  const { MONGO_URL, ADMIN_NAME, ADMIN_EMAIL, ADMIN_PASSWORD } =
    process.env;

  if (!MONGO_URL || !ADMIN_NAME || !ADMIN_EMAIL || !ADMIN_PASSWORD) {
    throw new Error(
      "Missing MONGO_URL or admin credentials in environment variables"
    );
  }

  if (ADMIN_PASSWORD.length < 12 || ADMIN_PASSWORD.length > 72) {
    throw new Error("Admin password must be 12–72 characters long");
  }

  await mongoose.connect(MONGO_URL);

  const email = ADMIN_EMAIL.trim().toLowerCase();

  const existingAdmin = await AdminUser.findOne({ email });

  if (existingAdmin) {
    console.log("An admin with this email already exists. No changes made.");
    return;
  }

  const adminRole = await Role.findOne({
    name: "super_admin",
    isActive: true,
  });

  if (!adminRole) {
    throw new Error(
      'Active "super_admin" role not found. Create the role and permissions first.'
    );
  }

  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12);

  await AdminUser.create({
    name: ADMIN_NAME.trim(),
    email,
    passwordHash,
    role: adminRole._id,
    status: "active",
  });

  console.log(`Admin account created successfully: ${email}`);
};

try {
  await seedAdmin();
} catch (error) {
  console.error("Admin seed failed:", error.message);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
