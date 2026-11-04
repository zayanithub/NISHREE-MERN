import 'dotenv/config';
import mongoose from 'mongoose';
import connectDB from '../config/DBconfig.js';
import AdminUser from '../models/AdminUser.js';
import Permission from '../models/Permission.js';
import Role from '../models/Role.js';

await connectDB();
try {
  const [activeAdminCount, superAdmin] = await Promise.all([
    AdminUser.countDocuments({ status: 'active' }),
    Role.findOne({ name: 'super_admin', isActive: true }).select('permissions').lean(),
  ]);
  const permissions = superAdmin?.permissions?.length
    ? await Permission.find({ _id: { $in: superAdmin.permissions } }).select('name').lean()
    : [];
  const permissionNames = permissions.map((permission) => permission.name);
  const result = {
    activeAdminCount,
    superAdminRoleActive: Boolean(superAdmin),
    hasProductPermissions: ['products.create', 'products.read', 'products.update', 'products.delete'].every((name) => permissionNames.includes(name)),
    hasOrderPermissions: ['orders.read', 'orders.update'].every((name) => permissionNames.includes(name)),
    hasDashboardPermission: permissionNames.includes('dashboard.read'),
  };
  console.log(JSON.stringify(result, null, 2));
  if (!result.activeAdminCount || !result.superAdminRoleActive || !result.hasProductPermissions || !result.hasOrderPermissions || !result.hasDashboardPermission) process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}
