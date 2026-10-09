import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export function FullScreenLoader({ text = 'Loading...' }) {
  return (
    <div className="flex h-full items-center justify-center text-slate-500" role="status">
      <span className="mr-3 h-5 w-5 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
      {text}
    </div>
  );
}

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <FullScreenLoader />;
  return user ? children : <Navigate to="/login" replace />;
}

// login/register pages bounce signed-in users to the app
export function PublicRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <FullScreenLoader />;
  return user ? <Navigate to="/" replace /> : children;
}
