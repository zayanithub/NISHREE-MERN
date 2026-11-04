import AdminUser from "../models/AdminUser.js";

const requirePermission = (resource, action) => {
  const requiredResource = resource.trim().toLowerCase();
  const requiredAction = action.trim().toLowerCase();

  return async (req, res, next) => {
    try {
      // 1. Verify admin authentication
      if (!req.admin?.adminId) {
        return res.status(401).json({
          success: false,
          message: "Admin authentication required.",
        });
      }

      // 2. Fetch admin, role and assigned permissions
      const admin = await AdminUser.findById(
        req.admin.adminId
      )
        .select("status role")
        .populate({
          path: "role",
          select: "name isActive permissions",
          populate: {
            path: "permissions",
            select: "name resource action",
          },
        });

      // 3. Verify admin status
      if (!admin || admin.status !== "active") {
        return res.status(403).json({
          success: false,
          message: "Admin account is inactive or unavailable.",
        });
      }

      // 4. Verify role assignment and status
      if (!admin.role || !admin.role.isActive) {
        return res.status(403).json({
          success: false,
          message: "Admin role is inactive or unavailable.",
        });
      }

      // 5. Verify required permission
      const permissions = admin.role.permissions || [];

      const hasPermission = permissions.some(
        (permission) =>
          permission.resource === requiredResource &&
          permission.action === requiredAction
      );

      if (!hasPermission) {
        return res.status(403).json({
          success: false,
          message: "You do not have permission to perform this action.",
        });
      }

      // 6. Permission granted
      return next();
    } catch (error) {
      console.error(
        "Permission middleware error:",
        error.message
      );

      return res.status(500).json({
        success: false,
        message: "Internal server error.",
      });
    }
  };
};

export default requirePermission;