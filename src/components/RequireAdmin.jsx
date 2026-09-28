import { Navigate } from 'react-router-dom';
import { useAuth } from '../lib/useAuth.jsx';

export default function RequireAdmin({ children }) {
  const { user, isAuthed, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-[13px] text-[#8A8A8A]">Loading…</p>
      </div>
    );
  }

  if (!isAuthed) {
    return <Navigate to="/login" replace />;
  }

  if (!user?.isAdmin) {
    return <Navigate to="/" replace />;
  }

  return children;
}
