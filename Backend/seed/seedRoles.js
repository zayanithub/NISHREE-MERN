import "dotenv/config";
import mongoose from "mongoose";

import connectDB from "../config/DBconfig.js";
import Role from "../models/Role.js";
import Permission from "../models/Permission.js";

// Permissions required for the current modules.
const permissions = [
  // Product permissions
  {
    name: "products.create",
    resource: "products",
    action: "create",
    description: "Create new products",
  },
  {
    name: "products.read",
    resource: "products",
    action: "read",
    description: "View product details",
  },
  {
    name: "products.update",
    resource: "products",
    action: "update",
    description: "Update existing products",
  },
  {
    name: "products.delete",
    resource: "products",
    action: "delete",
    description: "Archive products",
  },

  // Category permissions
  {
    name: "categories.create",
    resource: "categories",
    action: "create",
    description: "Create new categories",
  },
  {
    name: "categories.read",
    resource: "categories",
    action: "read",
    description: "View category details",
  },
  {
    name: "categories.update",
    resource: "categories",
    action: "update",
    description: "Update categories and their status",
  },
  {
    name: "categories.delete",
    resource: "categories",
    action: "delete",
    description: "Delete categories when safe",
  },

  // Inventory permissions
  {
    name: "inventory.create",
    resource: "inventory",
    action: "create",
    description: "Create product and variant inventory records",
  },
  {
    name: "inventory.read",
    resource: "inventory",
    action: "read",
    description: "View inventory and low-stock details",
  },
  {
    name: "inventory.update",
    resource: "inventory",
    action: "update",
    description: "Adjust stock quantities and inventory thresholds",
  },
    // Order permissions
  {
    name: "orders.read",
    resource: "orders",
    action: "read",
    description: "View customer orders and order details",
  },
  {
    name: "orders.update",
    resource: "orders",
    action: "update",
    description: "Update order status through allowed workflows",
  },
    // Shipping permissions
  {
    name: "shipping.create",
    resource: "shipping",
    action: "create",
    description: "Create shipment records for eligible orders",
  },
  {
    name: "shipping.read",
    resource: "shipping",
    action: "read",
    description: "View shipment and tracking details",
  },
  {
    name: "shipping.update",
    resource: "shipping",
    action: "update",
    description: "Update shipment status and tracking information",
  },
    // Return permissions
  {
    name: "returns.read",
    resource: "returns",
    action: "read",
    description: "View customer return requests and details",
  },
  {
    name: "returns.update",
    resource: "returns",
    action: "update",
    description: "Review, approve, reject, and update return requests",
  },
    // Refund permissions
  {
    name: "refunds.create",
    resource: "refunds",
    action: "create",
    description: "Create refund requests for eligible returns",
  },
  {
    name: "refunds.read",
    resource: "refunds",
    action: "read",
    description: "View refund records and their status",
  },
  {
    name: "refunds.update",
    resource: "refunds",
    action: "update",
    description: "Approve and process eligible refunds",
  },

    // Exchange permissions
  {
    name: "exchanges.read",
    resource: "exchanges",
    action: "read",
    description: "View customer exchange requests and details",
  },
  {
    name: "exchanges.update",
    resource: "exchanges",
    action: "update",
    description: "Review, approve, reject, and update exchange requests",
  },

  // Review permissions
  {
    name: "reviews.read",
    resource: "reviews",
    action: "read",
    description: "View customer product reviews",
  },
  {
    name: "reviews.update",
    resource: "reviews",
    action: "update",
    description: "Approve or reject customer product reviews",
  },

  // Coupon permissions
  {
    name: "coupons.create",
    resource: "coupons",
    action: "create",
    description: "Create promotional coupons",
  },
  {
    name: "coupons.read",
    resource: "coupons",
    action: "read",
    description: "View coupons and their usage",
  },
  {
    name: "coupons.update",
    resource: "coupons",
    action: "update",
    description: "Update, activate, or deactivate coupons",
  },
  {
    name: "coupons.delete",
    resource: "coupons",
    action: "delete",
    description: "Delete coupons that have never been used",
  },

  // Dashboard permissions
  {
    name: "dashboard.read",
    resource: "dashboard",
    action: "read",
    description: "View store dashboard analytics and inventory alerts",
  },

  {
    name: "customers.read",
    resource: "customers",
    action: "read",
    description: "View customer profiles and order history",
  },
  {
    name: "settings.read",
    resource: "settings",
    action: "read",
    description: "View store contact and social details",
  },
  {
    name: "settings.update",
    resource: "settings",
    action: "update",
    description: "Update store contact and social details",
  },

  // Audit log permissions
  {
    name: "audit_logs.read",
    resource: "audit_logs",
    action: "read",
    description: "View administrator and security audit events",
  },

  // Notification permissions
  {
    name: "notifications.read",
    resource: "notifications",
    action: "read",
    description: "View notifications assigned to the authenticated admin",
  },
  {
    name: "notifications.update",
    resource: "notifications",
    action: "update",
    description: "Mark notifications assigned to the authenticated admin as read",
  },
];

const seedRoles = async () => {
  if (!process.env.MONGO_URL) {
    throw new Error("MONGO_URL is missing");
  }

  // Connect using the existing database configuration.
  await connectDB();

  const permissionIds = [];

  // Create missing permissions or update existing ones.
  for (const item of permissions) {
    const permission = await Permission.findOneAndUpdate(
      {
        resource: item.resource,
        action: item.action,
      },
      {
        $set: {
          name: item.name,
          description: item.description,
        },
        $setOnInsert: {
          resource: item.resource,
          action: item.action,
        },
      },
      {
        returnDocument: "after",
        upsert: true,
        runValidators: true,
        setDefaultsOnInsert: true,
      }
    );

    permissionIds.push(permission._id);
  }

  // Add seeded permissions without removing existing permissions.
  await Role.findOneAndUpdate(
    {
      name: "super_admin",
    },
    {
      $set: {
        description: "Full access to store administration",
        isSystemRole: true,
        isActive: true,
      },
      $addToSet: {
        permissions: {
          $each: permissionIds,
        },
      },
    },
    {
      returnDocument: "after",
      upsert: true,
      runValidators: true,
      setDefaultsOnInsert: true,
    }
  );

  console.log(
    `✅ ${permissionIds.length} permissions are ready.`
  );

    console.log(
      "✅ super_admin role updated with product, category, inventory, order, shipping, return, refund, exchange, review, coupon, dashboard, audit-log, and notification permissions."
  );
};

try {
  await seedRoles();
} catch (error) {
  console.error("Role seed failed:", error.message);
  process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
