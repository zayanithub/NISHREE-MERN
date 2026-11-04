import mongoose from "mongoose";
import User from "../models/User.js";
import Order from "../models/Order.js";

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const parsePagination = (page, limit) => {
  const parsedPage = Number(page ?? 1);
  const parsedLimit = Number(limit ?? 20);
  if (!Number.isInteger(parsedPage) || parsedPage < 1 || !Number.isInteger(parsedLimit) || parsedLimit < 1 || parsedLimit > 100) {
    const error = new Error("Page and limit must be valid positive numbers; limit cannot exceed 100.");
    error.statusCode = 400;
    throw error;
  }
  return { page: parsedPage, limit: parsedLimit };
};

export const listAdminCustomers = async ({ page, limit, search = "" } = {}) => {
  const pagination = parsePagination(page, limit);
  const filter = {};
  const query = String(search).trim().slice(0, 100);
  if (query) {
    const value = new RegExp(escapeRegex(query), "i");
    filter.$or = [{ name: value }, { email: value }, { phone: value }];
  }
  const [customers, total] = await Promise.all([
    User.find(filter)
      .select("name email phone profileImage status createdAt lastLoginAt")
      .sort({ createdAt: -1, _id: -1 })
      .skip((pagination.page - 1) * pagination.limit)
      .limit(pagination.limit)
      .lean(),
    User.countDocuments(filter),
  ]);
  return { customers, pagination: { ...pagination, total, totalPages: Math.ceil(total / pagination.limit) } };
};

export const getAdminCustomer = async (customerId) => {
  if (!mongoose.isValidObjectId(customerId)) {
    const error = new Error("Invalid customer ID.");
    error.statusCode = 400;
    throw error;
  }
  const customer = await User.findById(customerId)
    .select("name email phone profileImage status createdAt lastLoginAt")
    .lean();
  if (!customer) {
    const error = new Error("Customer not found.");
    error.statusCode = 404;
    throw error;
  }
  const orders = await Order.find({ user: customer._id })
    .select("orderNumber totalAmount currency orderStatus paymentMethod paymentStatus createdAt items.productName items.quantity")
    .sort({ createdAt: -1 })
    .limit(25)
    .lean();
  return { customer, orders };
};
