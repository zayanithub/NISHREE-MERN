import { Navigate, useLocation } from 'react-router-dom';
import { useAdminAuth } from './useAdminAuth';

export default function AdminProtectedRoute({ children }) {
  const { admin, loading } = useAdminAuth();
  const location = useLocation();
  if (loading) return <div className="admin-route-loading" role="status">Verifying administrator session…</div>;
  if (!admin) return <Navigate to="/admin/login" replace state={{ from: location.pathname }} />;
  return children;
}
