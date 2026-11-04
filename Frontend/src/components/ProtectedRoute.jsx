import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import { LoadingState } from './States';

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <div className="page-loading"><LoadingState label="Restoring your session…" /></div>;
  if (!user) return <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}` }} />;
  return children;
}
